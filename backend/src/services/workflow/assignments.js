// Teacher: create assignment → review parsed questions → choose AI or standard
// grading → rubric → verify → start grading (wireframe §13).
import { triggerGrading } from '../../aws/lambda.js'
import { badRequest, conflict } from '../../lib/errors.js'
import { num, pyStr, sortBy, trunc, truthy } from '../../lib/py.js'
import { classNamed, createAssignment as storeAssignment, shortId, updateAssignment } from '../../repositories/gradebook.js'
import { enqueueJob } from '../jobs.service.js'
import {
  PERSONAS,
  assignmentView,
  derivedStatus,
  enrolledStudents,
  gradingRows,
  loadAssignment,
  marksTotal,
  myAssignments,
  now,
  putSubmissionStatus,
  questions,
  required,
  requireRole,
  userSettings,
} from './context.js'

export async function listAssignments(body, caller) {
  requireRole(caller, 'teacher', 'admin')
  const items = await myAssignments(caller)
  const out = []
  for (const item of sortBy(items, (a) => a.created_at ?? '', { reverse: true })) {
    const view = await assignmentView(item)
    const enrolled = (await enrolledStudents(item)).length
    if (enrolled) view.enrolled = enrolled
    out.push(view)
  }
  return { assignments: out }
}

export async function getAssignment(body, caller) {
  requireRole(caller, 'teacher', 'admin')
  const [assignmentId] = required(body, 'assignment_id')
  const item = await loadAssignment(assignmentId, caller)
  const view = await assignmentView(item)
  const enrolled = (await enrolledStudents(item)).length
  if (enrolled) view.enrolled = enrolled
  return view
}

export async function createAssignment(body, caller) {
  requireRole(caller, 'teacher', 'admin')
  const [title, className] = required(body, 'title', 'class_name')
  const assignmentId = `A-${shortId()}`
  const cls = await classNamed(trunc(pyStr(className), 100), { teacherId: caller.role === 'teacher' ? caller.user_id : undefined, by: caller.user_id })
  const item = {
    assignment_id: assignmentId,
    qp_id: `QP-${shortId()}`,
    title: trunc(pyStr(title), 200),
    class_id: cls.class_id,
    class_name: cls.name,
    teacher_id: caller.user_id,
    qp_status: 'qp_uploaded',
    content_status: 'published',
    grades_status: 'not_started',
    created_at: now(),
  }
  if (truthy(body.due_at)) item.due_at = pyStr(body.due_at)
  await storeAssignment(item)
  return { assignment_id: assignmentId, qp_id: item.qp_id }
}

export async function getParsedQuestions(body, caller) {
  requireRole(caller, 'teacher', 'admin')
  const [assignmentId] = required(body, 'assignment_id')
  const item = await loadAssignment(assignmentId, caller)
  const qs = await questions(item)
  return {
    qp_status: qs.length ? 'qp_parsed' : (item.qp_status ?? 'qp_uploaded'),
    questions: qs,
    paper_total: marksTotal(qs),
  }
}

export async function confirmQuestions(body, caller) {
  requireRole(caller, 'teacher', 'admin')
  const [assignmentId] = required(body, 'assignment_id')
  const item = await loadAssignment(assignmentId, caller)
  const qs = await questions(item)
  if (!qs.length) throw conflict('No parsed questions yet — they appear once the first answers are processed.')
  await updateAssignment(item, {
    questions_confirmed_at: now(),
    question_count: qs.length,
    total_marks: marksTotal(qs),
    ...(['upload_requested', 'qp_uploaded'].includes(item.qp_status) ? { qp_status: 'qp_parsed' } : {}),
  })
  return { ok: true }
}

