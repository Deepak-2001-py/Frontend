// The records the services work with, assembled from the data model:
//   - an assignment record = assignment + its question paper (qp_status, rubric)
//   - per student, a "summary" row (the graded submission) and "detail" rows (one
//     per answer, with the question text), in the shape the grading API has always
//     returned (evaluation_id, type, question, marks, …)
// Works the same on DynamoDB and Postgres.
import { randomUUID } from 'node:crypto'
import { isoUtc, truthy } from '../lib/py.js'
import { compact, isDuplicate, qKey, spKey } from './common.js'
import { assignments, classes, papers, submissions, users } from './index.js'

export const shortId = () => randomUUID().replace(/-/g, '').slice(0, 10)

/** ISO timestamp → epoch seconds (the old rows' `timestamp`). */
function epoch(iso) {
  if (!iso) return undefined
  const text = /(Z|[+-]\d{2}:\d{2})$/.test(iso) ? iso : `${iso}Z`
  const ms = Date.parse(text)
  return Number.isFinite(ms) ? ms / 1000 : undefined
}

// ---- assignments ------------------------------------------------------------------------

// Assignment-record fields stored on the question paper.
const PAPER_FIELDS = {
  qp_status: 'status',
  rubric: 'rubric',
  rubric_reviewed_at: 'rubric_reviewed_at',
  rubric_reviewed_by: 'rubric_reviewed_by',
}

export function assignmentRecord(a, paper) {
  if (!a) return undefined
  const { extra, ...rest } = a
  return compact({
    ...(extra ?? {}),
    ...rest,
    qp_status: paper?.status,
    rubric: paper?.rubric,
    rubric_reviewed_at: paper?.rubric_reviewed_at,
    rubric_reviewed_by: paper?.rubric_reviewed_by,
  })
}

export async function getAssignment(assignmentId) {
  const a = await assignments.get(assignmentId)
  return a && assignmentRecord(a, await papers.get(a.qp_id))
}

export const withPapers = (list) => Promise.all(list.map(async (a) => assignmentRecord(a, await papers.get(a.qp_id))))

/** Creates the assignment and its question paper (`qp_status` is the paper's status). */
export async function createAssignment({ qp_status: qpStatus, ...a }) {
  await assignments.create(a)
  await papers.create({ qp_id: a.qp_id, assignment_id: a.assignment_id, status: qpStatus, updated_at: a.created_at })
}

/**
 * Updates an assignment record: paper fields go to the question paper. With
 * `ifQpStatus`, the paper must still be in that status (else
 * ConditionalCheckFailedException and nothing changes).
 */
export async function updateAssignment(item, fields, { ifQpStatus } = {}) {
  const paperFields = {}
  const own = {}
  for (const [k, v] of Object.entries(fields)) {
    if (Object.hasOwn(PAPER_FIELDS, k)) paperFields[PAPER_FIELDS[k]] = v
    else own[k] = v
  }
  if (Object.keys(paperFields).length || ifQpStatus) {
    await papers.update(item.qp_id, { ...paperFields, updated_at: isoUtc() }, { ifStatus: ifQpStatus })
  }
  if (Object.keys(own).length) await assignments.update(item.assignment_id, own)
}

/** The parsed questions of an assignment's paper, sorted by key. */
export const paperQuestions = (a) => papers.questions(a.qp_id)

// ---- classes ---------------------------------------------------------------------------

/** The class with this name, created (owned by `teacherId`) if it doesn't exist yet. */
export async function classNamed(name, { teacherId, by } = {}) {
  const existing = await classes.getByName(name)
  if (existing) return existing
  try {
    return await classes.create({
      class_id: `C-${shortId()}`,
      name,
      teacher_id: teacherId,
      created_by: by,
      created_at: isoUtc(),
    })
  } catch (err) {
    if (isDuplicate(err)) return classes.getByName(name)
    throw err
  }
}

/** Students currently enrolled in the assignment's class. */
export async function enrolledStudentIds(a) {
  if (!a.class_id) return []
  return (await classes.members(a.class_id)).filter((m) => m.member_status === 'enrolled').map((m) => m.student_id)
}

/** Classes the student is enrolled in. */
export async function studentClasses(studentId) {
  const memberships = (await classes.memberships(studentId)).filter((m) => m.member_status === 'enrolled')
  return classes.getMany(memberships.map((m) => m.class_id))
}

/** Published assignments of the student's classes, plus any they have a submission for. */
export async function assignmentsForStudent(studentId) {
  const mine = await studentClasses(studentId)
  const byId = new Map()
  for (const list of await Promise.all(mine.map((c) => assignments.listByClass(c.class_id)))) {
    for (const a of list) byId.set(a.assignment_id, a)
  }
  const submitted = (await submissions.listByStudent(studentId)).map((s) => s.assignment_id).filter((id) => !byId.has(id))
  for (const a of await assignments.getMany(submitted)) byId.set(a.assignment_id, a)
  return [...byId.values()].filter((a) => a.content_status === 'published').map((a) => assignmentRecord(a))
}

// ---- grading rows --------------------------------------------------------------------

