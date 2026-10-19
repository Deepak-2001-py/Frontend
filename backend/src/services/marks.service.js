// /updatedb — port of lambda_python_files/update_db.py: teacher/admin edits
// to marks. Each change records who made it (score_updated_by / overridden_by,
// plus the answer's revision history); a teacher can't change marks on another
// teacher's assignment (admins excepted).
import { isConditionalCheckFailed, badRequest, forbidden, notFound, reply, HttpError } from '../lib/errors.js'
import { isoNaive, pyStr, truthy } from '../lib/py.js'
import { conditionFailed } from '../repositories/common.js'
import { answerContext, ownsAssignment, summaryRow } from '../repositories/gradebook.js'
import { assignments, submissions } from '../repositories/index.js'

/** Decimal(str(value)): a finite number, or throws like Python's Decimal would. */
function decimal(value) {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN
  if (!Number.isFinite(n)) throw Object.assign(new Error(`Invalid number: ${pyStr(value)}`), { name: 'ValueError' })
  return n
}

/** The submission (summary) for this evaluation_id and its assignment, if any. */
async function summaryContext(evaluationId) {
  const submission = truthy(evaluationId) ? await submissions.get(evaluationId) : undefined
  const assignment = submission ? await assignments.get(submission.assignment_id) : undefined
  return { submission, assignment }
}

export async function updateMarks(body, caller) {
  if (!['teacher', 'admin'].includes(caller.role)) throw forbidden('Only a teacher or admin can update grades.')
  const summaryRaw = body.summary
  const details = Array.isArray(body.details) ? body.details : []
  if (!truthy(summaryRaw) && !details.length) throw badRequest('Either summary or details data is required')

  const updated = []
  const errors = []

  // Summary: the frontend sends a one-element array; only [0] is applied (as before).
  // A details-only request skips this step (update_db.py crashed with a 500 there).
  const summary = Array.isArray(summaryRaw) ? summaryRaw[0] : undefined
  if (Array.isArray(summaryRaw) ? summaryRaw.length : truthy(summaryRaw)) {
    const evaluationId = summary?.evaluation_id
    try {
      if (!summary || typeof summary !== 'object') throw new Error('summary must be a list of objects')
      const totalMarks = decimal(summary.total_marks)
      if (!truthy(evaluationId)) throw new Error('Missing evaluation_id in summary record')
      const { submission, assignment } = await summaryContext(evaluationId)
      if (!submission) throw conditionFailed()
      if (!ownsAssignment(caller, assignment)) {
        errors.push(`evaluation_id ${evaluationId} belongs to a different teacher.`)
      } else {
        await submissions.update(evaluationId, { total_marks: totalMarks, score_updated_at: isoNaive(), score_updated_by: caller.user_id })
        updated.push({
          type: 'summary',
          evaluation_id: evaluationId,
          updated: true,
          total_marks: totalMarks,
          student_id: summary.student_id ?? null,
          assignment_id: summary.assignment_id ?? null,
          qp_id: summary.qp_id ?? null,
        })
      }
    } catch (err) {
      if (isConditionalCheckFailed(err)) errors.push(`No summary record found with evaluation_id ${pyStr(evaluationId)}`)
      else if (err?.name === 'ValueError') errors.push(`Invalid total_marks value for evaluation_id ${pyStr(evaluationId)}: ${err.message}`)
      else errors.push(`Failed to update summary for evaluation_id ${pyStr(evaluationId)}: ${err?.message}`)
    }
  }

  for (const record of details) {
    const d = record && typeof record === 'object' ? record : {}
    const { evaluation_id: evaluationId, question_number: questionNumber, subpart, marks, max_marks: maxMarks } = d
    try {
      if (!truthy(evaluationId)) {
        errors.push('Missing evaluation_id in detail record')
        continue
      }
      if (questionNumber === undefined || questionNumber === null) {
        errors.push(`Missing question_number for evaluation_id ${evaluationId}`)
        continue
      }
      if (marks === undefined || marks === null) {
        errors.push(`Missing marks for evaluation_id ${evaluationId}`)
        continue
      }
      const marksValue = decimal(marks)
      const { answer, assignment } = await answerContext(evaluationId)
      if (!answer) throw conditionFailed()
      if (!ownsAssignment(caller, assignment)) {
        errors.push(`evaluation_id ${evaluationId} belongs to a different teacher.`)
        continue
      }
      const hasMax = maxMarks !== undefined && maxMarks !== null
      const now = isoNaive()
      const fields = { marks: marksValue, updated_at: now, overridden_by: caller.user_id, overridden_at: now }
      if (hasMax) fields.max_marks = decimal(maxMarks)
      const change = { at: now, by: caller.user_id, marks: answer.marks ?? null, max_marks: answer.max_marks ?? null }
      fields.revision_history = [...(Array.isArray(answer.revision_history) ? answer.revision_history : []), change]
      await submissions.updateAnswer(evaluationId, fields, { questionNumber })
      const row = {
        type: 'details',
        evaluation_id: evaluationId,
        updated: true,
        marks: marksValue,
        question_number: pyStr(questionNumber),
        subpart: subpart ?? null,
      }
      if (hasMax) row.max_marks = fields.max_marks
      updated.push(row)
    } catch (err) {
      if (isConditionalCheckFailed(err)) {
        errors.push(
          `No detail record found with evaluation_id ${evaluationId}, question_number ${pyStr(questionNumber)}, subpart ${pyStr(subpart)}`,
        )
      } else if (err?.name === 'ValueError') {
        errors.push(`Invalid marks value for evaluation_id ${pyStr(evaluationId)}: ${err.message}`)
      } else {
        errors.push(`Failed to update details for evaluation_id ${pyStr(evaluationId)}: ${err?.message}`)
      }
    }
  }

  const response = {
    message: 'Update completed',
    updated_items: updated,
    total_updated: updated.length,
    success: errors.length === 0,
    records_processed: { summary: 1, details: details.length },
  }
  if (errors.length) {
    response.errors = errors
    response.message = 'Update completed with some errors'
  }
  if (!updated.length) {
    response.message = 'No records were updated'
    return reply(404, response)
  }
  return reply(errors.length ? 207 : 200, response)
}

/** Total marks only, by evaluation_id; summary rows only. */
export async function updateStudentGrade(body, caller) {
  if (!['teacher', 'admin'].includes(caller.role)) throw forbidden('Only a teacher or admin can update grades.')
  const { evaluation_id: evaluationId, total_marks: totalMarks } = body
  if (!truthy(evaluationId)) throw badRequest('evaluation_id is required')
  if (totalMarks === undefined || totalMarks === null) throw badRequest('total_marks is required')

  const { submission, assignment } = await summaryContext(evaluationId)
  if (submission && !ownsAssignment(caller, assignment)) throw forbidden('This assignment belongs to a different teacher.')
  let value
  try {
    value = decimal(totalMarks)
  } catch (err) {
    throw badRequest(`Invalid number format: ${err.message}`)
  }
  try {
    if (!submission) throw conditionFailed()
    const updated = await submissions.update(evaluationId, { total_marks: value, score_updated_at: isoNaive(), score_updated_by: caller.user_id })
    return {
      message: 'Total marks updated successfully',
      evaluation_id: evaluationId,
      updated_attributes: summaryRow(updated, assignment) ?? {},
      total_marks: value,
    }
  } catch (err) {
    if (isConditionalCheckFailed(err)) throw notFound(`No summary record found with evaluation_id ${evaluationId}`)
    throw new HttpError(500, `Database error: ${err?.name ?? 'Error'}`)
  }
}

export const operations = { updateMarks, updateStudentGrade }
