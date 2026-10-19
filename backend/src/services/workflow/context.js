// Shared data helpers for the assignment workflow (port of workflow.py's
// "Plumbing" and "Data helpers" sections), on the data model of
// docs/database-architecture.md.
//
// A submission's status (wireframe §20 SUBMISSIONS chain) is derived from its
// answers and score (answers → ocr_done, every answer corrected → corrected, a
// score → ai_graded, an unresolved low-confidence answer → queued_for_review) and
// merged with the status the workflow records on the submission
// (grading_triggered, teacher_reviewed, published, published_revised). The
// later of the two wins.
import config from '../../config/index.js'
import { badRequest, forbidden, notFound } from '../../lib/errors.js'
import { isoUtc, num, pyMin, pyStr, sortBy, sum, truthy } from '../../lib/py.js'
import { assignments, submissions as submissionStore } from '../../repositories/index.js'
import * as gradebook from '../../repositories/gradebook.js'

export const SUBMISSION_CHAIN = [
  'upload_requested',
  'answer_uploaded',
  'ocr_done',
  'corrected',
  'grading_triggered',
  'ai_graded',
  'queued_for_review',
  'teacher_reviewed',
  'published',
  'published_revised',
]
export const RANK = Object.fromEntries(SUBMISSION_CHAIN.map((s, i) => [s, i]))
export const rank = (status) => (Object.hasOwn(RANK, status) ? RANK[status] : 0)
export const PERSONAS = ['balanced', 'strict', 'lenient']
export const AT_RISK_PERCENT = 50
export const DEFAULT_SETTINGS = { default_persona: 'balanced', partial_credit: true, notify_submissions: true, notify_flagged: true }

export const now = () => isoUtc()

/** _require: the caller must have one of these roles. */
export function requireRole(caller, ...roles) {
  if (!roles.includes(caller.role)) throw forbidden("Your role can't do that.")
}

/** _required: values of fields that must not be missing/null/empty-string. */
export function required(body, ...fields) {
  const missing = fields.filter((f) => body[f] === undefined || body[f] === null || body[f] === '')
  if (missing.length) throw badRequest(`Missing required field(s): ${missing.join(', ')}`)
  return fields.map((f) => body[f])
}

/** Assignments the caller manages (all of them for an admin), with their question papers. */
export async function myAssignments(caller) {
  const items = caller.role === 'admin' ? await assignments.listAll() : await assignments.listByTeacher(caller.user_id)
  return gradebook.withPapers(items)
}

/** Published assignments a student can see: their classes', plus any they've submitted to. */
export const visibleAssignments = (caller) => gradebook.assignmentsForStudent(caller.user_id)

export async function loadAssignment(assignmentId, caller) {
  const item = await gradebook.getAssignment(assignmentId)
  if (!item) throw notFound('Assignment not found.')
  if (caller && caller.role === 'teacher' && item.teacher_id !== caller.user_id) {
    throw forbidden('This assignment belongs to a different teacher.')
  }
  return item
}

/** Every student's grading rows for this assignment: Map<student_id, {summary, details}>. */
export const gradingRows = async (assignment) => (await gradebook.gradingGrid(assignment)).byStudent

export function isFlagged(row) {
  const conf = row.confidence
  return conf !== undefined && conf !== null && num(conf, 1) < config.grading.flagConfidence && !truthy(row.flag_resolved_at)
}

export function derivedStatus(entry) {
  const { details, summary } = entry
  if (summary !== null) return details.some(isFlagged) ? 'queued_for_review' : 'ai_graded'
  if (details.length) return details.every((r) => r.status === 'corrected') ? 'corrected' : 'ocr_done'
  return null
}

export function mergeStatus(derived, stored) {
  const candidates = [derived, stored].filter((s) => typeof s === 'string' && Object.hasOwn(RANK, s))
  if (!candidates.length) return 'upload_requested'
  const best = candidates.reduce((a, b) => (RANK[b] > RANK[a] ? b : a))
  // A paper that's flagged again after the teacher reviewed it goes back to the queue.
  if (derived === 'queued_for_review' && ['teacher_reviewed', 'grading_triggered', 'ai_graded'].includes(stored)) {
    return 'queued_for_review'
  }
  return best
}