const questionKey = (x) => `${qKey(x.question_number)}\u0000${spKey(x.subpart)}`

/** One answer as a detail row (with its question's text), as the API returns it. */
export function detailRow(answer, sub, a, question) {
  return compact({
    ...(answer.extra ?? {}),
    evaluation_id: answer.answer_id,
    student_id: sub.student_id,
    assignment_id: sub.assignment_id,
    qp_id: sub.qp_id ?? a?.qp_id,
    type: answer.extra?.type ?? 'detail',
    question_number: answer.question_number,
    subpart: answer.subpart,
    question: question?.question,
    question_is_latex: question?.is_latex,
    question_confidence: question?.ocr_confidence,
    question_reviewed_by: question?.reviewed_by,
    question_reviewed_at: question?.reviewed_at,
    max_marks: answer.max_marks,
    marks: answer.marks,
    student_answer: answer.student_answer,
    is_latex: answer.is_latex,
    feedback: answer.feedback,
    confidence: answer.confidence,
    status: answer.status,
    corrected_by: answer.corrected_by,
    corrected_at: answer.corrected_at,
    flag_resolved_at: answer.flag_resolved_at,
    flag_resolved_by: answer.flag_resolved_by,
    flag_resolution: answer.flag_resolution,
    teacher_id: a?.teacher_id,
    timestamp: epoch(answer.created_at),
    updated_at: answer.updated_at,
  })
}

/** A graded submission as a summary row (null until it has a score). */
export function summaryRow(sub, a) {
  if (sub.total_marks === undefined || sub.total_marks === null) return null
  return compact({
    ...(sub.extra ?? {}),
    evaluation_id: sub.submission_id,
    student_id: sub.student_id,
    assignment_id: sub.assignment_id,
    qp_id: sub.qp_id ?? a?.qp_id,
    type: 'summary',
    total_marks: sub.total_marks,
    teacher_id: a?.teacher_id,
    timestamp: epoch(sub.graded_at),
    updated_at: sub.score_updated_at,
  })
}

function entryFor(sub, answers, a, questionsByKey) {
  return {
    summary: summaryRow(sub, a),
    details: answers.map((ans) => detailRow(ans, sub, a, questionsByKey.get(questionKey(ans)))),
  }
}

const indexQuestions = (qs) => new Map(qs.map((q) => [questionKey(q), q]))

/**
 * The whole grading grid of an assignment:
 *   byStudent  Map<student_id, { summary, details }> — students with answers or a score
 *   stored     Map<student_id, submission>           — every submission record
 */
export async function gradingGrid(a) {
  const [grid, qs] = await Promise.all([submissions.grid(a.assignment_id), paperQuestions(a)])
  const questionsByKey = indexQuestions(qs)
  const answersBySub = new Map()
  for (const ans of grid.answers) {
    if (!answersBySub.has(ans.submission_id)) answersBySub.set(ans.submission_id, [])
    answersBySub.get(ans.submission_id).push(ans)
  }
  const byStudent = new Map()
  const stored = new Map()
  for (const sub of grid.submissions) {
    stored.set(sub.student_id, sub)
    const entry = entryFor(sub, answersBySub.get(sub.submission_id) ?? [], a, questionsByKey)
    if (entry.details.length || entry.summary !== null) byStudent.set(sub.student_id, entry)
  }
  return { byStudent, stored }
}

/** One student's submission record and { summary, details } for an assignment. */
export async function studentGrades(a, studentId) {
  const sub = await submissions.getFor(a.assignment_id, studentId)
  if (!sub) return { sub: undefined, entry: { summary: null, details: [] } }
  const [answers, qs] = await Promise.all([submissions.answers(sub.submission_id), paperQuestions(a)])
  return { sub, entry: entryFor(sub, answers, a, indexQuestions(qs)) }
}

/** The submission for (assignment, student), created if there isn't one yet. */
export async function ensureSubmission(a, studentId, initial = {}) {
  const existing = await submissions.getFor(a.assignment_id, studentId)
  if (existing) return existing
  try {
    return await submissions.create({
      submission_id: `SUB-${shortId()}`,
      assignment_id: a.assignment_id,
      qp_id: a.qp_id,
      student_id: studentId,
      created_at: isoUtc(),
      ...initial,
    })
  } catch (err) {
    if (isDuplicate(err)) return submissions.getFor(a.assignment_id, studentId)
    throw err
  }
}

/** An answer (by its evaluation_id) with its submission and assignment. */
export async function answerContext(answerId) {
  const answer = truthy(answerId) ? await submissions.getAnswer(answerId) : undefined
  if (!answer) return {}
  const submission = await submissions.get(answer.submission_id)
  const assignment = submission ? await assignments.get(submission.assignment_id) : undefined
  return { answer, submission, assignment }
}

/** Map<user_id, user> for these ids. */
export async function peopleById(ids) {
  return new Map((await users.getMany([...ids])).map((u) => [u.user_id, u]))
}

/** A teacher may act on an assignment they own, or one with no owner; admins on any. */
export const ownsAssignment = (caller, a) => caller.role === 'admin' || !a?.teacher_id || a.teacher_id === caller.user_id
