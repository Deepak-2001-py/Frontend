// /admin — port of admin/lambda_admin.py: the admin console, one resource
// dispatching on `operation`. Every operation is admin-only except
// getInviteDetails / completeFirstLogin (reached from an emailed invite link).
import { randomBytes, randomUUID } from 'node:crypto'
import { sendEmail } from '../aws/ses.js'
import config from '../config/index.js'
import { HttpError, badRequest, forbidden, isConditionalCheckFailed, notFound, unauthorized } from '../lib/errors.js'
import { generateTempPassword as makeTempPassword, hashPassword, verifyPassword } from '../lib/passwords.js'
import { isoUtc, pyRepr, sortBy, truthy } from '../lib/py.js'
import * as supabase from '../lib/supabaseAuth.js'
import { makeSessionToken, usesSupabase, verifyLoginJwtForAdmin, verifySessionToken } from '../lib/tokens.js'
import { ROLES, monthOf } from '../repositories/common.js'
import { classNamed } from '../repositories/gradebook.js'
import { audit, classes, invites, isDuplicate, metrics, posts, resets, settings, tickets, users } from '../repositories/index.js'

// How long an admin-issued temporary password works (docs/database-architecture.md §4).
const TEMP_PASSWORD_TTL_MS = 72 * 60 * 60 * 1000

// ---- Auth ------------------------------------------------------------------------

/** Claims for the bearer token: a login JWT (3 parts) or an admin session token (2 parts). */
export async function bearerClaims(authorization) {
  const header = authorization ?? ''
  if (!header.toLowerCase().startsWith('bearer ')) throw unauthorized('Missing Authorization: Bearer <token> header.')
  const token = header.slice(7).trim()
  if (token.split('.').length === 3) {
    const payload = await verifyLoginJwtForAdmin(token)
    const { email, user_id: userId } = payload
    if (!email || !userId) throw unauthorized('Malformed session token.')
    const user = await users.getByEmail(email)
    if (!user || user.user_id !== userId || user.account_status === 'deactivated') throw unauthorized('Account no longer exists.')
    if (user.account_status === 'suspended') throw forbidden('Your account is suspended.')
    return { sub: userId, role: user.role ?? 'student', name: user.name ?? 'Admin', email: user.email }
  }
  // A first-login session token: the account's current role and status still apply.
  const claims = await verifySessionToken(token)
  const user = await users.get(claims.sub)
  if (!user || user.account_status === 'deactivated') throw unauthorized('Account no longer exists.')
  if (user.account_status === 'suspended') throw forbidden('Your account is suspended.')
  return { ...claims, role: user.role ?? claims.role, name: user.name ?? claims.name }
}

async function requireAdmin(authorization) {
  const claims = await bearerClaims(authorization)
  if (claims.role !== 'admin') throw forbidden('This action is admin-only.')
  return claims
}

async function writeAuditLog(claims, action, target) {
  const ts = Date.now() / 1000
  try {
    await audit.append({
      event_id: randomUUID(),
      month: monthOf(ts),
      ts,
      actor_id: claims.sub,
      actor_role: claims.role,
      action,
      target_id: target === undefined || target === null ? null : String(target),
    })
  } catch (err) {
    // Audit logging must never break the admin's action.
    console.warn(JSON.stringify({ level: 'warn', msg: 'failed to write audit log', action, target, error: err?.message }))
  }
}

const str = (v) => (v === undefined || v === null ? '' : String(v))

/** Runs an update of a record that must exist; a missing one is a 404 with `message`. */
async function mustExist(update, message) {
  try {
    return await update()
  } catch (err) {
    if (isConditionalCheckFailed(err)) throw notFound(message)
    throw err
  }
}

// ---- Users -----------------------------------------------------------------------

