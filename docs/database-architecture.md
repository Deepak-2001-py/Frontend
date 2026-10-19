# GradeAnt data model and database architecture

This is the final schema, reconciled from *GradeAnt Database Design Document* and
*GradeAnt Schema Flow Wireframes*, and how it is stored:

| Environment | Database | Auth | Selected by |
|---|---|---|---|
| Production (Lambda Web Functions) | **Amazon DynamoDB** (9 tables, below) | API-issued HS256 JWT | `DB_DRIVER=dynamodb` (default in production) |
| Development | **Supabase Postgres** (local stack, `supabase/migrations/`) | Supabase Auth | `DB_DRIVER=postgres`, `AUTH_DRIVER=supabase` (`.env.development`) |
| Offline dev / tests | in-process DynamoDB emulator, same 9 tables | API JWT | `npm run dev:offline`, `npm test` |

Services never see which database is running. They call the repositories in
`backend/src/repositories/`, which have two implementations of the same interface:
`dynamodb/` and `postgres/`. The contract tests run both against the same scenarios,
so the two stay equivalent.

Postgres is refused in production (`DB_DRIVER=postgres` fails config validation), and
Supabase Auth is refused there too. Production keeps the existing JWT login. The
`cognito_sub` column is reserved for a later move to Cognito.

---

## 1. Entities

```
                 ┌──────────────┐ teacher_id  ┌──────────────┐
                 │    USERS     │◄────────────│   CLASSES    │
                 │ student /    │             │ name, subject│
                 │ teacher /    │◄──┐ member  │ term         │
                 │ admin        │   └─────────│ CLASS_MEMBERS│
                 └──────┬───────┘             └──────┬───────┘
        reset requests, │ invites, audit log         │ class_id
                        │                     ┌──────▼───────┐ 1:1 ┌─────────────────┐
                        │        teacher_id   │ ASSIGNMENTS  │────►│ QUESTION_PAPERS │
                        │◄────────────────────│ due, status, │     │ status, rubric  │
                        │                     │ grading setup│     │  └─ QUESTIONS   │
                        │                     └──────┬───────┘     └─────────────────┘
                        │ student_id                 │ assignment_id
                        │                     ┌──────▼───────┐
                        └─────────────────────│ SUBMISSIONS  │ one per (assignment, student)
                                              │ status, score│
                                              │  └─ ANSWERS  │ one per question: OCR text,
                                              └──────────────┘ marks, feedback, confidence
```

| Entity | What it holds | Notes |
|---|---|---|
| **users** | profile, `role`, `account_status`, password hash, teacher grading defaults (`settings`) | One table for every role. Replaces the old `Users` and `GradeAnt_Users` pair, so an account has one password. |
| **classes** / **class_members** | class name ("PHY-204"), owning teacher, enrolment (`enrolled` / `removed`) | Replaces the `classes` list stored on each student. |
| **assignments** | class, owning teacher, title, due date, `content_status`, `grades_status`, grading method/persona/partial credit | `teacher_id` is the owner for every permission check. |
| **question_papers** | paper status (`qp_status`), reviewed rubric, S3 keys | 1:1 with an assignment, keyed by the existing `qp_id`. |
| **questions** | parsed question text, max marks, OCR confidence, teacher review stamp | Stored **once per paper**. The old table copied it onto every student's row. |
| **submissions** | one per (assignment, student): status, total score, pages, S3 keys, publish/remind/re-check stamps | The *summary* row of the old `assignment_grading` and the `GradeAnt_Submissions` row, merged. `submission_id` is the summary's old `evaluation_id`. |
| **answers** | one per question of a submission: OCR'd/corrected answer, marks, feedback, confidence, flag resolution, override history | The *detail* rows of the old `assignment_grading`. `answer_id` is the old `evaluation_id`, so ids the frontend holds stay valid. |
| **reset_requests** | password-reset queue | `pending → approved → temp_issued → completed` (or `rejected`, `expired`). |
| **invites** | one-time first-login links | |
| **audit_log** | append-only admin actions | Partitioned by month. |
| **announcements** | teacher → class posts | |
| content_posts, tickets, platform_settings, analytics_snapshots | admin console | Same fields as before. |

### Decisions where the two documents disagreed

