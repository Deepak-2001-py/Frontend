// Single place for the API host, set per mode by Vite env files:
//   .env.development  (npm run dev)    → the local Node backend (backend/, npm run dev)
//   .env.production   (npm run build)  → the deployed API
// Override either in .env.<mode>.local. Only public URLs belong here: every
// VITE_* value is compiled into the browser bundle, so never put secrets in them.
export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL || 'https://rus9nultj9.execute-api.eu-north-1.amazonaws.com/dev'

// Assignment workflow resource (wireframes §13–§15, §19, §20). One Lambda
// dispatching on `operation`, like /admin; see WIREFRAMES.md for the contract.
export const WORKFLOW_PATH: string = import.meta.env.VITE_WORKFLOW_PATH || '/workflow'

// Where /uploadpdf lives. Unset: the same API (the Node backend, which requires
// the user's token). Set it to keep using the legacy upload Lambda, which is
// called without a token (its CORS setup doesn't allow the Authorization header).
export const UPLOAD_BASE_URL: string = import.meta.env.VITE_UPLOAD_BASE_URL || API_BASE_URL
export const UPLOAD_SENDS_TOKEN = !import.meta.env.VITE_UPLOAD_BASE_URL
