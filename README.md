# GradeAnt

AI-powered grading for STEM homework: teachers upload a question paper, students upload handwritten answers, GradeFlow™ grades them against a rubric, and the teacher reviews and publishes the results.

## What's in this repo

| Path | What |
|---|---|
| [`web/`](web/) | **The web app** — React 19 + TypeScript + Vite. Marketing site, student / teacher / admin areas. Start here. |
| [`lambda_python_files/`](lambda_python_files/) | Backend AWS Lambdas (Python): auth, grades, OCR corrections, grade updates, and the assignment **workflow** API. Includes a local dev server and tests. |
| [`admin/lambda_admin.py`](admin/lambda_admin.py) | Admin-console Lambda (users, reset requests, content, tickets, audit logs, settings). |
| Root `*.html`, `student/`, `teacher/`, `css/`, `javascript/`, … | The **legacy static site** the React app replaces. Still what the root `Dockerfile` serves. |
| `GradeAnt Website Wireframes (standalone).html`, `workflows/`, `*.dc.html` | Design wireframes and schema docs. [`web/WIREFRAMES.md`](web/WIREFRAMES.md) maps every wireframe screen to its route and file. |

## Run the web app

You need **Node.js 20.19+ or 22.12+** (and **Python 3.12+** for the local backend).

### Option A — fully local (no AWS needed)

The local backend runs the real Lambda code against an in-memory DynamoDB, pre-filled with demo users and a graded assignment.

```bash
# Terminal 1 — backend on http://localhost:8787
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r lambda_python_files/requirements-dev.txt
python lambda_python_files/local_dev_server.py

# Terminal 2 — web app on http://localhost:5173
cd web
npm install
echo "VITE_API_BASE_URL=http://localhost:8787" > .env.local
npm run dev
```

Open http://localhost:5173 and log in (pick the matching role on the login page). Password for every demo account: **`Password123!`**

| Role | Email |
|---|---|
| Admin | `admin@gradeant.dev` |
| Teacher | `teacher@gradeant.dev` |
| Student | `riya@gradeant.dev`, `sam@gradeant.dev`, `li@gradeant.dev` |

Data lives in memory and resets when the backend restarts. File uploads are accepted but not stored, and the GradeFlow assistant gives a canned reply unless you start the backend with `USE_BEDROCK=1` (it then calls Claude on Amazon Bedrock with your AWS credentials).

### Option B — against the deployed AWS API

```bash
cd web
npm install
npm run dev            # uses the API Gateway URL in web/src/config.ts
```

To point at a different stage, copy `web/.env.example` to `web/.env.local` and set `VITE_API_BASE_URL`. The assignment screens (create assignment, grading run, submissions, student inbox, assistant) need the `workflow` Lambda deployed at `/workflow` — see below.

### Other commands

```bash
cd web
npm run build          # type-check + production bundle in web/dist/
npm run preview        # serve the production build locally
npm run lint

# backend tests (from the repo root, with the venv active)
pytest lambda_python_files/tests
```

## Deploying

**Web app.** `web/Dockerfile` builds the app and serves it with NGINX (`web/nginx.conf` adds the SPA fallback and 301s every old `.html` URL to its new route):

```bash
cd web
docker build --build-arg VITE_API_BASE_URL=https://<api-id>.execute-api.<region>.amazonaws.com/<stage> -t gradeant-web .
docker run -p 8080:80 gradeant-web
```

> **Note:** the GitHub Action in `.github/workflows/aws.yml` still builds the **root** `Dockerfile` (the legacy static site) on every push to `main`. Point it at `web/` to ship the React app.

**Lambdas.** One API Gateway REST API with **Lambda proxy integration** for each route. Every Lambda must share the same `JWT_SECRET`.

| Route | File | Tables |
|---|---|---|
| `POST /auth/*` | `lambda_python_files/authetication.py` | `Users`, `GradeAnt_ResetRequests` |
| `POST /getgrades` | `lambda_python_files/get_grades.py` | `assignment_grading`, `Users` |
| `POST /correctanswer` | `lambda_python_files/correct_questions_answer.py` | `assignment_grading`, `Users` |
| `POST /updatedb` | `lambda_python_files/update_db.py` | `assignment_grading`, `Users` |
| `POST /admin` | `admin/lambda_admin.py` | `GradeAnt_*` admin tables, `Users` |
| `POST /workflow` | `lambda_python_files/workflow.py` | `GradeAnt_Assignments`, `GradeAnt_Submissions`, `GradeAnt_Announcements`, `assignment_grading`, `Users`; Claude on Amazon Bedrock |
| `POST /uploadpdf` | *(not in this repo)* | S3 presigned uploads |

Dependencies for the Lambdas are in `lambda_python_files/requirements.txt` (bundle them as a layer). Each file's header documents its environment variables, table keys and IAM permissions; `workflow.py` also lists the two new tables and the recommended `assignment_id-index` on `assignment_grading`.
