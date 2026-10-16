// Single place for the API Gateway host. Override per environment with
// VITE_API_BASE_URL in web/.env (e.g. a staging stage instead of /dev).
export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? 'https://rus9nultj9.execute-api.eu-north-1.amazonaws.com/dev'

// Assignment workflow resource (wireframes §13–§15, §19, §20). One Lambda
// dispatching on `operation`, like /admin; see WIREFRAMES.md for the contract.
export const WORKFLOW_PATH: string = import.meta.env.VITE_WORKFLOW_PATH ?? '/workflow'