/** Map<user_id, user> for these students. */
export const usersById = (ids) => gradebook.peopleById(ids)

/** Students enrolled in this assignment's class. */
export const enrolledStudents = (assignment) => gradebook.enrolledStudentIds(assignment)

/** The assignment's parsed questions, sorted by number. */
export async function questions(assignment) {
  const qs = (await gradebook.paperQuestions(assignment)).map((q) => ({
    question_number: q.question_number ?? null,
    subpart: q.subpart ?? null,
    question: q.question ?? null,
    max_marks: q.max_marks ?? null,
    ocr_confidence: q.ocr_confidence ?? null,
    question_reviewed: truthy(q.reviewed_at),
  }))
  return sortBy(qs, (q) => [num(q.question_number, 0), pyStr(q.subpart || '')])
}

export const marksTotal = (qs) => sum(qs.map((q) => num(q.max_marks)))

export async function assignmentView(item, byStudent) {
  const rows = byStudent ?? (await gradingRows(item))
  const qs = await questions(item)
  let qpStatus = item.qp_status ?? 'qp_uploaded'
  if (qs.length && ['upload_requested', 'qp_uploaded'].includes(qpStatus)) qpStatus = 'qp_parsed'
  let submitted = 0
  for (const entry of rows.values()) if (entry.details.length || entry.summary !== null) submitted += 1
  const view = Object.fromEntries(Object.entries(item).filter(([k]) => k !== 'rubric' && k !== 'teacher_id'))
  return {
    ...view,
    qp_status: qpStatus,
    question_count: qs.length || (item.question_count ?? null),
    total_marks: marksTotal(qs) || (item.total_marks ?? null),
    submitted,
  }
}

/** Row timestamps are epoch seconds/ms; workflow ones are ISO strings. */
export function iso(value) {
  if (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) {
    const n = Number(value)
    return isoUtc(new Date(n > 1e12 ? n : n * 1000))
  }
  return pyStr(value)
}

/** Earliest row timestamp, or '' (min over timestamp/created_at, like workflow.py). */
export const firstRowTime = (rows) => pyMin(rows.map((r) => r.timestamp || r.created_at || ''), '')

/** Roster rows for one assignment, plus the grading rows and people they were built from. */
export async function submissions(item) {
  const { byStudent, stored } = await gradebook.gradingGrid(item)
  for (const studentId of await enrolledStudents(item)) {
    if (!byStudent.has(studentId)) byStudent.set(studentId, { summary: null, details: [] })
  }
  const people = await usersById(byStudent.keys())
  const due = item.due_at
  const out = []
  for (const [studentId, entry] of byStudent) {
    const sub = stored.get(studentId) ?? {}
    const status = mergeStatus(derivedStatus(entry), sub.status)
    const rows = entry.details
    const submittedAt = sub.submitted_at || firstRowTime(rows) || null
    const row = {
      student_id: studentId,
      student_name: people.get(studentId)?.name ?? null,
      status,
      pages: sub.pages ?? null,
    }
    if (truthy(submittedAt)) {
      row.submitted_at = iso(submittedAt)
      if (truthy(due) && row.submitted_at.slice(0, 10) > pyStr(due).slice(0, 10)) row.late = true
    }
    if (entry.summary !== null) {
      row.evaluation_id = entry.summary.evaluation_id ?? null
      row.total_marks = entry.summary.total_marks ?? null
    }
    if (sub.recheck_status === 'open') row.recheck = sub.recheck ?? null
    const confs = rows.filter((r) => r.confidence !== undefined && r.confidence !== null).map((r) => num(r.confidence))
    if (confs.length) row.confidence = Math.min(...confs)
    out.push(row)
  }
  return { subs: sortBy(out, (r) => (r.student_name || r.student_id).toLowerCase()), byStudent, users: people }
}

/** Records a workflow status on the student's submission (creating it if needed). */
export async function putSubmissionStatus(assignment, studentId, status, extra = {}) {
  const sub = await gradebook.ensureSubmission(assignment, studentId)
  await submissionStore.update(sub.submission_id, { status, status_changed_at: now(), ...extra })
}

export const userSettings = (user) => ({ ...DEFAULT_SETTINGS, ...(truthy(user.settings) ? user.settings : {}) })
