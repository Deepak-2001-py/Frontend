# Grading pipeline on AWS Lambda: console setup (free-tier hybrid)

How to replace the old `lambda_python_files` pipeline Lambdas (`excute_jsonifier.py`,
`jsonifier.py`, `grader_lambda.py`) with the new `gradeant-jsonifier` and `gradeant-grader`,
by hand in the AWS console. Region: **eu-north-1**.

## What runs where

| Part | Runs on | Why |
|---|---|---|
| Web app | Netlify (`gradeant.netlify.app`) | |
| API, including `/uploadpdf` and "Start grading" | Render (`gradeant-api.onrender.com`) | It checks logins against Supabase. |
| Database | Supabase `gradeant-eu` | |
| **jsonifier + grader** | **AWS Lambda, triggered by SQS** | This guide. |

**No upload Lambda and no API Gateway route are needed.** Render already does the API Gateway's
job:
- Uploads: `/uploadpdf` on Render checks the user and returns a one-time S3 link.
- "Start grading": Render sends a message to the `Grader` SQS queue.

The Python upload Lambda (`functions/upload.py`) checks users and assignments in DynamoDB, so in
the hybrid it would reject every upload. Your existing `/dev` API Gateway routes can stay, as long
as their old Lambdas no longer read from the queues (step 4).

## The files

Build them with `python build.py --verify` in `python-backend/`. They land in `python-backend/dist/`:

| File | Size | Becomes |
|---|---|---|
| `layer-gradeant-pipeline-deps.zip` | about 52 MB | Layer: Gemini SDK, PyMuPDF, boto3, PyYAML, httpx2 |
| `layer-gradeant-python-common.zip` | about 40 KB | Layer: shared GradeAnt code and prompts |
| `gradeant-jsonifier.zip` | about 1 KB | Function: replaces `excute_jsonifier.py` + `jsonifier.py` |
| `gradeant-grader.zip` | about 4 KB | Function: replaces `grader_lambda.py` |

Everything is built for **Linux arm64, Python 3.13**. Choose exactly that in every step below, or
the function won't start.

## 1. Upload the big layer to S3

The console accepts direct zip uploads only up to 50 MB.

**S3 → `assignmentgrader` → Upload** `layer-gradeant-pipeline-deps.zip` into a folder such as
`lambda-layers/`, and copy its **S3 URL**.

## 2. Create the two layers

**Lambda → Layers → Create layer**, twice:

| Name | Upload | Architecture | Runtime |
|---|---|---|---|
| `gradeant-pipeline-deps` | "Upload a file from Amazon S3" → the URL from step 1 | arm64 | Python 3.13 |
| `gradeant-python-common` | "Upload a .zip file" → `layer-gradeant-python-common.zip` | arm64 | Python 3.13 |

## 3. Create the two functions

**Lambda → Create function → Author from scratch:**

| | `gradeant-jsonifier` | `gradeant-grader` |
|---|---|---|
| Runtime / architecture | Python 3.13 / arm64 | Python 3.13 / arm64 |
| Code | Upload `gradeant-jsonifier.zip` | Upload `gradeant-grader.zip` |
| Handler (Runtime settings → Edit) | `jsonifier.lambda_handler` | `grader.lambda_handler` |
| Layers (Add a layer → Custom layers) | `gradeant-pipeline-deps`, then `gradeant-python-common` | same, same order |
| Memory / timeout (Configuration → General) | 2048 MB / 15 min | 1024 MB / 15 min |

### Environment variables (Configuration → Environment variables)