async function listUsers(p) {
  const search = str(p.search).trim().toLowerCase()
  const items = (await users.list({ role: p.role || undefined })).filter(
    (u) => u.account_status !== 'deactivated' && (!p.status || u.account_status === p.status),
  )
  const matching = search
    ? items.filter((u) => str(u.name).toLowerCase().includes(search) || str(u.email).toLowerCase().includes(search))
    : items
  const list = matching.map((u) => ({
    id: u.user_id,
    name: u.name ?? '',
    email: u.email ?? '',
    role: u.role ?? 'student',
    school: u.school ?? '',
    status: u.account_status ?? 'active',
  }))
  return { users: list, total: list.length }
}

async function updateUserStatus(p, claims) {
  if (!p.userId || !['active', 'suspended', 'invited'].includes(p.status)) throw badRequest('userId and a valid status are required.')
  await mustExist(() => users.update(p.userId, { account_status: p.status, updated_at: isoUtc() }), 'User not found.')
  await writeAuditLog(claims, `Set user status to ${p.status}`, p.userId)
  return { success: true }
}

/** Deactivates the account (it can't sign in) and removes it from its classes; grades are kept. */
async function deleteUser(p, claims) {
  if (!p.userId) throw badRequest('userId is required.')
  await mustExist(() => users.update(p.userId, { account_status: 'deactivated', updated_at: isoUtc() }), 'User not found.')
  for (const m of await classes.memberships(p.userId)) {
    if (m.member_status !== 'removed') await classes.setMemberStatus(m.class_id, p.userId, 'removed')
  }
  await writeAuditLog(claims, 'Deleted user', p.userId)
  return { success: true }
}

// ---- Onboarding: invite → first login (wireframe §17) ------------------------------

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch])

async function sendInviteEmail(email, name, link) {
  try {
    await sendEmail({
      from: config.mail.inviteSenderEmail,
      to: email,
      subject: "You're invited to GradeAnt",
      html:
        `<p>Hi ${escapeHtml(name)},</p>` +
        "<p>You've been invited to GradeAnt. Finish setting up your account:</p>" +
        `<p><a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>`,
    })
  } catch (err) {
    // The invite record should still succeed even if SES isn't set up yet.
    console.warn(JSON.stringify({ level: 'warn', msg: 'failed to send invite email', error: err?.message }))
  }
}

/** Creates the invited account, or re-invites a deactivated one with the same email. */
async function invitedAccount(email, name, role, className, claims) {
  const existing = await users.getByEmail(email)
  const profile = { name, role, school: className, account_status: 'invited', must_change_password: false }
  if (existing) {
    if (existing.account_status !== 'deactivated') return null
    await users.update(existing.user_id, { ...profile, password_hash: null, updated_at: isoUtc() })
    return existing.user_id
  }
  const userId = randomUUID()
  try {
    await users.create({ user_id: userId, email, ...profile, created_by: claims.sub, created_at: isoUtc() })
  } catch (err) {
    if (isDuplicate(err)) return null
    throw err
  }
  return userId
}

/** Puts an invited student in the class (and makes an invited teacher the teacher of a class without one). */
async function joinClass(userId, role, className, claims) {
  if (!className || role === 'admin') return
  const cls = await classNamed(className, { teacherId: role === 'teacher' ? userId : undefined, by: claims.sub })
  if (role === 'student') {
    await classes.addMember({ class_id: cls.class_id, student_id: userId, added_by: claims.sub, added_at: isoUtc() })
  } else if (!cls.teacher_id) {
    await classes.update(cls.class_id, { teacher_id: userId })
  }
}