1. **Submission granularity.** The DB design document has one submission per
   (assignment, student). The flow wireframes have one item per (student, question).
   **Final: both.** A submission header holds the status and total score, and answer
   rows hold the per-question data. The grading grid, flag queue and analytics need
   per-question marks in the database, not only in an S3 report.
2. **Per-question scores** live in `answers` (queryable), not only in the S3
   `report.json`. S3 keeps the artifacts: raw scans, OCR output, corrected text and
   the report.
3. **Identity.** The wireframes use Cognito. Final for now: the existing JWT login, with
   `cognito_sub` reserved on `users`. Development uses Supabase Auth with the same
   `users` table holding role and status.
4. **Question text** is stored once, in `questions`. Correcting it is now one write
   instead of a fan-out to every student's row.
5. **Statuses** are the union of both documents (listed in §4). The submission status
   shown to users is still *derived* from the answers (OCR'd → corrected → graded →
   flagged) and merged with the statuses the workflow records (triggered, reviewed,
   published), so a grading pipeline that only writes answers and scores keeps working.
6. **Students see the assignments of the classes they are enrolled in**, plus any they
   have a submission for. The old "no classes recorded → see every published
   assignment" fallback is gone (the design rule is enrolment-based).
7. **Deleting a user is a soft delete**: `account_status = deactivated`, class
   memberships flip to `removed`, and submissions and grades are kept. A deactivated
   account can't log in and is hidden from the admin user list.
8. **IDs keep their current formats** (`A-…`, `QP-…`, `N-…`, UUIDs) so existing links
   and the grading pipeline's ids still resolve.

---

## 2. Production: DynamoDB tables

Table names are `${DYNAMODB_TABLE_PREFIX}<name>`, with the prefix defaulting to `gradeant-`.
Every table has string keys `pk`, `sk` and, where listed, `gsi1pk/gsi1sk` …
`gsi3pk/gsi3sk` (GSIs project ALL). Billing mode is on-demand. Attribute names match
the Postgres column names.

| Table | Item | `pk` / `sk` | GSIs |
|---|---|---|---|
| **users** | profile | `USER#<userId>` / `PROFILE` | GSI1 `ROLE#<role>` / `NAME#<lower name>#<userId>` — users by role (admin list) |
| | email guard | `EMAIL#<lower email>` / `EMAIL` → `user_id` | — (strongly consistent login lookup + uniqueness) |
| **classes** | class | `CLASS#<classId>` / `METADATA` | GSI1 `TEACHER#<teacherId>` / `CLASS#<classId>` — a teacher's classes |
| | member | `CLASS#<classId>` / `MEMBER#<studentId>` | GSI1 `USER#<studentId>` / `CLASS#<classId>` — "my classes" |
| | name guard | `CLASSNAME#<lower name>` / `NAME` → `class_id` | — |
| **assignments** | assignment | `ASSIGN#<assignmentId>` / `METADATA` | GSI1 `CLASS#<classId>` / `DUE#<dueAt>#<id>` — class feed by due date · GSI2 `TEACHER#<teacherId>` / `CREATED#<createdAt>#<id>` — teacher's assignments |
| **question-papers** | paper (+ rubric) | `QP#<qpId>` / `METADATA` | — |
| | question | `QP#<qpId>` / `Q#<questionNumber>#<subpart>` | — |
| **submissions** | header | `SUB#<submissionId>` / `METADATA` | GSI1 `ASSIGN#<assignmentId>` / `USER#<studentId>#METADATA` · GSI2 `USER#<studentId>` / `CREATED#<createdAt>#<id>` — "my submissions" |
| | answer | `SUB#<submissionId>` / `ANSWER#<questionNumber>#<subpart>` | GSI1 `ASSIGN#<assignmentId>` / `USER#<studentId>#ANSWER#…` — the whole grading grid in one query · GSI3 `ANSWER#<answerId>` / `ANSWER` — answer by id |
| | (assignment, student) guard | `ASSIGN#<assignmentId>#USER#<studentId>` / `SUBMISSION` → `submission_id` | — |
| **reset-requests** | request | `RESET#<requestId>` / `METADATA` | GSI1 `STATUS#<status>` / `<requestedAt>#<id>` — admin queue |
| **audit-log** | event | `AUDIT#<yyyy-mm>` / `<ts>#<eventId>` | — (append-only; listing reads the newest months first) |
| **announcements** | post | `ANN#<id>` / `METADATA` | GSI1 `CLASSNAME#<lower class>` / `CREATED#<createdAt>#<id>` — class feed · GSI2 `AUTHOR#<userId>` / `CREATED#…` |
| **app** | content post | `POST#<id>` / `METADATA` | GSI1 `POSTS` / `<status>#<dateLabel>#<id>` |
| | ticket | `TICKET#<id>` / `METADATA` | GSI1 `TICKETS` / `<status>#<id>` |
| | invite · setting · analytics | `INVITE#<token>` · `SETTING#<key>` · `METRIC#<key>` / `METADATA` | — |