export async function setGradingMethod(body, caller) {
  requireRole(caller, 'teacher', 'admin')
  const [assignmentId, method] = required(body, 'assignment_id', 'method')
  if (method !== 'ai' && method !== 'standard') throw badRequest("method must be 'ai' or 'standard'.")
  const item = await loadAssignment(assignmentId, caller)
  const defaults = userSettings(caller.user)
  const persona = [body.persona, item.persona, defaults.default_persona].find(truthy) ?? defaults.default_persona
  if (!PERSONAS.includes(persona)) throw badRequest(`persona must be one of ${PERSONAS.join(', ')}.`)
  const partial = Object.hasOwn(body, 'partial_credit')
    ? truthy(body.partial_credit)
    : Object.hasOwn(item, 'partial_credit')
      ? truthy(item.partial_credit)
      : defaults.partial_credit

  const changedMethod = item.method !== method
  let status = item.qp_status ?? 'qp_parsed'
  const fields = { method, persona, partial_credit: partial }
  if (changedMethod) {
    // A new method means a new rubric: AI drafts one in the background,
    // standard starts from the questions for the teacher to fill in.
    status = method === 'ai' ? 'rubric_generating' : 'rubric_generated'
    Object.assign(fields, { qp_status: status, rubric: null })
  }
  await updateAssignment(item, fields)
  if (changedMethod && method === 'ai') await enqueueJob({ type: 'draftRubric', assignment_id: assignmentId })
  return { qp_status: status }
}

export function defaultRubric(qs) {
  return qs.map((q) => ({
    question_number: q.question_number,
    subpart: q.subpart ?? null,
    title: trunc(q.question || '', 80),
    max_marks: num(q.max_marks),
    criteria: '',
  }))
}

export async function getRubric(body, caller) {
  requireRole(caller, 'teacher', 'admin')
  const [assignmentId] = required(body, 'assignment_id')
  const item = await loadAssignment(assignmentId, caller)
  const status = item.qp_status ?? null
  if (truthy(item.rubric)) return { qp_status: status, rubric: item.rubric }
  if (status === 'rubric_generating') return { qp_status: status, rubric: [] }
  return { qp_status: status, rubric: defaultRubric(await questions(item)) }
}

export async function approveRubric(body, caller) {
  requireRole(caller, 'teacher', 'admin')
  const [assignmentId, rubric] = required(body, 'assignment_id', 'rubric')
  const item = await loadAssignment(assignmentId, caller)
  if (!Array.isArray(rubric) || !rubric.length) throw badRequest('rubric must be a non-empty list.')
  const clean = rubric.map((r) => {
    if (!r || typeof r !== 'object' || Array.isArray(r) || r.question_number === undefined || r.question_number === null || r.question_number === '') {
      throw badRequest('Every rubric item needs a question_number.')
    }
    const marks = num(r.max_marks, -1)
    if (!(marks >= 0)) throw badRequest(`Invalid max_marks for Q${pyStr(r.question_number)}.`)
    // (subpart is dropped when empty, as workflow.py's _to_dynamo did.)
    const entry = {
      question_number: r.question_number,
      title: trunc(pyStr(truthy(r.title) ? r.title : ''), 200),
      max_marks: marks,
      criteria: trunc(pyStr(truthy(r.criteria) ? r.criteria : ''), 4000),
    }
    if (truthy(r.subpart)) entry.subpart = r.subpart
    return entry
  })
  await updateAssignment(item, { rubric: clean, qp_status: 'rubric_reviewed', rubric_reviewed_at: now(), rubric_reviewed_by: caller.user_id })
  return { qp_status: 'rubric_reviewed' }
}

/** Teacher side of the fan-in gate: every corrected submission is graded now. */
export async function startGrading(body, caller) {
  requireRole(caller, 'teacher', 'admin')
  const [assignmentId] = required(body, 'assignment_id')
  const item = await loadAssignment(assignmentId, caller)
  if (item.qp_status !== 'rubric_reviewed') throw conflict('Approve the rubric before grading starts.')
  const byStudent = await gradingRows(item)
  let triggered = 0
  for (const [studentId, entry] of byStudent) {
    if (derivedStatus(entry) !== 'corrected') continue
    await putSubmissionStatus(item, studentId, 'grading_triggered')
    await triggerGrading({
      assignment_id: item.assignment_id,
      qp_id: item.qp_id,
      student_id: studentId,
      method: item.method ?? null,
      persona: item.persona ?? 'balanced',
      partial_credit: item.partial_credit ?? true,
      rubric: item.rubric ?? [],
    })
    triggered += 1
  }
  const fields = { grading_started_at: now() }
  // Re-grading after publish keeps the assignment "published"; students keep
  // their grades until the teacher publishes again (→ published_revised).
  if (item.grades_status !== 'published') fields.grades_status = triggered ? 'teacher_reviewing' : 'ai_graded'
  await updateAssignment(item, fields)
  return { ok: true, triggered }
}
