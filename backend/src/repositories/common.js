// Shared by both database adapters (dynamodb/ and postgres/), so they return
// identical records: snake_case fields, unset fields omitted, the same errors.

/** Drops null/undefined fields (and empty `extra` / `settings` maps). */
export function compact(record) {
  if (!record) return undefined
  const out = {}
  for (const [k, v] of Object.entries(record)) {
    if (v === null || v === undefined) continue
    if ((k === 'extra' || k === 'settings') && typeof v === 'object' && !Object.keys(v).length) continue
    out[k] = v
  }
  return out
}

/** Text key of a question number: 1 and "1" are the same question. */
export const qKey = (questionNumber) =>
  questionNumber === null || questionNumber === undefined
    ? ''
    : typeof questionNumber === 'string'
      ? questionNumber
      : JSON.stringify(questionNumber)

export const spKey = (subpart) => (subpart === null || subpart === undefined ? '' : String(subpart))

export const lower = (s) => String(s ?? '').toLowerCase()

/** A unique value (email, class name, assignment+student) is already taken. */
export class DuplicateError extends Error {
  constructor(message) {
    super(message)
    this.name = 'DuplicateError'
  }
}

export const isDuplicate = (err) => err?.name === 'DuplicateError'

/** The record to update is missing, or a condition on it didn't hold. Same name as DynamoDB's error. */
export function conditionFailed(message = 'The conditional request failed') {
  const err = new Error(message)
  err.name = 'ConditionalCheckFailedException'
  return err
}

export const ROLES = ['student', 'teacher', 'admin']

/** Epoch seconds as a fixed-width string, so it sorts as text. */
export const sortableEpoch = (seconds) =>
  Number(seconds ?? 0)
    .toFixed(3)
    .padStart(16, '0')

/** ISO-8601 month ("2026-10") of an epoch-seconds timestamp. */
export const monthOf = (seconds) => new Date(Number(seconds) * 1000).toISOString().slice(0, 7)

// Every field of every record, by Postgres table (= DynamoDB attribute names).
// Both adapters refuse other fields, so they can't drift apart. `json` columns
// hold maps/lists.
export const COLUMNS = {
  users:
    'user_id email username name role account_status password_hash must_change_password school phone photo_key admin_level settings:json cognito_sub created_by created_at updated_at first_login_at last_login_at active_reset_id',
  classes: 'class_id name subject term teacher_id created_by created_at',
  class_members: 'class_id student_id member_status added_by added_at',
  assignments:
    'assignment_id qp_id class_id class_name teacher_id title due_at total_marks question_count content_status grades_status method persona partial_credit created_at questions_confirmed_at grading_started_at published_at extra:json',
  question_papers:
    'qp_id assignment_id status rubric:json rubric_source raw_s3_key parsed_s3_key rubric_s3_key upload_id presigned_url_expires_at rubric_reviewed_by rubric_reviewed_at updated_at',
  questions: 'qp_id question_number:json subpart question is_latex max_marks ocr_confidence reviewed_by reviewed_at',
  submissions:
    'submission_id assignment_id qp_id student_id status total_marks score_updated_at score_updated_by grading_mode pages raw_s3_key ocr_s3_key corrected_s3_key report_s3_key upload_id presigned_url_expires_at submitted_at graded_at published_at notified_at reminded_at recheck:json recheck_status recheck_requested_at created_at status_changed_at extra:json',
  answers:
    'answer_id submission_id question_number:json subpart status student_answer is_latex max_marks marks feedback confidence corrected_by corrected_at flag_resolved_at flag_resolved_by flag_resolution overridden_by overridden_at override_reason revision_history:json created_at updated_at extra:json',
  reset_requests:
    'request_id user_id user_name user_email role reason source status requested_at decided_by decided_at temp_pw_expires_at completed_at reject_reason',
  invites: 'token user_id full_name role class_name expires_at consumed',
  audit_log: 'event_id month ts actor_id actor_role action target_id detail:json',
  announcements: 'announcement_id class_id class_name title message author_id author_name created_at',
  content_posts: 'post_id title author date_label status',
  tickets: 'ticket_id priority subject age_label requester_name assignee_id assignee_name status',
  platform_settings: 'setting_key data:json',
  analytics_snapshots: 'metric_key data_json',
}
const parsed = Object.fromEntries(
  Object.entries(COLUMNS).map(([table, spec]) => {
    const cols = spec.split(' ').map((c) => c.split(':'))
    return [table, { all: new Set(cols.map(([c]) => c)), json: new Set(cols.filter(([, t]) => t === 'json').map(([c]) => c)) }]
  }),
)
export const jsonColumns = (table) => parsed[table].json

export function assertColumns(table, record) {
  const unknown = Object.keys(record).filter((k) => !parsed[table].all.has(k))
  if (unknown.length) throw new Error(`Unknown ${table} field(s): ${unknown.join(', ')}`)
}
