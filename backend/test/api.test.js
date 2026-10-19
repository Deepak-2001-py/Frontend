// HTTP-level behaviour: health, CORS, errors, auth flows across tables, file
// uploads through presigned URLs (local storage driver), and the admin console.
import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { baseUrl, config, get, post, putUsers, startServer, stopServer, tokenFor } from './helpers.js'

const { hashLoginPassword } = await import('../src/lib/passwords.js')
const { sentMail } = await import('../src/aws/ses.js')

const PASSWORD = 'Password123!'
let USERS

before(async () => {
  await startServer()
  const password = await hashLoginPassword(PASSWORD)
  USERS = [
    { email: 'admin@x.edu', user_id: 'A1', name: 'Alex', userRole: 'admin', password },
    { email: 't@x.edu', user_id: 'T1', name: 'Priya', userRole: 'teacher', password },
    { email: 'a@x.edu', user_id: 'S1', name: 'Okafor', userRole: 'student', password },
  ]
  await putUsers(USERS)
})
after(stopServer)

const login = async (email, password = PASSWORD, userType) => {
  const role = userType ?? USERS.find((u) => u.email === email).userRole
  return post('/auth/login', { email, password, userType: role })
}

describe('platform', () => {
  test('health and readiness', async () => {
    const [status, body] = await get('/health')
    assert.equal(status, 200)
    assert.equal(body.status, 'ok')
    const [readyStatus, ready] = await get('/health/ready')
    assert.equal(readyStatus, 200)
    assert.equal(ready.checks.dynamodb.ok, true)
    assert.equal(ready.checks.jwtSecret.ok, true)
  })

  test('CORS preflight', async () => {
    const res = await fetch(`${baseUrl}/workflow`, {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' },
    })
    assert.equal(res.status, 204)
    assert.equal(res.headers.get('access-control-allow-origin'), '*')
    assert.match(res.headers.get('access-control-allow-headers'), /Authorization/)
  })

  test('unknown routes and malformed JSON', async () => {
    assert.equal((await post('/nope', {}))[0], 404)
    assert.deepEqual((await post('/auth/nope', {})).slice(0, 2), [404, { message: 'Not Found' }])
    const token = tokenFor(USERS[2])
    assert.deepEqual((await post('/workflow', null, { token, raw: '{oops' })).slice(0, 2), [400, { error: 'Invalid JSON format' }])
    assert.deepEqual((await post('/admin', null, { raw: '[' })).slice(0, 2), [400, { message: 'Request body must be valid JSON.' }])
  })

  test('expired and forged tokens', async () => {
    const expired = tokenFor(USERS[2], { expiresIn: -10 })
    assert.deepEqual((await post('/getgrades', { operation: 'x' }, { token: expired })).slice(0, 2), [
      401,
      { error: 'Session expired — please log in again.' },
    ])
    const forged = tokenFor(USERS[2], { secret: 'not-the-secret-not-the-secret-0000' })
    assert.equal((await post('/getgrades', { operation: 'x' }, { token: forged }))[0], 401)
  })
})