| Variable | jsonifier | grader |
|---|---|---|
| `APP_ENV` | `production` | `production` |
| `PIPELINE_BUCKET` | `assignmentgrader` | `assignmentgrader` |
| `PIPELINE_ROOT` | `Data_warehouse` | `Data_warehouse` |
| `GEMINI_API_KEY` | your Gemini key (paid tier) | your Gemini key (paid tier) |
| `GEMINI_MODEL` | `gemini-3.5-flash-preview` | `gemini-3.5-flash-preview` |
| `DATABASE_PROVIDER` | — | `supabase` |
| `SUPABASE_URL` | — | `https://dlbjcqrnnbyguewgwntz.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Supabase → gradeant-eu → Project Settings → API Keys → **service_role** |
| `GRADE_ON_UPLOAD` | — | `false` (the teacher presses "Start grading") or `true` (grade as soon as a sheet is read) |
| `GRADER_MAX_WORKERS` | — | `4` |

- Add `PIPELINE_BUCKET_REGION` to both functions only if `assignmentgrader` is **not** in eu-north-1.
- Instead of the plain key, you can store the Gemini key in Secrets Manager and set
  `GEMINI_API_KEY_ARN`. The role then also needs `secretsmanager:GetSecretValue` on that secret.

### Permissions

**Configuration → Permissions → the role name → Add permissions → Create inline policy → JSON.**
Keep the basic CloudWatch Logs policy that Lambda created for the role.

Grader role (replace `ACCOUNT_ID`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": "arn:aws:s3:::assignmentgrader/Data_warehouse/*" },
    { "Effect": "Allow", "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::assignmentgrader",
      "Condition": { "StringLike": { "s3:prefix": "Data_warehouse/*" } } },
    { "Effect": "Allow",
      "Action": ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes", "sqs:ChangeMessageVisibility"],
      "Resource": "arn:aws:sqs:eu-north-1:ACCOUNT_ID:Grader" }
  ]
}
```

Jsonifier role: the same policy, with your **jsonifier queue's** ARN in place of the `Grader` one.

## 4. Move the queue triggers from the old Lambdas to the new ones

Never let two functions read one queue: they would compete for the messages.

1. **Turn off the old triggers first.** Lambda → old grader (`grader_lambda`) → Configuration →
   Triggers → the SQS trigger → **Disable**. Do the same for the old jsonifier (`excute_jsonifier`).
2. **Queue settings.** On both queues, set the **visibility timeout to 5400 s** (6 × the 15-minute
   function timeout). Give each queue a dead-letter queue (Redrive policy, maximum receives **3**)
   if it has none.
3. **Add the new triggers.**
   - `gradeant-jsonifier` → Add trigger → SQS → the jsonifier queue.
   - `gradeant-grader` → Add trigger → SQS → `Grader`.
   - On both: **batch size 1**, and tick **"Report batch item failures"**. The new code reports
     failed messages one by one and depends on that setting.

Keep the S3 event notifications on `assignmentgrader` as they are:
- `.pdf` files → the jsonifier queue
- parsed `.json` files → `Grader`

The new code reads the same `Data_warehouse/students/assignments/<assignment>__<qp>/…` folders:
`original_pdf/` for uploaded sheets, and `Parsed_pdfs/JSON/` for what the jsonifier writes. It
skips any other file.

## 5. Test

1. **Grader on its own:** `gradeant-grader` → Test → event `{"Records": []}`. It should return
   `{"batchItemFailures": []}`. Do the same for `gradeant-jsonifier`.
2. **End to end, on https://gradeant.netlify.app:**
   1. A student uploads an answer sheet. The jsonifier writes `…/Parsed_pdfs/JSON/<student>.json`.
   2. With `GRADE_ON_UPLOAD=false`, the teacher presses **Start grading**.
   3. Rows appear in Supabase → Table Editor → `gradeant.assignment_grading`, and the grades show in the app.
   4. CloudWatch logs for both functions have no `message failed` lines, and the dead-letter queues stay empty.

## Updating later

1. Rebuild with `python build.py --verify`.
2. **Code change only:** upload the new `gradeant-grader.zip` / `gradeant-jsonifier.zip` to the function.
3. **Shared code or prompt change:** create a new version of `gradeant-python-common`, then select
   that version on both functions.

## Rollback

1. Disable the two new SQS triggers.
2. Re-enable the old Lambdas' triggers.

The old Lambdas write to DynamoDB again, so grades they produce won't show in the hybrid web app,
which reads Supabase.
