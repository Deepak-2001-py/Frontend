// Single source of configuration. Picks the environment, loads the matching
// .env file, and exposes a typed config object. Nothing else in the
// app reads process.env directly.
//
// Environment selection (first match wins):
//   1. --mode=<name> on the command line   (npm run dev / npm run start:prod)
//   2. APP_ENV
//   3. AWS_LAMBDA_HTTP_ENDPOINT is set      → production (Lambda Web Functions)
//   4. development
//
// Files: .env.<mode> (committed, no secrets) then .env.<mode>.local
// (gitignored, for personal overrides and local secrets). A variable already in
// process.env always wins, so Lambda revision variables override the files.
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function pickMode() {
  const arg = process.argv.find((a) => a.startsWith('--mode='))
  if (arg) return arg.slice('--mode='.length)
  if (process.env.APP_ENV) return process.env.APP_ENV
  if (process.env.AWS_LAMBDA_HTTP_ENDPOINT) return 'production'
  return 'development'
}

function loadEnvFiles(mode) {
  const loaded = []
  for (const name of [`.env.${mode}`, `.env.${mode}.local`]) {
    const file = path.join(ROOT, name)
    if (!existsSync(file)) continue
    const values = parseEnv(readFileSync(file, 'utf8'))
    for (const [key, value] of Object.entries(values)) {
      if (process.env[key] === undefined) process.env[key] = value
    }
    loaded.push(name)
  }
  return loaded
}

// --auth=supabase (npm run dev:supabase) selects the Supabase Auth driver for this run.
function authArg() {
  const arg = process.argv.find((a) => a.startsWith('--auth='))
  if (arg) process.env.AUTH_DRIVER = arg.slice('--auth='.length)
}
authArg()

const mode = pickMode()
const envFiles = loadEnvFiles(mode)
const env = process.env

const str = (name, fallback = '') => (env[name] ?? '').trim() || fallback
const int = (name, fallback) => {
  const n = Number.parseInt(env[name] ?? '', 10)
  return Number.isFinite(n) ? n : fallback
}
const float = (name, fallback) => {
  const n = Number.parseFloat(env[name] ?? '')
  return Number.isFinite(n) ? n : fallback
}
const bool = (name, fallback = false) => {
  const v = (env[name] ?? '').trim().toLowerCase()
  if (!v) return fallback
  return ['1', 'true', 'yes', 'on'].includes(v)
}
const list = (name) =>
  str(name)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
const oneOf = (name, allowed, fallback) => {
  const v = str(name, fallback)
  if (!allowed.includes(v)) throw new Error(`${name} must be one of ${allowed.join(', ')} (got "${v}")`)
  return v
}

// Lambda sets AWS_LAMBDA_HTTP_ENDPOINT ("host:port"); locally HOST/PORT apply.
function listenAddress() {
  const endpoint = env.AWS_LAMBDA_HTTP_ENDPOINT
  if (endpoint) {
    const i = endpoint.lastIndexOf(':')
    return { host: endpoint.slice(0, i), port: Number(endpoint.slice(i + 1)) }
  }
  return { host: str('HOST', '127.0.0.1'), port: int('PORT', 8787) }
}

const isProduction = mode === 'production'
// AWS_REGION is reserved on Lambda Web Functions and is always the function's
// own Region. The data can live elsewhere (e.g. tables in eu-north-1 while Web
// Functions run in eu-west-1), so the data Region is configured separately.
const dataRegion = str('AWS_DATA_REGION') || str('AWS_REGION') || str('AWS_DEFAULT_REGION') || 'us-east-1'

