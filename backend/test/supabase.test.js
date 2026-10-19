// AUTH_DRIVER=supabase against a fake of Supabase Auth's REST API (GoTrue):
// /token (password grant), /user, /admin/users, /health.
import assert from 'node:assert/strict'
import http from 'node:http'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { after, before, describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import jwt from 'jsonwebtoken'
import { config, get, post, putUsers, repositories, startServer, stopServer } from './helpers.js'

const ANON = 'anon-key'
const SERVICE = 'service-role-key'
const SECRET = 'fake-supabase-jwt-secret-0123456789abcdef'
const accounts = new Map() // email → { id, password }
const seen = []

const fake = http.createServer((req, res) => {
  let raw = ''
  req.on('data', (c) => (raw += c))
  req.on('end', () => {
    const url = new URL(req.url, 'http://x')
    const body = raw ? JSON.parse(raw) : {}
    const bearer = (req.headers.authorization ?? '').replace('Bearer ', '')
    seen.push(`${req.method} ${url.pathname}`)
    const send = (status, json) => res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(json))
    const admin = req.headers.apikey === SERVICE && bearer === SERVICE
    const path = url.pathname.replace('/auth/v1', '')

    if (path === '/health') return send(200, { name: 'GoTrue' })
    if (path === '/token' && req.method === 'POST') {
      if (req.headers.apikey !== ANON) return send(401, { msg: 'Invalid API key' })
      const a = accounts.get(body.email)
      if (!a || a.password !== body.password) return send(400, { error: 'invalid_grant', error_description: 'Invalid login credentials' })
      return send(200, { access_token: jwt.sign({ sub: a.id, email: body.email, role: 'authenticated' }, SECRET, { expiresIn: 3600 }), token_type: 'bearer' })
    }
    if (path === '/user') {
      try {
        const p = jwt.verify(bearer, SECRET)
        return send(200, { id: p.sub, email: p.email })
      } catch {
        return send(401, { msg: 'invalid JWT' })
      }
    }
    if (path.startsWith('/admin/users')) {
      if (!admin) return send(401, { msg: 'not admin' })
      if (req.method === 'GET') return send(200, { users: [...accounts].map(([email, a]) => ({ id: a.id, email })) })
      if (req.method === 'POST') {
        if (accounts.has(body.email)) return send(422, { msg: 'A user with this email address has already been registered' })
        accounts.set(body.email, { id: `sb-${accounts.size + 1}`, password: body.password })
        return send(200, { id: accounts.get(body.email).id, email: body.email })
      }
      if (req.method === 'PUT') {
        const id = path.split('/').pop()
        const entry = [...accounts].find(([, a]) => a.id === id)
        if (!entry) return send(404, { msg: 'not found' })
        entry[1].password = body.password
        return send(200, { id, email: entry[0] })
      }
    }
    send(404, { msg: 'no route' })
  })
})

const saved = { ...config.auth, supabase: { ...config.supabase } }

before(async () => {
  await new Promise((resolve) => fake.listen(0, '127.0.0.1', resolve))
  config.auth.driver = 'supabase'
  Object.assign(config.supabase, { url: `http://127.0.0.1:${fake.address().port}`, anonKey: ANON, serviceRoleKey: SERVICE })
  await startServer()
  // Roles and profiles live in the users table; passwords only in "Supabase".
  await putUsers([
    { email: 'admin@x.edu', user_id: 'A1', name: 'Alex', userRole: 'admin' },
    { email: 't@x.edu', user_id: 'T1', name: 'Priya', userRole: 'teacher' },
    { email: 'a@x.edu', user_id: 'S1', name: 'Okafor', userRole: 'student' },
    { email: 'orphan@x.edu', user_id: 'S9', name: 'No Supabase', userRole: 'student' },
  ])
  for (const [i, [email, password]] of [['admin@x.edu', 'AdminPass1'], ['t@x.edu', 'Teach1234'], ['a@x.edu', 'Student123']].entries()) {
    accounts.set(email, { id: `sb-seed-${i}`, password })
  }
  accounts.set('ghost@x.edu', { id: 'sb-ghost', password: 'Ghost1234' }) // in Supabase, not in Users
})
after(async () => {
  config.auth.driver = saved.driver
  Object.assign(config.supabase, saved.supabase)
  await stopServer()
  fake.close()
})