async function inviteUsers(p, claims) {
  const invitees = Array.isArray(p.invitees) ? p.invitees : []
  if (!invitees.length) throw badRequest('At least one invitee is required.')
  for (const person of invitees) {
    if (person?.role && !ROLES.includes(person.role)) throw badRequest(`Invalid role for ${str(person.email)}: ${str(person.role)}.`)
  }
  let invited = 0
  const skipped = []
  for (const person of invitees) {
    const email = str(person?.email).trim()
    if (!email) continue
    const name = str(person.name || email).trim()
    const role = person.role || 'student'
    const className = person.className || ''
    const userId = await invitedAccount(email, name, role, className, claims)
    // An email that already has an account isn't invited again.
    if (!userId) {
      skipped.push(email)
      continue
    }
    await joinClass(userId, role, className, claims)
    const token = randomBytes(24).toString('base64url')
    await invites.create({
      token,
      user_id: userId,
      full_name: name,
      role,
      class_name: className,
      expires_at: Date.now() / 1000 + config.auth.inviteTokenTtlSeconds,
      consumed: false,
    })
    await sendInviteEmail(email, name, `${config.mail.appBaseUrl}/admin/first_login_setup.html?token=${token}`)
    invited += 1
  }
  await writeAuditLog(claims, `Invited ${invited} user(s)`, invitees.map((x) => str(x?.email)).join(', '))
  return { invited, ...(skipped.length ? { skipped } : {}) }
}

async function loadInvite(token) {
  if (!token) throw badRequest('token is required.')
  return invites.get(String(token))
}

async function getInviteDetails(p) {
  const invite = await loadInvite(p.token)
  if (!invite) throw notFound('This invite link is invalid or has already been used.')
  if (invite.consumed) throw badRequest('This invite has already been used.')
  if (Number(invite.expires_at ?? 0) < Date.now() / 1000) throw badRequest('This invite link has expired — ask your admin to resend it.')
  return { fullName: invite.full_name, role: invite.role, className: invite.class_name ?? '' }
}

async function completeFirstLogin(p) {
  const { token, password } = p
  if (!token || !password || Array.from(String(password)).length < 8) {
    throw badRequest('token and a password of at least 8 characters are required.')
  }
  const invite = await invites.get(String(token))
  if (!invite || invite.consumed) throw badRequest('This invite link is invalid or has already been used.')
  if (Number(invite.expires_at ?? 0) < Date.now() / 1000) throw badRequest('This invite link has expired — ask your admin to resend it.')
  const user = await users.get(invite.user_id)
  if (!user || user.account_status === 'deactivated') throw badRequest('This invite link is invalid or has already been used.')

  // The account's one password: it signs in to the app and the admin console.
  if (usesSupabase()) await supabase.createUser(user.email, String(password), { update: true })
  const at = isoUtc()
  await users.update(invite.user_id, {
    account_status: 'active',
    password_hash: await hashPassword(password),
    must_change_password: false,
    first_login_at: at,
    updated_at: at,
  })
  await invites.update(String(token), { consumed: true })
  return {
    token: await makeSessionToken({ sub: invite.user_id, role: invite.role }, config.auth.sessionTokenTtlSeconds),
    userId: invite.user_id,
    role: invite.role,
    fullName: invite.full_name,
  }
}

// ---- Password resets (teachers/students can't self-reset, wireframe §07) ------------

async function listResetRequests(p) {
  const status = p.status || 'pending'
  const items = await resets.listByStatus(status)
  const requests = sortBy(
    items.map((r) => ({
      id: r.request_id,
      userName: r.user_name ?? '',
      userEmail: r.user_email ?? '',
      role: r.role ?? '',
      requestedAt: Number(r.requested_at ?? 0),
      status: r.status ?? 'pending',
    })),
    (r) => r.requestedAt,
    { reverse: true },
  )
  return { requests, pendingCount: status === 'pending' ? requests.length : null }
}

async function approveResetRequest(p, claims) {
  if (!p.requestId) throw badRequest('requestId is required.')
  await mustExist(
    () => resets.update(p.requestId, { status: 'approved', decided_by: claims.sub, decided_at: isoUtc() }),
    'Reset request not found.',
  )
  await writeAuditLog(claims, 'Approved password reset request', p.requestId)
  return { success: true }
}

async function rejectResetRequest(p, claims) {
  if (!p.requestId) throw badRequest('requestId is required.')
  await mustExist(
    () => resets.update(p.requestId, { status: 'rejected', decided_by: claims.sub, decided_at: isoUtc() }),
    'Reset request not found.',
  )
  await writeAuditLog(claims, 'Rejected password reset request', p.requestId)
  return { success: true }
}

