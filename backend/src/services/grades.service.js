// /getgrades — port of lambda_python_files/get_grades.py.
//   getSingleStudentGrade   a student may only read their own grades
//   getAllStudentGrades     class roster, teacher/admin only
//   updateStudentGrade      total marks, teacher/admin only
// A teacher may only see or change grades of assignments they own (or that have no owner).
import { badRequest, forbidden, notFound } from '../lib/errors.js'
import { isoUtc, truthy } from '../lib/py.js'
import { getAssignment, gradingGrid, ownsAssignment, studentGrades, summaryRow } from '../repositories/gradebook.js'
import { assignments, submissions } from '../repositories/index.js'

export async function getSingleStudentGrade(body, caller) {
  const { student_id: studentId, assignment_id: assignmentId } = body
  if (!truthy(studentId) || !truthy(assignmentId)) throw badRequest('Missing required parameters: student_id and assignment_id')
  if (caller.role === 'student' && studentId !== caller.user_id) throw forbidden('You can only view your own grades.')

  const assignment = await getAssignment(assignmentId)
  if (!assignment) return { student_id: studentId, assignment_id: assignmentId, details: [], summary: [] }
  if (caller.role === 'teacher' && !ownsAssignment(caller, assignment)) {
    throw forbidden("This student's results belong to a different teacher's class.")
  }
  const { entry } = await studentGrades(assignment, studentId)
  // (The field names are swapped relative to their contents, as the frontend expects.)
  return { student_id: studentId, assignment_id: assignmentId, details: entry.details, summary: entry.summary ? [entry.summary] : [] }
}

export async function getAllStudentGrades(body, caller) {
  if (!['teacher', 'admin'].includes(caller.role)) throw forbidden('Only a teacher or admin can view a class roster.')
  const { qp_id: qpId, assignment_id: assignmentId } = body
  if (!truthy(qpId) || !truthy(assignmentId)) throw badRequest('Missing required parameters: qp_id and assignment_id')

  const assignment = await getAssignment(assignmentId)
  let grades = []
  if (assignment && assignment.qp_id === qpId && ownsAssignment(caller, assignment)) {
    const { byStudent } = await gradingGrid(assignment)
    grades = [...byStudent.values()].map((e) => e.summary).filter(Boolean)
  }
  return { qp_id: qpId, assignment_id: assignmentId, student_count: grades.length, grades }
}

export async function updateStudentGrade(body, caller) {
  if (!['teacher', 'admin'].includes(caller.role)) throw forbidden('Only a teacher or admin can update grades.')
  const { student_id: studentId, qp_id: qpId, total_marks: totalMarks } = body
  if (![studentId, qpId, totalMarks].every(truthy)) {
    throw badRequest('student_id, qp_id, type, and total_marks are required')
  }
  const score = Number(totalMarks)
  if (!Number.isFinite(score)) throw badRequest('total_marks must be a number')
  const graded = (await submissions.listByStudent(studentId)).filter((s) => s.total_marks !== undefined && s.total_marks !== null)
  const owners = new Map((await assignments.getMany(graded.map((s) => s.assignment_id))).map((a) => [a.assignment_id, a]))
  const rows = graded.map((s) => summaryRow(s, owners.get(s.assignment_id)))
  const sub = graded.find((s) => s.qp_id === qpId)
  // (get_grades.py returned nothing here, which API Gateway turned into a 502.)
  if (!sub) throw notFound('No summary record found for that student and question paper.')
  if (!ownsAssignment(caller, owners.get(sub.assignment_id))) throw forbidden('This assignment belongs to a different teacher.')

  await submissions.update(sub.submission_id, { total_marks: score, score_updated_at: isoUtc(), score_updated_by: caller.user_id })
  // Same (pre-update) rows the Python handler echoed back.
  return { message: 'Total marks updated successfully', updatedAttributes: rows }
}

export const operations = { getSingleStudentGrade, getAllStudentGrades, updateStudentGrade }