const login = (email, password, userType) => post('/auth/login', { email, password, userType })

describe('AUTH_DRIVER=supabase', () => {
  test('login checks Supabase and returns its token; role comes from the users table', async () => {
    const [status, body] = await login('t@x.edu', 'Teach1234', 'teacher')
    assert.equal(status, 200)
    assert.equal(body.userRole, 'teacher')
    assert.equal(body.user_id, 'T1')
    assert.equal(jwt.verify(body.token, SECRET).email, 't@x.edu') // a Supabase token, not one of ours
    assert.equal((await login('t@x.edu', 'nope', 'teacher'))[0], 401)
    assert.equal((await login('t@x.edu', 'Teach1234', 'student'))[0], 401) // wrong role
    assert.equal((await login('ghost@x.edu', 'Ghost1234', 'student'))[0], 401) // Supabase user without a Users row
    assert.equal((await login('orphan@x.edu', 'anything', 'student'))[0], 401) // Users row without a Supabase user
  })

  test('the Supabase token authorises the other APIs', async () => {
    const token = (await login('a@x.edu', 'Student123', 'student'))[1].token
    const [status, me] = await post('/auth/me', {}, { token })
    assert.equal(status, 200)
    assert.equal(me.user_id, 'S1')
    assert.equal((await post('/workflow', { operation: 'listStudentAssignments' }, { token }))[0], 200)
    assert.equal((await post('/workflow', { operation: 'listAssignments' }, { token }))[0], 403) // role still enforced from Users
    assert.equal((await post('/workflow', { operation: 'listAssignments' }, { token: 'junk' }))[0], 401)
    const orphanToken = jwt.sign({ sub: 'sb-ghost', email: 'ghost@x.edu' }, SECRET, { expiresIn: 60 })
    assert.deepEqual((await post('/auth/me', {}, { token: orphanToken })).slice(0, 2), [401, { message: 'Invalid or expired token' }])
  })

  test('expired Supabase tokens are reported as expired; this API\'s own tokens are not accepted', async () => {
    const expired = jwt.sign({ sub: 'sb-seed-1', email: 't@x.edu', exp: Math.floor(Date.now() / 1000) - 30 }, SECRET)
    assert.deepEqual((await post('/getgrades', { operation: 'x' }, { token: expired })).slice(0, 2), [
      401,
      { error: 'Session expired — please log in again.' },
    ])
    const own = jwt.sign({ email: 't@x.edu', user_id: 'T1', exp: Math.floor(Date.now() / 1000) + 600 }, config.auth.jwtSecret)
    assert.equal((await post('/getgrades', { operation: 'x' }, { token: own }))[0], 401)
  })

  test('admin console accepts the Supabase token of an admin only', async () => {
    const admin = (await login('admin@x.edu', 'AdminPass1', 'admin'))[1].token
    assert.equal((await post('/admin', { operation: 'listUsers' }, { token: admin }))[0], 200)
    const teacher = (await login('t@x.edu', 'Teach1234', 'teacher'))[1].token
    assert.equal((await post('/admin', { operation: 'listUsers' }, { token: teacher }))[0], 403)
  })

  test('signup creates the Supabase account and a Users row', async () => {
    const [status, body] = await post('/auth/signup', { email: 'new@x.edu', password: 'NewPass123', name: 'New', role: 'student' })
    assert.equal(status, 201)
    assert.equal(jwt.verify(body.token, SECRET).email, 'new@x.edu')
    assert.equal(accounts.get('new@x.edu').password, 'NewPass123')
    assert.equal((await repositories.users.getByEmail('new@x.edu')).role, 'student')
    assert.equal((await post('/auth/signup', { email: 'new@x.edu', password: 'NewPass123' }))[0], 409)
  })

  test('change-password and admin temp passwords update Supabase', async () => {
    const token = (await login('a@x.edu', 'Student123', 'student'))[1].token
    assert.equal((await post('/auth/change-password', { currentPassword: 'wrong', newPassword: 'Better456' }, { token }))[0], 400)
    assert.equal((await post('/auth/change-password', { currentPassword: 'Student123', newPassword: 'Better456' }, { token }))[0], 200)
    assert.equal(accounts.get('a@x.edu').password, 'Better456')
    assert.equal((await login('a@x.edu', 'Better456', 'student'))[0], 200)
    assert.equal((await login('a@x.edu', 'Student123', 'student'))[0], 401)

    await post('/auth/forgot-password', { email: 'a@x.edu' })
    const adminToken = (await login('admin@x.edu', 'AdminPass1', 'admin'))[1].token
    const [, list] = await post('/admin', { operation: 'listResetRequests' }, { token: adminToken })
    const [, temp] = await post('/admin', { operation: 'generateTempPassword', requestId: list.requests[0].id }, { token: adminToken })
    assert.equal(accounts.get('a@x.edu').password, temp.tempPassword)
    assert.equal((await login('a@x.edu', temp.tempPassword, 'student'))[1].must_change_password, true)
  })

  test('readiness checks Supabase; an unreachable Supabase is a clear 503', async () => {
    const [status, body] = await get('/health/ready')
    assert.equal(status, 200)
    assert.equal(body.checks.supabaseAuth.ok, true)
    const url = config.supabase.url
    config.supabase.url = 'http://127.0.0.1:1'
    try {
      const [s2, b2] = await login('t@x.edu', 'Teach1234', 'teacher')
      assert.equal(s2, 503)
      assert.match(b2.message, /npx supabase start/)
      assert.equal((await get('/health/ready'))[0], 503)
    } finally {
      config.supabase.url = url
    }
  })

  test('the demo seed creates its users in Supabase (and resets their password)', async () => {
    accounts.delete('teacher@gradeant.dev')
    accounts.set('riya@gradeant.dev', { id: 'sb-riya', password: 'changed-by-hand' })
    const { seedDemoData, DEMO_PASSWORD } = await import('../src/dev/seed.js')
    await startServer() // an empty database: the demo accounts reuse the ids A1, T1, S1…
    await seedDemoData()
    for (const email of ['admin@gradeant.dev', 'teacher@gradeant.dev', 'riya@gradeant.dev', 'sam@gradeant.dev', 'li@gradeant.dev']) {
      assert.equal(accounts.get(email)?.password, DEMO_PASSWORD, email)
    }
    assert.equal((await login('teacher@gradeant.dev', DEMO_PASSWORD, 'teacher'))[0], 200)
  })
})

