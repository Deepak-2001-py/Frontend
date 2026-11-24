<<<<<<< HEAD
import { API } from '../config'
=======
>>>>>>> origin/main
import { apiRequest } from './api'

/** POST to correct_questions_answer.py, which dispatches on `operation`. */
export function correctionRequest<T = unknown>(payload: Record<string, unknown>): Promise<T> {
<<<<<<< HEAD
  return apiRequest<T>(API.corrections,{ body: payload })
=======
  return apiRequest<T>('/correctanswer', { body: payload })
>>>>>>> origin/main
}
