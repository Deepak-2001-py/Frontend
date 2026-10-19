// Bearer-token authentication for /getgrades, /correctanswer, /updatedb and
// /workflow (same rules as their Python Lambdas): an HS256 JWT from
// /auth/login, whose account must still exist. The role and account status are
// read fresh on every request, so a demoted, suspended or deleted user loses
// access at once.
import { getJwtSecret } from '../aws/secrets.js'
import { HttpError, unauthorized } from '../lib/errors.js'
import { decodeLoginToken, usesSupabase } from '../lib/tokens.js'
import { users } from '../repositories/index.js'

export function bearerToken(req) {
  const header = req.get('authorization') ?? ''
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : null
}

/** Returns { user_id, email, role, user } or throws a 401 HttpError. */
export async function authenticate(req) {
  if (!usesSupabase() && !(await getJwtSecret())) throw new HttpError(500, 'Server misconfigured: JWT_SECRET is not set.')
  const token = bearerToken(req)
  if (token === null) throw unauthorized('Missing Authorization: Bearer <token> header.')
  const { payload, error } = await decodeLoginToken(token)
  if (error === 'expired') throw unauthorized('Session expired — please log in again.')
  if (error) throw unauthorized('Invalid session token.')
  const { email, user_id: userId } = payload
  if (!email || !userId) throw unauthorized('Malformed session token.')
  const user = await users.getByEmail(email)
  if (!user || user.user_id !== userId || user.account_status === 'deactivated') throw unauthorized('Account no longer exists.')
  if (user.account_status === 'suspended') throw new HttpError(403, 'Your account is suspended. Contact your administrator.')
  return { user_id: userId, email: user.email, role: user.role ?? 'student', user }
}

/** Express middleware: sets req.caller. */
export const requireCaller = async (req, res, next) => {
  req.caller = await authenticate(req)
  next()
}

/** Throws 403 unless the caller has one of `roles`. */
export function requireRole(caller, roles, message) {
  if (!roles.includes(caller.role)) throw new HttpError(403, message)
}
