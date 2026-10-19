// /correctanswer — port of lambda_python_files/correct_questions_answer.py:
// the post-upload correction workspace.
//   Student: getAnswersForCorrection / submitAnswerCorrections (OCR'd answer text)
//   Teacher: getQuestionsForCorrection / submitQuestionCorrections (parsed question
//            text, stored once per question paper)
import { isConditionalCheckFailed, badRequest, forbidden, reply } from '../lib/errors.js'
import { isoNaive, pyStr, sortBy, truthy } from '../lib/py.js'
import { answerContext, getAssignment, ownsAssignment, paperQuestions, studentGrades } from '../repositories/gradebook.js'
import { papers, submissions } from '../repositories/index.js'

const keyStr = (v) => pyStr(truthy(v) ? v : '')
const isMissing = (v) => v === undefined || v === null

export async function getAnswersForCorrection(body, caller) {
  const { student_id: studentId, assignment_id: assignmentId, qp_id: qpId } = body
  if (!truthy(studentId) || !truthy(assignmentId)) throw badRequest('student_id and assignment_id are required')
  if (caller.role === 'student' && studentId !== caller.user_id) throw forbidden('You can only view your own answers.')

  const assignment = await getAssignment(assignmentId)
  // A teacher (not admin) may only browse a submission of their own (or an unowned) assignment.
  if (caller.role === 'teacher' && assignment && !ownsAssignment(caller, assignment)) {
    throw forbidden("This student's answers belong to a different teacher's class.")
  }
  const items = assignment && (!truthy(qpId) || assignment.qp_id === qpId) ? (await studentGrades(assignment, studentId)).entry.details : []

  const answers = items.map((item) => ({
    evaluation_id: item.evaluation_id ?? null,
    question_number: item.question_number ?? null,
    subpart: item.subpart ?? null,
    question: item.question ?? null,
    student_answer: item.student_answer ?? null,
    is_latex: item.is_latex ?? false,
    max_marks: item.max_marks ?? null,
    status: item.status ?? null,
    corrected_by: item.corrected_by ?? null,
    corrected_at: item.corrected_at ?? null,
  }))
  return {
    student_id: studentId,
    assignment_id: assignmentId,
    qp_id: qpId ?? null,
    answers: sortBy(answers, (a) => [keyStr(a.question_number), keyStr(a.subpart)]),
  }
}

/** Student submits corrected answer text; status='corrected' feeds the grading fan-in gate. */
export async function submitAnswerCorrections(body, caller) {
  if (caller.role !== 'student') throw forbidden('Only the student who owns this submission can correct it.')
  const { corrections } = body
  if (!Array.isArray(corrections) || !corrections.length) throw badRequest('corrections (non-empty array) is required')

  const updated = []
  const errors = []
  const now = isoNaive()
  for (const correction of corrections) {
    const c = correction && typeof correction === 'object' ? correction : {}
    const evaluationId = c.evaluation_id
    const questionNumber = c.question_number
    const answer = c.corrected_answer
    const isLatex = truthy(c.is_latex ?? false)

    if (!truthy(evaluationId)) {
      errors.push('Missing evaluation_id in correction')
      continue
    }
    if (isMissing(questionNumber)) {
      errors.push(`Missing question_number for evaluation_id ${evaluationId}`)
      continue
    }
    if (isMissing(answer) || pyStr(answer).trim() === '') {
      errors.push(`corrected_answer is required for evaluation_id ${evaluationId}`)
      continue
    }
    try {
      // Only the owning student may correct their own answer.
      const { answer: existing, submission } = await answerContext(evaluationId)
      if (!existing) {
        errors.push(`No record found with evaluation_id ${evaluationId}`)
        continue
      }
      if (submission?.student_id !== caller.user_id) {
        errors.push(`evaluation_id ${evaluationId} belongs to a different student.`)
        continue
      }
      await submissions.updateAnswer(
        evaluationId,
        { student_answer: pyStr(answer), is_latex: isLatex, status: 'corrected', corrected_by: caller.user_id, corrected_at: now, updated_at: now },
        { questionNumber },
      )
      updated.push({ evaluation_id: evaluationId, question_number: questionNumber, updated: true, is_latex: isLatex })
    } catch (err) {
      if (isConditionalCheckFailed(err)) errors.push(`No matching question_number ${pyStr(questionNumber)} for evaluation_id ${evaluationId}`)
      else errors.push(`Failed to correct evaluation_id ${evaluationId}: ${err?.message}`)
    }
  }

  const response = {
    message: errors.length ? 'Correction completed with some errors' : 'Correction completed',
    updated_items: updated,
    total_updated: updated.length,
    success: errors.length === 0,
  }
  if (errors.length) response.errors = errors
  if (!updated.length) {
    response.message = 'No answers were corrected'
    return reply(404, response)
  }
  return reply(errors.length ? 207 : 200, response)
}

