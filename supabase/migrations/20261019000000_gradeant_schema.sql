-- GradeAnt data model — development database (Supabase / Postgres).
--
-- Production stores the same entities in DynamoDB (backend/src/repositories/dynamodb,
-- key design in docs/database-architecture.md). Both are reached only through the
-- backend's repositories, so services never see which database is running.
--
-- Conventions shared with the DynamoDB tables (so the two stay interchangeable):
--   * column names = DynamoDB attribute names (snake_case)
--   * timestamps are ISO-8601 UTC text (sortable as strings), except the legacy
--     epoch-second fields the API still returns as numbers (requested_at, ts, expires_at)
--   * question numbers keep their JSON type (1 vs "1"), with a text key for indexing
--   * `extra` holds attributes the grading pipeline wrote that have no column yet
--
-- Identity: passwords are checked by the API (or by Supabase Auth with
-- AUTH_DRIVER=supabase); `users` holds the profile, role and account status.

-- ---------------------------------------------------------------- identity

create table users (
  user_id              text primary key,
  email                text not null,
  username             text,
  name                 text not null default '',
  role                 text not null check (role in ('student', 'teacher', 'admin')),
  account_status       text not null default 'active'
                       check (account_status in ('invited', 'active', 'temp_password', 'suspended', 'deactivated')),
  password_hash        text,
  must_change_password boolean not null default false,
  school               text,
  phone                text,
  photo_key            text,
  admin_level          text,
  settings             jsonb not null default '{}'::jsonb,   -- teacher grading defaults
  cognito_sub          text unique,                          -- reserved for a Cognito identity store
  created_by           text,
  created_at           text not null,
  updated_at           text,
  first_login_at       text,
  last_login_at        text,
  active_reset_id      text
);
create unique index users_email_key on users (lower(email));
create unique index users_username_key on users (lower(username)) where username is not null;
create index users_role_name_idx on users (role, lower(name));

-- ---------------------------------------------------------------- classes

create table classes (
  class_id    text primary key,
  name        text not null,                 -- shown as class_name, e.g. "PHY-204"
  subject     text,
  term        text,
  teacher_id  text references users (user_id),
  created_by  text,
  created_at  text not null
);
create unique index classes_name_key on classes (lower(name));
create index classes_teacher_idx on classes (teacher_id);

create table class_members (
  class_id       text not null references classes (class_id) on delete cascade,
  student_id     text not null references users (user_id),
  member_status  text not null default 'enrolled' check (member_status in ('enrolled', 'removed')),
  added_by       text,
  added_at       text not null,
  primary key (class_id, student_id)
);
create index class_members_student_idx on class_members (student_id);

-- ---------------------------------------------------------------- coursework

create table assignments (
  assignment_id           text primary key,
  qp_id                   text not null unique,
  class_id                text references classes (class_id),
  class_name              text,              -- denormalised classes.name for list views
  teacher_id              text references users (user_id),
  title                   text not null,
  due_at                  text,
  total_marks             double precision,
  question_count          integer,
  content_status          text not null default 'published' check (content_status in ('draft', 'published')),
  grades_status           text not null default 'not_started'
                          check (grades_status in ('not_started', 'ai_graded', 'teacher_reviewing', 'published')),
  method                  text check (method in ('ai', 'standard')),
  persona                 text check (persona in ('balanced', 'strict', 'lenient')),
  partial_credit          boolean,
  created_at              text not null,
  questions_confirmed_at  text,
  grading_started_at      text,
  published_at            text,
  extra                   jsonb not null default '{}'::jsonb
);
create index assignments_teacher_idx on assignments (teacher_id, created_at);
create index assignments_class_idx on assignments (class_id, due_at);

create table question_papers (
  qp_id                    text primary key,
  assignment_id            text not null unique references assignments (assignment_id) on delete cascade,
  status                   text not null default 'qp_uploaded'
                           check (status in ('upload_requested', 'qp_uploaded', 'qp_parsed', 'rubric_generating',
                                             'rubric_generated', 'ai_solution_pending_review', 'rubric_reviewed', 'failed')),
  rubric                   jsonb,              -- reviewed rubric items [{question_number, subpart?, title, max_marks, criteria}]
  rubric_source            text check (rubric_source in ('teacher', 'ai_generated')),
  raw_s3_key               text,
  parsed_s3_key            text,
  rubric_s3_key            text,
  upload_id                text,
  presigned_url_expires_at text,
  rubric_reviewed_by       text,
  rubric_reviewed_at       text,
  updated_at               text
);