/**
 * Sets a temporary password (valid 72 h) that must be changed at the next sign-in.
 * The request stays temp_issued until the user changes it (→ completed).
 */
async function generateTempPassword(p, claims) {
  if (!p.requestId) throw badRequest('requestId is required.')
  const request = await resets.get(p.requestId)
  if (!request) throw notFound('Reset request not found.')
  const user = await users.get(request.user_id)
  if (!user || user.account_status === 'deactivated') throw notFound('That account no longer exists.')

  const temp = makeTempPassword()
  if (usesSupabase()) await supabase.setPassword(user.email, temp)
  const at = new Date()
  await users.update(user.user_id, {
    password_hash: await hashPassword(temp),
    must_change_password: true,
    ...(user.account_status === 'suspended' ? {} : { account_status: 'temp_password' }),
    active_reset_id: request.request_id,
    updated_at: isoUtc(at),
  })
  await resets.update(p.requestId, {
    status: 'temp_issued',
    decided_by: request.decided_by ?? claims.sub,
    decided_at: request.decided_at ?? isoUtc(at),
    temp_pw_expires_at: isoUtc(new Date(at.getTime() + TEMP_PASSWORD_TTL_MS)),
  })
  await writeAuditLog(claims, 'Generated temp password', request.user_email ?? request.user_id)
  return { tempPassword: temp }
}

// Fixed governance rules from the wireframe's Permission Matrix (§07).
const PERMISSION_MATRIX = [
  { label: 'Change own password', admin: 'yes', teacher: 'yes', student: 'yes' },
  { label: 'Reset own pw without current', admin: 'no', teacher: 'no', student: 'no' },
  { label: "Reset another user's pw", admin: 'yes', teacher: 'no', student: 'no' },
  { label: 'Create teacher / student', admin: 'yes', teacher: 'no', student: 'no' },
  { label: 'Edit username', admin: 'yes', teacher: 'no', student: 'no' },
  { label: 'Edit own details (limited)', admin: 'yes', teacher: 'self', student: 'self' },
  { label: 'Delete / activate users', admin: 'yes', teacher: 'no', student: 'no' },
  { label: 'View audit logs', admin: 'yes', teacher: 'no', student: 'no' },
]

const getPermissionMatrix = async () => ({ features: PERMISSION_MATRIX })

// ---- Content & blog --------------------------------------------------------------

async function listContent(p) {
  const filter = p.filter || 'all'
  const items = await posts.list({ status: filter !== 'all' ? filter : undefined })
  const list = items.map((x) => ({
    id: x.post_id,
    title: x.title ?? '(untitled)',
    author: x.author ?? '',
    dateLabel: x.date_label ?? '',
    status: x.status ?? 'draft',
  }))
  return { posts: sortBy(list, (x) => x.dateLabel ?? '', { reverse: true }) }
}

async function updatePostStatus(p, claims) {
  if (!p.postId || !['draft', 'pending', 'published'].includes(p.status)) throw badRequest('postId and a valid status are required.')
  await mustExist(() => posts.update(p.postId, { status: p.status }), 'Post not found.')
  await writeAuditLog(claims, `Set post status to ${p.status}`, p.postId)
  return { success: true }
}

// ---- Analytics (pre-aggregated by a separate scheduled job) -------------------------

const ANALYTICS_FALLBACK = {
  activeUsers: { value: '0', trend: 'no data yet', direction: 'flat' },
  papersGraded: { value: '0', trend: 'no data yet', direction: 'flat' },
  schools: { value: '0', trend: 'no data yet', direction: 'flat' },
  uptime: { value: '—', trend: 'no data yet', direction: 'flat' },
  weeklyPapers: [],
  topSchools: [],
}

async function getAnalytics(p) {
  const item = await metrics.get(p.range || '30d')
  return item ? JSON.parse(item.data_json) : ANALYTICS_FALLBACK
}