Uniqueness ("one account per email", "one class per name", "one submission per
assignment and student") uses a **guard item**, written with a conditional put
(`attribute_not_exists(pk)`) before the record itself. A guard whose record never
appeared (a crash between the two writes) is reclaimed after a minute. A GSI can't
enforce uniqueness and is only eventually consistent, so the guard also serves the
strongly consistent login lookup. This is the one deliberate departure from the design
document, which used GSI1 `EMAIL#…` for that lookup.

Only two access patterns scan, and both are admin-only: "every assignment" (the admin's
assignment list) and "every announcement". Everything else is a `GetItem` or a `Query`.

### Access patterns

| Screen / operation | DynamoDB | Postgres |
|---|---|---|
| Login, every authenticated request | `GetItem EMAIL#<email>` → `GetItem USER#<id>` | `users where lower(email) = $1` |
| Admin users list (by role) | `Query GSI1 ROLE#<role>` | `users where role = $1` |
| Student's classes | `Query classes.GSI1 USER#<sid>` | `class_members where student_id = $1` |
| Class roster | `Query CLASS#<cid> begins_with(sk, MEMBER#)` | `class_members where class_id = $1` |
| Teacher's assignments | `Query assignments.GSI2 TEACHER#<tid>` | `assignments where teacher_id = $1` |
| Student's assignment feed | per class: `Query assignments.GSI1 CLASS#<cid>` | `assignments where class_id = any($1)` |
| Paper, rubric, questions | `Query QP#<qpId>` | `question_papers` + `questions where qp_id = $1` |
| Grading grid (all students, all answers) | `Query submissions.GSI1 ASSIGN#<aid>` | `submissions` + `answers` joined on `assignment_id` |
| One student's paper | `GetItem ASSIGN#<aid>#USER#<sid>` → `Query SUB#<id>` | `submissions where (assignment_id, student_id)` + `answers` |
| Student's submissions | `Query submissions.GSI2 USER#<sid>` | `submissions where student_id = $1` |
| Answer by id (corrections, overrides) | `Query submissions.GSI3 ANSWER#<id>` | `answers where answer_id = $1` |
| Reset queue | `Query reset-requests.GSI1 STATUS#<s>` | `reset_requests where status = $1` |
| Audit log (latest 200) | `Query AUDIT#<month>` newest first, month by month | `audit_log order by ts desc limit 200` |
| Class announcements | `Query announcements.GSI1 CLASSNAME#<c>` | `announcements where lower(class_name) = any($1)` |

---

## 3. Development: Supabase Postgres

The schema is `supabase/migrations/20261019000000_gradeant_schema.sql`, which
`npx supabase start` / `npx supabase db reset` apply. It has the same entities and
column names as the DynamoDB attributes, with foreign keys and check constraints for
every status. Every table has row-level security enabled and no policies, so nothing is
exposed through Supabase's auto-generated REST API. The API connects with `DATABASE_URL`
as a server role.

Conventions shared by both stores:

* snake_case names; timestamps are ISO-8601 UTC text. The API still returns these as
  epoch numbers: `reset_requests.requested_at`, `audit_log.ts`, `invites.expires_at`.
* `question_number` keeps its JSON type (`1` vs `"1"`); `q_key`/`sp_key` are its text
  key and the subpart's.
* `extra` (JSON) keeps attributes a grading pipeline wrote that have no column, so
  nothing is lost in migration.

---

## 4. Status machines

**users.account_status**: `invited` → (first login sets a password) `active` ⇄
`suspended`; `active` → (admin issues a temp password) `temp_password` → (user changes
it) `active`; any → `deactivated` (delete; terminal). Only `active` and `temp_password`
can log in.

**reset_requests.status**: `pending` → `approved` → `temp_issued` (admin generated a
temporary password, valid 72 h, user forced to change it) → `completed` (the user
changed it). `pending`/`approved` → `rejected`. `temp_issued` past its expiry →
`expired` (the login is refused, so the user asks again).

**question_papers.status** (`qp_status` in the API): `upload_requested` → `qp_uploaded`
→ `qp_parsed` → `rubric_generating` (AI drafting) / `rubric_generated` (standard
method or draft ready) → `rubric_reviewed` (teacher approved; grading can start);
`failed`.

**submissions.status** (as shown): `upload_requested` → `answer_uploaded` → `ocr_done`
→ `corrected` (student confirmed every answer) → `grading_triggered` → `ai_graded` →
`queued_for_review` (an answer under `FLAG_CONFIDENCE` that the teacher hasn't
accepted) → `teacher_reviewed` → `published` → `published_revised`; `expired`.

**assignments**: `content_status` `draft` | `published`; `grades_status`
`not_started` → `ai_graded` / `teacher_reviewing` → `published`.

---

## 5. S3 layout (unchanged buckets)

```
uploads/question_paper/<assignmentId>/<file>      → question_papers.raw_s3_key
uploads/answer_sheet/<assignmentId>/<file>         → submissions.raw_s3_key
…/ocr, …/corrected, …/report.json (pipeline)       → submissions.ocr_s3_key / corrected_s3_key / report_s3_key
profile-photos/<userId>.<ext>                       → users.photo_key
```

---

## 6. Grading pipeline contract (external — not in this repository)

The OCR/grading Lambdas outside this repo currently write `assignment_grading` rows.
**Before production switches to these tables, the pipeline must write the new ones
instead:**

| When | Write |
|---|---|
| Question paper parsed | `questions` items under `QP#<qpId>` (text, max marks, OCR confidence); paper status `qp_parsed` |
| Answer sheet OCR'd | the submission (created via the (assignment, student) guard if new) and one `answers` item per question, `status = ocr_done` |
| Paper graded | each answer's `marks`, `feedback`, `confidence`; the submission's `total_marks`, `graded_at` |

`LegacyImport.grading` in `backend/src/repositories/legacy.js` maps old
`assignment_grading` rows (one student's batch, or a single new row) onto exactly these
writes. It's the reference for the change, and can serve as a shim during the transition.

---

## 7. Migrating existing data

```
cd backend
DB_DRIVER=dynamodb AWS_DATA_REGION=… npm run migrate:legacy             # dry run: reads the old tables, prints counts
DB_DRIVER=dynamodb AWS_DATA_REGION=… npm run migrate:legacy -- --write  # writes the new tables
```

The migration reads the old tables (names from `LEGACY_*_TABLE`, defaulting to the
current ones) and writes the new model through the same repositories the API uses. It
can also target Postgres. It never modifies or deletes the old tables, and is
idempotent: re-running it upserts the same items.

| Old | New |
|---|---|
| `Users` (login) + `GradeAnt_Users` (admin console) | `users`, merged by email. The login password wins; an admin-console-only account keeps its admin-format hash, which still verifies. |
| `Users.classes` + every assignment's `class_name` | `classes` + `class_members` |
| `GradeAnt_Assignments` | `assignments` + `question_papers` (`qp_status`, rubric) |
| `assignment_grading` detail rows | `questions` (first copy of each question) + `answers` |
| `assignment_grading` summary rows + `GradeAnt_Submissions` | `submissions` |
| `GradeAnt_ResetRequests`, `_Invites`, `_AuditLogs`, `_Announcements`, `_Content`, `_Tickets`, `_Settings`, `_Analytics` | the matching new tables |

Grading rows whose assignment is missing from `GradeAnt_Assignments` get a placeholder
assignment, so no grade is dropped.

**Rollout order** (nothing is deployed or migrated by this change):

1. Create the 9 tables. `backend/src/dev/schema.js` holds their definitions, and
   `npm run tables:print` prints them as JSON for `aws dynamodb create-table --cli-input-json`.
   The API's IAM policy needs `table/gradeant-*` and `table/gradeant-*/index/*`.
2. Update the grading pipeline to the contract in §6.
3. Run the migration, deploy the API with the new table names, and keep the old
   tables read-only until the parity checks pass.