create table questions (
  qp_id            text not null references question_papers (qp_id) on delete cascade,
  question_number  jsonb not null,
  q_key            text generated always as (question_number #>> '{}') stored,
  subpart          text,
  sp_key           text generated always as (coalesce(subpart, '')) stored,
  question         text,
  is_latex         boolean,
  max_marks        double precision,
  ocr_confidence   double precision,
  reviewed_by      text,
  reviewed_at      text,
  primary key (qp_id, q_key, sp_key)
);

-- ---------------------------------------------------------------- submissions

create table submissions (
  submission_id            text primary key,   -- also the evaluation_id of the graded summary
  assignment_id            text not null references assignments (assignment_id) on delete cascade,
  qp_id                    text,              -- denormalised assignments.qp_id
  student_id               text not null references users (user_id),
  status                   text check (status in ('upload_requested', 'answer_uploaded', 'ocr_done', 'corrected',
                                                  'grading_triggered', 'ai_graded', 'queued_for_review',
                                                  'teacher_reviewed', 'published', 'published_revised', 'expired')),
  total_marks              double precision,   -- score; set when the paper is graded
  score_updated_at         text,
  score_updated_by         text,
  grading_mode             text,
  pages                    integer,
  raw_s3_key               text,
  ocr_s3_key               text,
  corrected_s3_key         text,
  report_s3_key            text,
  upload_id                text,
  presigned_url_expires_at text,
  submitted_at             text,
  graded_at                text,
  published_at             text,
  notified_at              text,
  reminded_at              text,
  recheck                  jsonb,
  recheck_status           text check (recheck_status in ('open', 'closed')),
  recheck_requested_at     text,
  created_at               text not null,
  status_changed_at        text,
  extra                    jsonb not null default '{}'::jsonb,
  unique (assignment_id, student_id)
);
create index submissions_student_idx on submissions (student_id, submitted_at);

-- One row per question of a submission: OCR'd / corrected answer, marks, flags.
create table answers (
  answer_id          text primary key,         -- the evaluation_id the API exposes
  submission_id      text not null references submissions (submission_id) on delete cascade,
  question_number    jsonb not null,
  q_key              text generated always as (question_number #>> '{}') stored,
  subpart            text,
  sp_key             text generated always as (coalesce(subpart, '')) stored,
  status             text,                     -- ocr_done | corrected (per question)
  student_answer     text,
  is_latex           boolean,
  max_marks          double precision,
  marks              double precision,
  feedback           text,
  confidence         double precision,
  corrected_by       text,
  corrected_at       text,
  flag_resolved_at   text,
  flag_resolved_by   text,
  flag_resolution    text,
  overridden_by      text,
  overridden_at      text,
  override_reason    text,
  revision_history   jsonb,
  created_at         text,
  updated_at         text,
  extra              jsonb not null default '{}'::jsonb,
  unique (submission_id, q_key, sp_key)
);

-- ---------------------------------------------------------------- account workflows

create table reset_requests (
  request_id         text primary key,
  user_id            text not null references users (user_id),
  user_name          text,
  user_email         text,
  role               text,
  reason             text,
  source             text,                     -- login | admin
  status             text not null default 'pending'
                     check (status in ('pending', 'approved', 'temp_issued', 'completed', 'rejected', 'expired')),
  requested_at       double precision not null, -- epoch seconds
  decided_by         text,
  decided_at         text,
  temp_pw_expires_at text,
  completed_at       text,
  reject_reason      text
);
create index reset_requests_status_idx on reset_requests (status, requested_at);
create index reset_requests_user_idx on reset_requests (user_id, requested_at);

create table invites (
  token       text primary key,
  user_id     text not null references users (user_id),
  full_name   text,
  role        text,
  class_name  text,
  expires_at  double precision not null,     -- epoch seconds
  consumed    boolean not null default false
);

-- Append-only.
create table audit_log (
  event_id    text primary key,
  month       text not null,                 -- yyyy-mm, the DynamoDB partition
  ts          double precision not null,     -- epoch seconds
  actor_id    text,
  actor_role  text,
  action      text not null,
  target_id   text,
  detail      jsonb
);
create index audit_log_month_ts_idx on audit_log (month, ts desc);

-- ---------------------------------------------------------------- class communication

create table announcements (
  announcement_id  text primary key,
  class_id         text references classes (class_id),
  class_name       text not null,
  title            text not null,
  message          text not null,
  author_id        text references users (user_id),
  author_name      text,
  created_at       text not null
);
create index announcements_class_idx on announcements (lower(class_name), created_at desc);
create index announcements_author_idx on announcements (author_id, created_at desc);

-- ---------------------------------------------------------------- admin console

create table content_posts (
  post_id     text primary key,
  title       text,
  author      text,
  date_label  text,
  status      text not null default 'draft' check (status in ('draft', 'pending', 'published'))
);

create table tickets (
  ticket_id       text primary key,
  priority        text,
  subject         text,
  age_label       text,
  requester_name  text,
  assignee_id     text,
  assignee_name   text,
  status          text not null default 'open' check (status in ('open', 'resolved'))
);
create index tickets_status_idx on tickets (status);
create index tickets_assignee_idx on tickets (assignee_id);

create table platform_settings (
  setting_key  text primary key,
  data         jsonb not null
);

create table analytics_snapshots (
  metric_key  text primary key,           -- e.g. "30d"; written by a scheduled job
  data_json   text not null
);

-- The API connects as a trusted server role; nothing here is exposed through
-- Supabase's auto-generated REST API to browsers.
alter table users enable row level security;
alter table classes enable row level security;
alter table class_members enable row level security;
alter table assignments enable row level security;
alter table question_papers enable row level security;
alter table questions enable row level security;
alter table submissions enable row level security;
alter table answers enable row level security;
alter table reset_requests enable row level security;
alter table invites enable row level security;
alter table audit_log enable row level security;
alter table announcements enable row level security;
alter table content_posts enable row level security;
alter table tickets enable row level security;
alter table platform_settings enable row level security;
alter table analytics_snapshots enable row level security;
