// Teacher: grading run, spot-check, publish, roster and reminders (wireframes §15, §19).
import { sendEmail } from '../../aws/ses.js'
import { publishNotification } from '../../aws/sns.js'
import config from '../../config/index.js'
import { conflict, forbidden, notFound } from '../../lib/errors.js'
import { num, pyStr, sortBy, trunc, truthy } from '../../lib/py.js'
import { answerContext, ensureSubmission, ownsAssignment, updateAssignment } from '../../repositories/gradebook.js'
import { submissions as submissionStore, users } from '../../repositories/index.js'
import {
  enrolledStudents,
  gradingRows,
  isFlagged,
  loadAssignment,
  now,
  putSubmissionStatus,
  required,
  requireRole,
  submissions,
  usersById,
} from './context.js'

export async function getGradingRun(body, caller) {
  requireRole(caller, 'teacher', 'admin')
  const [assignmentId] = required(body, 'assignment_id')
  const item = await loadAssignment(assignmentId, caller)
  const { subs } = await submissions(item)
  const counts = {}
  for (const s of subs) counts[s.status] = (counts[s.status] ?? 0) + 1
  return { total: subs.length, counts, submissions: subs }
}

export async function listSubmissions(body, caller) {
  requireRole(caller, 'teacher', 'admin')
  const [assignmentId] = required(body, 'assignment_id')
  const item = await loadAssignment(assignmentId, caller)
  const { subs } = await submissions(item)
  return { submissions: subs, enrolled: (await enrolledStudents(item)).length || subs.length }
}

const rubricKey = (questionNumber, subpart) => JSON.stringify([pyStr(questionNumber), subpart || ''])

export async function listFlagged(body, caller) {
  requireRole(caller, 'teacher', 'admin')
  const [assignmentId] = required(body, 'assignment_id')
  const item = await loadAssignment(assignmentId, caller)
  const byStudent = await gradingRows(item)
  const people = await usersById(byStudent.keys())
  const rubric = new Map((Array.isArray(item.rubric) ? item.rubric : []).map((r) => [rubricKey(r.question_number, r.subpart), r]))
  const items = []
  for (const [studentId, entry] of byStudent) {
    if (entry.summary === null) continue
    for (const r of entry.details) {
      if (!isFlagged(r)) continue
      items.push({
        evaluation_id: r.evaluation_id,
        student_id: studentId,
        student_name: people.get(studentId)?.name ?? null,
        question_number: r.question_number ?? null,
        subpart: r.subpart ?? null,
        confidence: num(r.confidence),
        reference_answer: rubric.get(rubricKey(r.question_number, r.subpart))?.criteria || null,
        student_answer: r.student_answer ?? null,
        proposed_marks: num(r.marks),
        max_marks: num(r.max_marks),
      })
    }
  }
  return { items: sortBy(items, (f) => f.confidence) }
}

export async function acceptFlagged(body, caller) {
  requireRole(caller, 'teacher', 'admin')
  const [evaluationId] = required(body, 'evaluation_id')
  const { answer, assignment } = await answerContext(evaluationId)
  if (!answer) throw notFound('Answer not found.')
  if (!ownsAssignment(caller, assignment)) throw forbidden('This answer belongs to a different teacher.')
  await submissionStore.updateAnswer(evaluationId, { flag_resolved_at: now(), flag_resolved_by: caller.user_id, flag_resolution: 'accepted' })
  return { ok: true }
}

export async function publishGrades(body, caller) {
  requireRole(caller, 'teacher', 'admin')
  const [assignmentId] = required(body, 'assignment_id')
  const item = await loadAssignment(assignmentId, caller)
  const { subs } = await submissions(item)
  if (subs.some((s) => s.status === 'queued_for_review')) throw conflict('Clear the flagged answers before publishing.')
  if (subs.some((s) => s.status === 'grading_triggered' || s.status === 'corrected')) throw conflict('Some papers are still grading.')
  const at = now()
  const published = []
  for (const s of subs) {
    if (s.total_marks === undefined || s.total_marks === null) continue
    const status = s.status === 'published' || s.status === 'published_revised' ? 'published_revised' : 'published'
    await putSubmissionStatus(item, s.student_id, status, { published_at: at })
    published.push(s.student_id)
  }
  if (!published.length) throw conflict('No graded papers to publish yet.')
  await updateAssignment(item, { grades_status: 'published', published_at: at })
  await publishNotification({
    subject: trunc(`Grades published: ${item.title ?? assignmentId}`, 100),
    message: JSON.stringify({ assignment_id: assignmentId, student_ids: published }),
  })
  return { notified: published.length }
}

export async function remindStudent(body, caller) {
  requireRole(caller, 'teacher', 'admin')
  const [assignmentId, studentId] = required(body, 'assignment_id', 'student_id')
  const item = await loadAssignment(assignmentId, caller)
  const student = await users.get(studentId)
  if (!student || student.role !== 'student') throw notFound('Student not found.')
  const sender = config.mail.sesSenderEmail
  let emailed = false
  if (sender && truthy(student.email)) {
    const due = truthy(item.due_at) ? ` It's due ${pyStr(item.due_at).slice(0, 10)}.` : ''
    await sendEmail({
      from: sender,
      to: student.email,
      subject: `Reminder: ${pyStr(Object.hasOwn(item, 'title') ? item.title : 'assignment')}`,
      text: `Hi ${student.name || ''},\n\nPlease submit your answers for "${pyStr(item.title ?? null)}" (${pyStr(item.class_name ?? null)}).${due}\n\n— GradeAnt`,
    })
    emailed = true
  }
  const sub = await ensureSubmission(item, studentId, { status: 'upload_requested' })
  await submissionStore.update(sub.submission_id, { reminded_at: now(), ...(sub.status ? {} : { status: 'upload_requested' }) })
  return { ok: true, emailed }
}
