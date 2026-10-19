// Minimal client for Supabase Auth (GoTrue) over its REST API, used only when
// AUTH_DRIVER=supabase (local development). Passwords and sessions live in
// Supabase; the Users table keeps the account's role and profile.
//   POST /auth/v1/token?grant_type=password   sign in            (anon key)
//   GET  /auth/v1/user                        who owns a token   (anon key + user token)
//   GET/POST/PUT /auth/v1/admin/users[/id]    manage users       (service role key)
import config from '../config/index.js'
import { HttpError } from './errors.js'

const base = () => `${config.supabase.url}/auth/v1`
const unreachable = (err) =>
  new HttpError(503, `Supabase Auth is not reachable at ${config.supabase.url} — run \`npx supabase start\` (${err?.cause?.code ?? err?.message}).`)

async function call(path, { method = 'GET', token, body, admin = false } = {}) {
  const key = admin ? config.supabase.serviceRoleKey : config.supabase.anonKey
  if (admin && !key) throw new HttpError(503, 'SUPABASE_SERVICE_ROLE_KEY is not set (npx supabase status -o env).')
  let res
  try {
    res = await fetch(`${base()}${path}`, {
      method,
      headers: { apikey: key, Authorization: `Bearer ${token ?? key}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  } catch (err) {
    throw unreachable(err)
  }
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    /* non-JSON body */
  }
  return { status: res.status, json }
}

/** Access token for a correct email + password, or null when the credentials are wrong. */
export async function signIn(email, password) {
  const { status, json } = await call('/token?grant_type=password', { method: 'POST', body: { email, password } })
  if (status === 400 || status === 401 || status === 422) return null
  if (status !== 200 || !json?.access_token) throw new HttpError(502, `Supabase sign-in failed (${status}).`)
  return json.access_token
}

const sessions = new Map() // token → { user, until }; a short cache so each API call isn't a round trip
const CACHE_MS = 30_000

/** The Supabase user for an access token, or null when it is invalid or expired. */
export async function getUser(token) {
  const hit = sessions.get(token)
  if (hit && hit.until > Date.now()) return hit.user
  const { status, json } = await call('/user', { token })
  if (status === 401 || status === 403 || status === 404) return null
  if (status !== 200 || !json?.email) throw new HttpError(502, `Supabase user lookup failed (${status}).`)
  if (sessions.size > 500) sessions.clear()
  sessions.set(token, { user: json, until: Date.now() + CACHE_MS })
  return json
}

/** `exp` (seconds) from a JWT's payload without verifying it — only to tell "expired" from "invalid". */
export function tokenExpiry(token) {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).exp
  } catch {
    return undefined
  }
}

async function findByEmail(email) {
  const wanted = String(email).toLowerCase()
  for (let page = 1; page <= 50; page++) {
    const { status, json } = await call(`/admin/users?page=${page}&per_page=1000`, { admin: true })
    if (status !== 200) throw new HttpError(502, `Supabase user list failed (${status}).`)
    const hit = (json?.users ?? []).find((u) => u.email?.toLowerCase() === wanted)
    if (hit) return hit
    if ((json?.users ?? []).length < 1000) return null
  }
  return null
}

/** Creates the user (already confirmed). With `update`, an existing user gets the new password. */
export async function createUser(email, password, { update = false } = {}) {
  const { status, json } = await call('/admin/users', { method: 'POST', admin: true, body: { email, password, email_confirm: true } })
  if (status === 200 || status === 201) return json
  const exists = status === 422 || status === 409
  if (!exists) throw new HttpError(502, `Supabase could not create the user (${status}: ${json?.msg ?? json?.message ?? 'error'}).`)
  const existing = await findByEmail(email)
  if (existing && update) await setPassword(email, password)
  return existing
}

export async function setPassword(email, password) {
  const user = await findByEmail(email)
  if (!user) return createUser(email, password)
  const { status } = await call(`/admin/users/${user.id}`, { method: 'PUT', admin: true, body: { password } })
  if (status !== 200) throw new HttpError(502, `Supabase could not set the password (${status}).`)
  return user
}

/** Used by /health/ready. */
export async function ping() {
  const { status } = await call('/health')
  if (status !== 200) throw Object.assign(new Error(), { name: `Supabase ${status}` })
}