describe('auth and password resets', () => {
  test('login, me, logout', async () => {
    const [status, body] = await login('t@x.edu')
    assert.equal(status, 200)
    assert.equal(body.userRole, 'teacher')
    const [, me] = await post('/auth/me', {}, { token: body.token })
    assert.equal(me.email, 't@x.edu')
    assert.equal(me.status, 'active')
    assert.equal((await post('/auth/logout', {}, { token: body.token }))[0], 200)
    assert.equal((await login('t@x.edu', 'wrong'))[0], 401)
  })

  test('forgot password → admin issues temp password → user logs in and must change it', async () => {
    const generic = 'If that account exists, your password reset request has been sent to the administrator.'
    assert.deepEqual((await post('/auth/forgot-password', { email: 'a@x.edu' }))[1], { message: generic })
    assert.deepEqual((await post('/auth/forgot-password', { email: 'nobody@x.edu' }))[1], { message: generic })

    const adminToken = (await login('admin@x.edu'))[1].token
    const [, list] = await post('/admin', { operation: 'listResetRequests' }, { token: adminToken })
    assert.equal(list.pendingCount, 1)
    const request = list.requests[0]
    assert.equal(request.userEmail, 'a@x.edu')

    const [, temp] = await post('/admin', { operation: 'generateTempPassword', requestId: request.id }, { token: adminToken })
    assert.equal(temp.tempPassword.length, 12)
    assert.equal((await login('a@x.edu'))[0], 401) // old password no longer works
    const [status, session] = await login('a@x.edu', temp.tempPassword)
    assert.equal(status, 200)
    assert.equal(session.must_change_password, true)

    const [changed] = await post('/auth/change-password', { currentPassword: temp.tempPassword, newPassword: 'Fresh123pass' }, { token: session.token })
    assert.equal(changed, 200)
    assert.equal((await login('a@x.edu', 'Fresh123pass'))[1].must_change_password, false)
    const [, audit] = await post('/admin', { operation: 'listAuditLogs', search: 'temp' }, { token: adminToken })
    assert.equal(audit.entries[0].action, 'Generated temp password')
  })

  test('admin console is admin-only; invites send an email', async () => {
    const teacherToken = (await login('t@x.edu'))[1].token
    assert.deepEqual((await post('/admin', { operation: 'listUsers' }, { token: teacherToken })).slice(0, 2), [
      403,
      { message: 'This action is admin-only.' },
    ])
    const adminToken = (await login('admin@x.edu'))[1].token
    const before = sentMail.length
    const [status, res] = await post(
      '/admin',
      { operation: 'inviteUsers', invitees: [{ email: 'new@x.edu', name: 'New <Teacher>', role: 'teacher' }] },
      { token: adminToken },
    )
    assert.equal(status, 200)
    assert.equal(res.invited, 1)
    const mail = sentMail.slice(before)
    assert.equal(mail.length, 1)
    assert.equal(mail[0].to, 'new@x.edu')
    assert.ok(mail[0].html.includes('New &lt;Teacher&gt;'))
    const [, users] = await post('/admin', { operation: 'listUsers', status: 'invited' }, { token: adminToken })
    assert.equal(users.users[0].email, 'new@x.edu')
  })
})

describe('files', () => {
  test('profile photo: presigned upload, confirm, then view', async () => {
    const token = (await login('t@x.edu'))[1].token
    assert.equal((await post('/auth/profile-photo', { action: 'upload-url', contentType: 'image/gif' }, { token }))[0], 400)
    const [, { uploadUrl, key }] = await post('/auth/profile-photo', { action: 'upload-url', contentType: 'image/png' }, { token })
    assert.equal(key, 'profile-photos/T1.png')

    const png = Buffer.from('89504e470d0a1a0a', 'hex')
    assert.equal((await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: png })).status, 403) // signed for image/png
    assert.equal((await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: png })).status, 200)

    assert.equal((await post('/auth/profile-photo', { action: 'confirm', contentType: 'image/png', key: 'profile-photos/S1.png' }, { token }))[0], 400)
    const [status, { photoUrl }] = await post('/auth/profile-photo', { action: 'confirm', contentType: 'image/png', key }, { token })
    assert.equal(status, 200)
    const image = await fetch(photoUrl)
    assert.equal(image.status, 200)
    assert.equal(image.headers.get('content-type'), 'image/png')
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), png)
    assert.equal((await fetch(photoUrl.replace(/sig=[0-9a-f]+/, 'sig=00'))).status, 403)
    assert.ok((await post('/auth/me', {}, { token }))[1].photoUrl)
  })

  test('uploadpdf: authenticated, validated, one presigned URL per file', async () => {
    const meta = { uploadType: 'student', assignmentId: 'A-1', files: [{ name: 'page 1.pdf', type: 'application/pdf', size: 1000 }] }
    assert.equal((await post('/uploadpdf', meta))[0], 401)
    const student = tokenFor(USERS[2])
    assert.equal((await post('/uploadpdf', { ...meta, studentId: 'S9' }, { token: student }))[0], 403)
    assert.equal((await post('/uploadpdf', { ...meta, uploadType: 'teacher' }, { token: student }))[0], 403)
    assert.equal((await post('/uploadpdf', { ...meta, files: [{ name: 'x.exe', type: 'application/x-msdownload', size: 10 }] }, { token: student }))[0], 400)
    assert.equal(
      (await post('/uploadpdf', { ...meta, files: [{ name: 'big.pdf', type: 'application/pdf', size: config.storage.uploadMaxBytes + 1 }] }, { token: student }))[0],
      400,
    )
    const [status, { urls }] = await post('/uploadpdf', meta, { token: student })
    assert.equal(status, 200)
    assert.equal(urls.length, 1)
    assert.match(urls[0], /\/_local-storage\/test-uploads\/uploads\/student\/A-1\/page_1\.pdf\?/)
    assert.equal((await fetch(urls[0], { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: '%PDF-1.4' })).status, 200)
  })
})