/** The question paper's parsed questions, so the teacher reviews each one once. */
export async function getQuestionsForCorrection(body, caller) {
  if (!['teacher', 'admin'].includes(caller.role)) throw forbidden('Only a teacher or admin can review question text.')
  const { qp_id: qpId, assignment_id: assignmentId } = body
  if (!truthy(qpId) || !truthy(assignmentId)) throw badRequest('qp_id and assignment_id are required')

  const assignment = await getAssignment(assignmentId)
  if (!assignment || assignment.qp_id !== qpId || !ownsAssignment(caller, assignment)) {
    return { qp_id: qpId, assignment_id: assignmentId, questions: [] }
  }
  const questions = (await paperQuestions(assignment)).map((q) => ({
    question_number: q.question_number ?? null,
    subpart: q.subpart ?? null,
    question: q.question ?? null,
    is_latex: q.is_latex ?? false,
    max_marks: q.max_marks ?? null,
    question_reviewed: truthy(q.reviewed_at),
    question_reviewed_by: q.reviewed_by ?? null,
    question_reviewed_at: q.reviewed_at ?? null,
  }))
  return { qp_id: qpId, assignment_id: assignmentId, questions: sortBy(questions, (q) => [keyStr(q.question_number), keyStr(q.subpart)]) }
}

/** Teacher corrects question text (once per question; every student's view reads it). */
export async function submitQuestionCorrections(body, caller) {
  if (!['teacher', 'admin'].includes(caller.role)) throw forbidden('Only a teacher or admin can correct question text.')
  const { qp_id: qpId, assignment_id: assignmentId, corrections } = body
  if (!truthy(qpId) || !truthy(assignmentId)) throw badRequest('qp_id and assignment_id are required')
  if (!Array.isArray(corrections) || !corrections.length) throw badRequest('corrections (non-empty array) is required')

  const assignment = await getAssignment(assignmentId)
  // Questions of another teacher's assignment are skipped, not overwritten.
  const allowed = Boolean(assignment) && assignment.qp_id === qpId && ownsAssignment(caller, assignment)
  const now = isoNaive()
  const updatedQuestions = []
  const errors = []

  for (const correction of corrections) {
    const c = correction && typeof correction === 'object' ? correction : {}
    const questionNumber = c.question_number
    const subpart = c.subpart ?? null
    const text = c.corrected_question
    const isLatex = truthy(c.is_latex ?? false)
    if (isMissing(questionNumber)) {
      errors.push('Missing question_number in correction')
      continue
    }
    if (isMissing(text) || pyStr(text).trim() === '') {
      errors.push(`corrected_question is required for question_number ${pyStr(questionNumber)}`)
      continue
    }
    let recordsUpdated = 0
    if (allowed) {
      try {
        const updated = await papers.updateQuestions(qpId, questionNumber, truthy(subpart) ? subpart : undefined, {
          question: pyStr(text),
          is_latex: isLatex,
          reviewed_by: caller.user_id,
          reviewed_at: now,
        })
        recordsUpdated = updated.length
      } catch (err) {
        errors.push(`Failed to update question ${pyStr(questionNumber)}: ${err?.message}`)
      }
    }
    updatedQuestions.push({ question_number: questionNumber, subpart, records_updated: recordsUpdated })
  }

  const total = updatedQuestions.reduce((n, q) => n + q.records_updated, 0)
  const response = {
    message: errors.length ? 'Question correction completed with some errors' : 'Question correction completed',
    updated_questions: updatedQuestions,
    total_records_updated: total,
    success: errors.length === 0,
  }
  if (errors.length) response.errors = errors
  if (total === 0) {
    response.message = 'No question records were updated'
    return reply(404, response)
  }
  return reply(errors.length ? 207 : 200, response)
}

export const operations = {
  getAnswersForCorrection,
  submitAnswerCorrections,
  getQuestionsForCorrection,
  submitQuestionCorrections,
}
