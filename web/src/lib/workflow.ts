import { WORKFLOW_PATH } from '../config'
import { apiRequest } from './api'
import { apiCache } from './apiCache'
import type { ContentStatus, GradesStatus, QpStatus, SubmissionStatus } from './status'

/**
 * Assignment workflow API (wireframes §13–§15, §19, §20, §04): one resource
 * dispatching on `operation`, like /admin and /getgrades. Reads are cached per
 * exact query; any write clears every cached workflow read.
 *
 * The operation names and payloads below are the contract the screens are
 * built against — see web/WIREFRAMES.md "Workflow API".
 */

export type GradingMethod = 'ai' | 'standard'
export type Persona = 'balanced' | 'strict' | 'lenient'

export interface Assignment {
  assignment_id: string
  qp_id: string
  title: string
  class_name?: string
  due_at?: string
  question_count?: number
  total_marks?: number
  method?: GradingMethod
  qp_status?: QpStatus
  content_status?: ContentStatus
  grades_status?: GradesStatus
  submitted?: number
  enrolled?: number
}

export interface ParsedQuestion {
  question_number: string | number
  subpart?: string
  question?: string
  max_marks?: number
  ocr_confidence?: number
  question_reviewed?: boolean
}

export interface RubricItem {
  question_number: string | number
  subpart?: string
  title?: string
  max_marks: number
  criteria?: string
}

export interface Submission {
  student_id: string
  student_name?: string
  status: SubmissionStatus
  submitted_at?: string
  late?: boolean
  pages?: number
  evaluation_id?: string
  total_marks?: number
  confidence?: number
}

export interface FlaggedItem {
  evaluation_id: string
  student_id: string
  student_name?: string
  question_number: string | number
  subpart?: string
  confidence: number
  reference_answer?: string
  student_answer?: string
  proposed_marks: number
  max_marks: number
}

export interface StudentAssignment extends Assignment {
  submission_status?: SubmissionStatus
  submitted_at?: string
  evaluation_id?: string
}

export interface AssistantMessage {
  role: 'user' | 'assistant'
  content: string
}

const READS = new Set([
  'listAssignments',
  'getAssignment',
  'getParsedQuestions',
  'getRubric',
  'listSubmissions',
  'getGradingRun',
  'listFlagged',
  'listStudentAssignments',
])

export async function workflowRequest<T>(operation: string, payload: Record<string, unknown> = {}, force = false): Promise<T> {
  if (!READS.has(operation)) {
    const data = await apiRequest<T>(WORKFLOW_PATH, { body: { operation, ...payload } })
    apiCache.clearPrefix('workflow:')
    return data
  }
  return apiCache.withCache(`workflow:${operation}:${JSON.stringify(payload)}`, force, () =>
    apiRequest<T>(WORKFLOW_PATH, { body: { operation, ...payload } }),
  )
}

// ---- Teacher: assignments (§13, §19) ----

export const listAssignments = (force = false) =>
  workflowRequest<{ assignments?: Assignment[] }>('listAssignments', {}, force).then((d) => d?.assignments ?? [])

export const getAssignment = (assignmentId: string, force = false) =>
  workflowRequest<Assignment>('getAssignment', { assignment_id: assignmentId }, force)

/** Creates the assignment row (contentStatus=draft) and returns the ids the QP upload is tagged with. */
export const createAssignment = (input: { title: string; class_name: string; due_at?: string }) =>
  workflowRequest<{ assignment_id: string; qp_id: string }>('createAssignment', input)

export const getParsedQuestions = (assignmentId: string, force = false) =>
  workflowRequest<{ qp_status?: QpStatus; questions?: ParsedQuestion[]; paper_total?: number }>(
    'getParsedQuestions',
    { assignment_id: assignmentId },
    force,
  )

export const confirmQuestions = (assignmentId: string) =>
  workflowRequest<{ ok: boolean }>('confirmQuestions', { assignment_id: assignmentId })

export const setGradingMethod = (
  assignmentId: string,
  method: GradingMethod,
  options: { persona?: Persona; partial_credit?: boolean } = {},
) => workflowRequest<{ qp_status?: QpStatus }>('setGradingMethod', { assignment_id: assignmentId, method, ...options })

export const getRubric = (assignmentId: string, force = false) =>
  workflowRequest<{ qp_status?: QpStatus; rubric?: RubricItem[] }>('getRubric', { assignment_id: assignmentId }, force)

/** Saving moves QUESTION_PAPERS to rubric_reviewed — the teacher's fan-in gate input. */
export const approveRubric = (assignmentId: string, rubric: RubricItem[]) =>
  workflowRequest<{ qp_status?: QpStatus }>('approveRubric', { assignment_id: assignmentId, rubric })

export const startGrading = (assignmentId: string) =>
  workflowRequest<{ ok: boolean }>('startGrading', { assignment_id: assignmentId })

// ---- Teacher: grading run & review (§15, §16, §19) ----

export interface GradingRun {
  counts?: Partial<Record<SubmissionStatus, number>>
  total?: number
  submissions?: Submission[]
}

export const getGradingRun = (assignmentId: string, force = false) =>
  workflowRequest<GradingRun>('getGradingRun', { assignment_id: assignmentId }, force)

export const listSubmissions = (assignmentId: string, force = false) =>
  workflowRequest<{ submissions?: Submission[]; enrolled?: number }>('listSubmissions', { assignment_id: assignmentId }, force)

export const listFlagged = (assignmentId: string, force = false) =>
  workflowRequest<{ items?: FlaggedItem[] }>('listFlagged', { assignment_id: assignmentId }, force).then(
    (d) => d?.items ?? [],
  )

export const acceptFlagged = (item: FlaggedItem) =>
  workflowRequest<{ ok: boolean }>('acceptFlagged', {
    evaluation_id: item.evaluation_id,
    question_number: item.question_number,
    subpart: item.subpart,
  })

export const publishGrades = (assignmentId: string) =>
  workflowRequest<{ notified?: number }>('publishGrades', { assignment_id: assignmentId })

export const remindStudent = (assignmentId: string, studentId: string) =>
  workflowRequest<{ ok: boolean }>('remindStudent', { assignment_id: assignmentId, student_id: studentId })

// ---- Student (§14) ----

export const listStudentAssignments = (force = false) =>
  workflowRequest<{ assignments?: StudentAssignment[] }>('listStudentAssignments', {}, force).then(
    (d) => d?.assignments ?? [],
  )

export const requestRecheck = (
  assignmentId: string,
  evaluationId: string,
  items: { question_number: string | number; subpart?: string; note: string }[],
) => workflowRequest<{ ok: boolean }>('requestRecheck', { assignment_id: assignmentId, evaluation_id: evaluationId, items })

// ---- GradeFlow assistant (§04) ----

export const askAssistant = (context: { assignment_id?: string; evaluation_id?: string; student_id?: string }, messages: AssistantMessage[]) =>
  workflowRequest<{ reply?: string }>('askAssistant', { ...context, messages }).then((d) => d?.reply ?? '')
