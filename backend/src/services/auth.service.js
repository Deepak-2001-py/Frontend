// /auth/* — port of lambda_python_files/authetication.py. Same request and
// response bodies, status codes and messages.
import { randomUUID } from 'node:crypto'
import { storage } from '../aws/s3.js'
import config from '../config/index.js'
import { HttpError, badRequest, forbidden, isConditionalCheckFailed, reply, unauthorized } from '../lib/errors.js'
import { hashPassword, passwordProblem, verifyPassword } from '../lib/passwords.js'
import { isoNaive, isoUtc } from '../lib/py.js'
import * as supabase from '../lib/supabaseAuth.js'
import { decodeLoginToken, issueLoginToken, usesSupabase } from '../lib/tokens.js'
import { ROLES } from '../repositories/common.js'
import { isDuplicate, resets, users } from '../repositories/index.js'

const PHOTO_URL_TTL = 3600
const PHOTO_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

/** body['field'] with Python's KeyError → 400 "Missing required field: 'field'". */
function field(obj, name) {
  if (!obj || typeof obj !== 'object' || !(name in obj)) throw badRequest(`Missing required field: '${name}'`)
  return obj[name]
}

async function photoViewUrl(user) {
  const key = user.photo_key
  const bucket = config.storage.profilePhotoBucket
  if (!key || !bucket) return null
  return storage().presignGet(bucket, key, PHOTO_URL_TTL)
}

/** The user for a valid bearer token, or null. */
async function authenticatedUser(token) {
  if (!token) return null
  const { payload } = await decodeLoginToken(token)
  if (!payload) return null
  const item = await users.getByEmail(payload.email)
  if (!item || item.user_id !== payload.user_id || !CAN_SIGN_IN.includes(item.account_status)) return null
  return item
}

// Account statuses that may sign in (docs/database-architecture.md §4).
const CAN_SIGN_IN = ['active', 'temp_password']

/** An admin-issued temporary password that is past its expiry: the reset request expires. */
async function tempPasswordExpired(user) {
  if (user.account_status !== 'temp_password' || !user.active_reset_id) return false
  const request = await resets.get(user.active_reset_id)
  if (!request?.temp_pw_expires_at || request.temp_pw_expires_at >= isoUtc()) return false
  if (request.status === 'temp_issued') await resets.update(request.request_id, { status: 'expired' })
  return true
}

export async function signup(body) {
  const email = field(body, 'email')
  const password = field(body, 'password')
  const name = body.name ?? ''
  const userRole = body.role ?? ''
  if (await users.getByEmail(email)) return reply(409, { message: 'User already exists' })
  if (!ROLES.includes(userRole)) throw badRequest(`role must be one of ${ROLES.join(', ')}`)

  const userId = randomUUID()
  const timestamp = isoNaive()
  if (usesSupabase()) await supabase.createUser(email, String(password))
  try {
    await users.create({
      user_id: userId,
      email: String(email),
      name: String(name),
      role: userRole,
      account_status: 'active',
      password_hash: await hashPassword(password),
      created_at: timestamp,
      updated_at: timestamp,
    })
  } catch (err) {
    if (isDuplicate(err)) return reply(409, { message: 'User already exists' })
    throw err
  }
  return reply(201, {
    message: 'User created successfully',
    user_id: userId,
    userRole,
    name,
    email,
    token: usesSupabase() ? await supabase.signIn(email, String(password)) : await issueLoginToken(userId, email),
  })
}

export async function login(body) {
  const email = field(body, 'email')
  const password = field(body, 'password')
  const userRole = field(body, 'userType')
  const user = await users.getByEmail(email)
  if (!user || user.account_status === 'deactivated' || user.account_status === 'invited') throw unauthorized('Invalid credentials')
  if (userRole !== user.role) throw unauthorized('Invalid credentials')
  let token
  if (usesSupabase()) {
    token = await supabase.signIn(user.email, String(password))
    if (!token) throw unauthorized('Invalid credentials')
  } else {
    if (!(await verifyPassword(user.password_hash, password))) throw unauthorized('Invalid credentials')
    token = await issueLoginToken(user.user_id, user.email)
  }
  if (user.account_status === 'suspended') throw forbidden('Your account is suspended. Contact your administrator.')
  if (await tempPasswordExpired(user)) {
    throw unauthorized('Your temporary password has expired. Ask your administrator for a new one.')
  }
  const at = isoNaive()
  await users.update(user.user_id, { last_login_at: at, ...(user.first_login_at ? {} : { first_login_at: at }) })
  return {
    message: 'Login successful',
    user_id: user.user_id,
    userRole: user.role,
    name: user.name ?? '',
    email: user.email,
    must_change_password: Boolean(user.must_change_password),
    photoUrl: await photoViewUrl(user),
    token,
  }
}