// ---- Support tickets -------------------------------------------------------------

async function listTickets(p, claims) {
  const filter = p.filter || 'open'
  const condition = filter === 'resolved' ? { status: 'resolved' } : filter === 'mine' ? { assigneeId: claims.sub } : { status: 'open' }
  const items = await tickets.list(condition)
  const list = items.map((t) => ({
    id: t.ticket_id,
    priority: t.priority ?? 'med',
    subject: t.subject ?? '',
    ageLabel: t.age_label ?? '',
    requester: t.requester_name ?? '',
    assignee: t.assignee_name ?? '',
  }))
  return { tickets: list, openCount: filter === 'open' ? list.length : null }
}

async function assignTicket(p, claims) {
  if (!p.ticketId) throw badRequest('ticketId is required.')
  await mustExist(() => tickets.update(p.ticketId, { assignee_id: claims.sub, assignee_name: claims.name ?? 'Admin' }), 'Ticket not found.')
  await writeAuditLog(claims, 'Self-assigned ticket', p.ticketId)
  return { success: true }
}

async function resolveTicket(p, claims) {
  if (!p.ticketId) throw badRequest('ticketId is required.')
  await mustExist(() => tickets.update(p.ticketId, { status: 'resolved' }), 'Ticket not found.')
  await writeAuditLog(claims, 'Resolved ticket', p.ticketId)
  return { success: true }
}

// ---- Audit logs --------------------------------------------------------------------

async function listAuditLogs(p) {
  const search = str(p.search).trim().toLowerCase()
  const category = p.category || ''
  let entries = (await audit.recent({ limit: 1000 })).map((e) => ({
    timestamp: Number(e.ts ?? 0),
    actor: e.actor_id ?? '',
    action: e.action ?? '',
    target: e.target_id ?? '',
  }))
  if (category) entries = entries.filter((e) => e.action.toLowerCase().includes(String(category).toLowerCase()))
  if (search) {
    entries = entries.filter(
      (e) => e.actor.toLowerCase().includes(search) || e.action.toLowerCase().includes(search) || e.target.toLowerCase().includes(search),
    )
  }
  return { entries: sortBy(entries, (e) => e.timestamp, { reverse: true }).slice(0, 200) }
}

// ---- System settings -----------------------------------------------------------------

const DEFAULT_SETTINGS = {
  platformName: 'GradeAnt',
  supportEmail: 'support@gradeant.io',
  sessionTimeoutMinutes: 30,
  maintenanceMode: false,
  allowSelfSignup: false,
}

async function getSettings() {
  const item = (await settings.get('platform'))?.data
  if (!item) return DEFAULT_SETTINGS
  return {
    platformName: item.platform_name ?? DEFAULT_SETTINGS.platformName,
    supportEmail: item.support_email ?? DEFAULT_SETTINGS.supportEmail,
    sessionTimeoutMinutes: Math.trunc(Number(item.session_timeout_minutes ?? DEFAULT_SETTINGS.sessionTimeoutMinutes)),
    maintenanceMode: truthy(item.maintenance_mode ?? false),
    allowSelfSignup: truthy(item.allow_self_signup ?? false),
  }
}

async function updateSettings(p, claims) {
  const timeout = Number(p.sessionTimeoutMinutes ?? 30)
  if (!Number.isFinite(timeout)) throw badRequest('sessionTimeoutMinutes must be a number.')
  await settings.put('platform', {
    platform_name: p.platformName ?? DEFAULT_SETTINGS.platformName,
    support_email: p.supportEmail ?? DEFAULT_SETTINGS.supportEmail,
    session_timeout_minutes: timeout,
    maintenance_mode: truthy(p.maintenanceMode ?? false),
    allow_self_signup: truthy(p.allowSelfSignup ?? false),
  })
  await writeAuditLog(claims, 'Updated system settings', 'platform')
  return { success: true }
}

// ---- Admin's own profile ---------------------------------------------------------------