const config = {
  mode,
  isProduction,
  envFiles,
  root: ROOT,

  server: {
    ...listenAddress(),
    // Mount the API under a prefix (e.g. "/dev") when a front door adds one.
    basePath: str('API_BASE_PATH', '/').replace(/\/+$/, '') || '',
    // Used to build links the browser follows back to this server (local storage URLs).
    publicUrl: str('PUBLIC_BASE_URL'),
    bodyLimit: str('BODY_LIMIT', '1mb'),
    logRequests: bool('LOG_REQUESTS', true),
  },

  cors: {
    // "*" or a comma-separated allowlist of origins.
    origins: list('CORS_ALLOWED_ORIGINS'),
  },

  drivers: {
    db: oneOf('DB_DRIVER', ['memory', 'dynamodb'], isProduction ? 'dynamodb' : 'memory'),
    storage: oneOf('STORAGE_DRIVER', ['local', 's3'], isProduction ? 's3' : 'local'),
    mail: oneOf('MAIL_DRIVER', ['log', 'ses'], isProduction ? 'ses' : 'log'),
    notify: oneOf('NOTIFY_DRIVER', ['log', 'sns'], isProduction ? 'sns' : 'log'),
    jobs: oneOf('JOBS_DRIVER', ['inline', 'sqs'], 'inline'),
    ai: oneOf('AI_DRIVER', ['canned', 'bedrock'], isProduction ? 'bedrock' : 'canned'),
    grading: oneOf('GRADING_DRIVER', ['log', 'lambda'], isProduction ? 'lambda' : 'log'),
  },

  aws: {
    region: dataRegion,
    // Point DynamoDB at DynamoDB Local (e.g. http://localhost:8000) when DB_DRIVER=dynamodb.
    dynamodbEndpoint: str('DYNAMODB_ENDPOINT'),
    // Seed demo data into the database on startup (in-memory DB always seeds).
    seedDemoData: bool('SEED_DEMO_DATA', false),
  },

  tables: {
    users: str('USERS_TABLE', 'Users'),
    grading: str('GRADING_TABLE', 'assignment_grading'),
    gradingAssignmentIndex: str('GRADING_ASSIGNMENT_INDEX', 'assignment_id-index'),
    assignments: str('ASSIGNMENTS_TABLE', 'GradeAnt_Assignments'),
    submissions: str('SUBMISSIONS_TABLE', 'GradeAnt_Submissions'),
    announcements: str('ANNOUNCEMENTS_TABLE', 'GradeAnt_Announcements'),
    adminUsers: str('ADMIN_USERS_TABLE', 'GradeAnt_Users'),
    resetRequests: str('RESET_REQUESTS_TABLE', 'GradeAnt_ResetRequests'),
    content: str('CONTENT_TABLE', 'GradeAnt_Content'),
    tickets: str('TICKETS_TABLE', 'GradeAnt_Tickets'),
    auditLogs: str('AUDIT_LOGS_TABLE', 'GradeAnt_AuditLogs'),
    settings: str('SETTINGS_TABLE', 'GradeAnt_Settings'),
    invites: str('INVITES_TABLE', 'GradeAnt_Invites'),
    analytics: str('ANALYTICS_TABLE', 'GradeAnt_Analytics'),
  },

  auth: {
    // jwt: this API issues and verifies its own HS256 tokens (production).
    // supabase: local development only — Supabase Auth checks passwords and issues the
    // tokens; the Users table still holds each account's role and profile.
    driver: oneOf('AUTH_DRIVER', ['jwt', 'supabase'], 'jwt'),
    // Either the value itself (local only) or a Secrets Manager secret ARN/name.
    jwtSecret: str('JWT_SECRET'),
    jwtSecretArn: str('JWT_SECRET_ARN'),
    tokenExpirySeconds: int('TOKEN_EXPIRY_SECONDS', 86400),
    // Admin first-login session tokens (lambda_admin.py's own HMAC format).
    sessionTokenSecret: str('SESSION_TOKEN_SECRET'),
    sessionTokenSecretArn: str('SESSION_TOKEN_SECRET_ARN'),
    sessionTokenTtlSeconds: int('SESSION_TOKEN_TTL_SECONDS', 24 * 60 * 60),
    inviteTokenTtlSeconds: int('INVITE_TOKEN_TTL_SECONDS', 7 * 24 * 60 * 60),
  },

  // Local Supabase (`npx supabase start`); only read when AUTH_DRIVER=supabase.
  supabase: {
    url: str('SUPABASE_URL', 'http://127.0.0.1:54321').replace(/\/+$/, ''),
    anonKey: str('SUPABASE_ANON_KEY'),
    // Server-side only: creates users (signup, demo seed) and resets passwords.
    serviceRoleKey: str('SUPABASE_SERVICE_ROLE_KEY'),
  },

  storage: {
    profilePhotoBucket: str('PROFILE_PHOTO_BUCKET'),
    // Bucket the /uploadpdf presigner writes to. Empty disables /uploadpdf in production.
    uploadBucket: str('UPLOAD_BUCKET'),
    // {uploadType} {assignmentId} {qpId} {studentId} {courseId} {fileName} {uuid}
    uploadKeyTemplate: str('UPLOAD_KEY_TEMPLATE', 'uploads/{uploadType}/{assignmentId}/{fileName}'),
    uploadMaxBytes: int('UPLOAD_MAX_BYTES', 10 * 1024 * 1024),
    uploadUrlTtlSeconds: int('UPLOAD_URL_TTL_SECONDS', 900),
    localDir: path.resolve(ROOT, str('LOCAL_STORAGE_DIR', '.data/storage')),
  },

  mail: {
    sesSenderEmail: str('SES_SENDER_EMAIL'),
    // lambda_admin.py always had a sender default for invites.
    inviteSenderEmail: str('INVITE_SENDER_EMAIL') || str('SES_SENDER_EMAIL') || 'no-reply@gradeant.io',
    appBaseUrl: str('APP_BASE_URL', 'https://app.gradeant.io'),
  },

  notify: {
    snsTopicArn: str('SNS_TOPIC_ARN'),
  },

  jobs: {
    queueUrl: str('JOBS_QUEUE_URL'),
  },

  grading: {
    functionName: str('GRADING_FUNCTION_NAME'),
    flagConfidence: float('FLAG_CONFIDENCE', 0.75),
  },

  bedrock: {
    region: str('BEDROCK_REGION') || dataRegion,
    modelId: str('BEDROCK_MODEL_ID', 'anthropic.claude-opus-5-5'),
    fallbackModelId: str('BEDROCK_FALLBACK_MODEL_ID', 'anthropic.claude-opus-5'),
  },
}

function validate(c) {
  const problems = []
  if (c.auth.driver === 'supabase') {
    if (c.isProduction) problems.push('AUTH_DRIVER=supabase is for local development only')
    if (!c.supabase.anonKey) problems.push('AUTH_DRIVER=supabase needs SUPABASE_ANON_KEY (npx supabase status -o env)')
  }
  if (c.isProduction) {
    if (!c.auth.jwtSecret && !c.auth.jwtSecretArn) problems.push('JWT_SECRET_ARN (or JWT_SECRET) is required')
    if (c.cors.origins.length === 0) problems.push('CORS_ALLOWED_ORIGINS is required (the web app origin)')
    if (c.drivers.db === 'memory') problems.push('DB_DRIVER=memory is for local development only')
    if (c.drivers.jobs === 'sqs' && !c.jobs.queueUrl) problems.push('JOBS_DRIVER=sqs needs JOBS_QUEUE_URL')
  }
  if (problems.length) throw new Error(`Invalid ${c.mode} configuration:\n  - ${problems.join('\n  - ')}`)
}

validate(config)

export default config