export async function logout(authorization) {
  if (!authorization || !authorization.startsWith('Bearer ')) throw unauthorized('Invalid authorization header')
  const token = authorization.split(' ')[1]
  const { payload } = await decodeLoginToken(token ?? '')
  if (!payload) throw unauthorized('Invalid or expired token')
  return { message: 'Logout successful' }
}

/**
 * Teachers/students can't reset their own password — this files a request for
 * an admin. Always answers the same way so it can't reveal which emails exist.
 */
export async function forgotPassword(body) {
  const generic = { message: 'If that account exists, your password reset request has been sent to the administrator.' }
  const email = String(body.email ?? '').trim()
  if (!email) throw badRequest('Email is required.')
  try {
    const user = await users.getByEmail(email)
    // Admins reset their own password from their profile page.
    if (!user || !['student', 'teacher'].includes(user.role) || !CAN_SIGN_IN.includes(user.account_status)) return generic
    if ((await resets.openForUser(user.user_id)).length) return generic
    await resets.create({
      request_id: randomUUID(),
      user_id: user.user_id,
      user_name: user.name ?? '',
      user_email: user.email,
      role: user.role,
      requested_at: Math.floor(Date.now() / 1000),
      status: 'pending',
      source: 'login',
    })
    return generic
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', msg: 'forgot password failed', error: err?.message }))
    throw new HttpError(500, 'Could not submit your request. Please try again.')
  }
}

/** Authenticated change; also clears the must-change flag set by an admin-issued temp password. */
export async function changePassword(token, body) {
  const user = await authenticatedUser(token)
  if (!user) throw unauthorized('Invalid or expired token')
  const current = body.currentPassword || ''
  const next = body.newPassword || ''
  const currentOk = usesSupabase()
    ? Boolean(await supabase.signIn(user.email, String(current)))
    : await verifyPassword(user.password_hash, current)
  if (!currentOk) throw badRequest('Current password is incorrect.')
  const problem = passwordProblem(next)
  if (problem) throw badRequest(problem)
  if (next === current) throw badRequest('Choose a password different from your current one.')
  if (usesSupabase()) await supabase.setPassword(user.email, String(next))
  const at = isoNaive()
  await users.update(user.user_id, {
    password_hash: await hashPassword(next),
    must_change_password: false,
    updated_at: at,
    account_status: 'active',
    active_reset_id: null,
  })
  // Changing an admin-issued temporary password completes that reset request.
  if (user.active_reset_id) {
    try {
      await resets.update(user.active_reset_id, { status: 'completed', completed_at: at })
    } catch (err) {
      if (!isConditionalCheckFailed(err)) throw err
    }
  }
  return { message: 'Password updated.' }
}

/** Fresh copy of the account fields the profile page shows. */
export async function me(token) {
  const user = await authenticatedUser(token)
  if (!user) throw unauthorized('Invalid or expired token')
  return {
    user_id: user.user_id,
    name: user.name ?? '',
    email: user.email,
    userRole: user.role ?? '',
    status: user.account_status ?? 'active',
    must_change_password: Boolean(user.must_change_password),
    photoUrl: await photoViewUrl(user),
  }
}

/** Two steps: action=upload-url returns a presigned PUT, then action=confirm records it. */
export async function profilePhoto(token, body) {
  const user = await authenticatedUser(token)
  if (!user) throw unauthorized('Invalid or expired token')
  const bucket = config.storage.profilePhotoBucket
  if (!bucket) throw new HttpError(503, 'Profile photos are not configured.')

  const isPhotoType = Object.hasOwn(PHOTO_TYPES, String(body.contentType))
  const key = `profile-photos/${user.user_id}.${isPhotoType ? PHOTO_TYPES[body.contentType] : ''}`
  const store = storage()

  if (body.action === 'upload-url') {
    if (!isPhotoType) throw badRequest('Use a JPG, PNG or WebP image.')
    return { uploadUrl: await store.presignPut(bucket, key, body.contentType, 300), key }
  }

  if (body.action === 'confirm') {
    // Only accept the key we issued for this user, and only once the object exists.
    if (!isPhotoType || body.key !== key) throw badRequest('Invalid photo key.')
    const head = await store.head(bucket, key)
    if (head.contentLength > 5 * 1024 * 1024) {
      await store.delete(bucket, key)
      throw badRequest('Photo must be under 5 MB.')
    }
    await users.update(user.user_id, { photo_key: key })
    return { photoUrl: await photoViewUrl({ photo_key: key }) }
  }

  throw badRequest('Unknown action.')
}