async function getProfile(p, claims) {
  const user = await users.get(claims.sub)
  if (!user) throw notFound('Admin profile not found.')
  return {
    fullName: user.name ?? '',
    username: user.username ?? '',
    email: user.email ?? '',
    phone: user.phone ?? '',
    adminLevel: user.admin_level ?? 'admin',
  }
}

async function updateProfile(p, claims) {
  const user = await users.get(claims.sub)
  if (!user) throw notFound('Admin profile not found.')
  const email = str(p.email).trim()
  // The email is also the sign-in name, so it is only changed when one is given.
  const changesEmail = Boolean(email) && email.toLowerCase() !== str(user.email).toLowerCase()
  if (changesEmail && (await users.getByEmail(email))) throw new HttpError(409, 'That email is already in use.')
  if (changesEmail && usesSupabase()) await supabase.setEmail(user.email, email)
  try {
    await users.update(claims.sub, {
      name: str(p.fullName),
      username: str(p.username) || null,
      phone: str(p.phone) || null,
      ...(email ? { email } : {}),
      updated_at: isoUtc(),
    })
  } catch (err) {
    if (isDuplicate(err)) throw new HttpError(409, 'That email is already in use.')
    throw err
  }
  await writeAuditLog(claims, 'Updated own profile', claims.sub)
  return { success: true }
}

async function changeOwnPassword(p, claims) {
  const { currentPassword, newPassword } = p
  if (!currentPassword || !newPassword || Array.from(String(newPassword)).length < 8) {
    throw badRequest('currentPassword and a newPassword of at least 8 characters are required.')
  }
  const user = await users.get(claims.sub)
  const currentOk =
    user &&
    (usesSupabase()
      ? Boolean(await supabase.signIn(user.email, String(currentPassword)))
      : await verifyPassword(user.password_hash, String(currentPassword)))
  if (!currentOk) throw badRequest('Current password is incorrect.')
  if (usesSupabase()) await supabase.setPassword(user.email, String(newPassword))
  // The same password signs in to the app: it is one account.
  await users.update(claims.sub, {
    password_hash: await hashPassword(newPassword),
    must_change_password: false,
    updated_at: isoUtc(),
    ...(user.account_status === 'temp_password' ? { account_status: 'active', active_reset_id: null } : {}),
  })
  await writeAuditLog(claims, 'Changed own password', claims.sub)
  return { success: true }
}

// ---- Dispatch ------------------------------------------------------------------------

// [handler, requiresAuth]
const OPERATIONS = {
  listUsers: [listUsers, true],
  updateUserStatus: [updateUserStatus, true],
  deleteUser: [deleteUser, true],
  inviteUsers: [inviteUsers, true],
  getInviteDetails: [getInviteDetails, false],
  completeFirstLogin: [completeFirstLogin, false],
  listResetRequests: [listResetRequests, true],
  approveResetRequest: [approveResetRequest, true],
  rejectResetRequest: [rejectResetRequest, true],
  generateTempPassword: [generateTempPassword, true],
  getPermissionMatrix: [getPermissionMatrix, true],
  listContent: [listContent, true],
  updatePostStatus: [updatePostStatus, true],
  getAnalytics: [getAnalytics, true],
  listTickets: [listTickets, true],
  assignTicket: [assignTicket, true],
  resolveTicket: [resolveTicket, true],
  listAuditLogs: [listAuditLogs, true],
  getSettings: [getSettings, true],
  updateSettings: [updateSettings, true],
  getProfile: [getProfile, true],
  updateProfile: [updateProfile, true],
  changeOwnPassword: [changeOwnPassword, true],
}

export async function dispatch(body, authorization) {
  const operation = body.operation
  if (!operation || typeof operation !== 'string' || !Object.hasOwn(OPERATIONS, operation)) {
    throw badRequest(`Unknown or missing operation: ${pyRepr(operation ?? null)}`)
  }
  const [handler, requiresAuth] = OPERATIONS[operation]
  const claims = requiresAuth ? await requireAdmin(authorization) : null
  return handler(body, claims)
}