describe('configuration', () => {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const run = (env) =>
    new Promise((resolve) => {
      const child = spawn(process.execPath, ['index.js'], { cwd: ROOT, env: { PATH: process.env.PATH, ...env }, stdio: ['ignore', 'pipe', 'pipe'] })
      let out = ''
      child.stdout.on('data', (d) => (out += d))
      child.stderr.on('data', (d) => (out += d))
      child.on('exit', (code) => resolve({ code, out }))
    })

  test('production refuses AUTH_DRIVER=supabase', async () => {
    const { code, out } = await run({ APP_ENV: 'production', AUTH_DRIVER: 'supabase', JWT_SECRET: 'x', CORS_ALLOWED_ORIGINS: 'https://a.example', SUPABASE_ANON_KEY: 'k' })
    assert.notEqual(code, 0)
    assert.match(out, /AUTH_DRIVER=supabase is for local development only/)
  })

  test('production refuses the Supabase database', async () => {
    const { code, out } = await run({ APP_ENV: 'production', DB_DRIVER: 'postgres', DATABASE_URL: 'postgresql://x', JWT_SECRET: 'x', CORS_ALLOWED_ORIGINS: 'https://a.example' })
    assert.notEqual(code, 0)
    assert.match(out, /DB_DRIVER=postgres \(Supabase\) is for local development only/)
  })

  test('supabase needs the anon key', async () => {
    const { code, out } = await run({ APP_ENV: 'development', AUTH_DRIVER: 'supabase' })
    assert.notEqual(code, 0)
    assert.match(out, /needs SUPABASE_ANON_KEY/)
  })
})
