// Test harness: the real Express app on a random port, backed by a fresh
// database per suite — the in-memory DynamoDB emulator by default, or Postgres with
//   TEST_DB_DRIVER=postgres TEST_DATABASE_URL=postgresql://… npm test
// (use a throwaway database: every table is emptied).
process.env.APP_ENV = 'test'

const { default: jwt } = await import('jsonwebtoken')
const { default: config } = await import('../src/config/index.js')
const { createApp } = await import('../src/app.js')
const repositories = await import('../src/repositories/index.js')
const { LegacyImport } = await import('../src/repositories/legacy.js')

export { config, repositories }
export const dbDriver = process.env.TEST_DB_DRIVER || 'memory'

let server
export let baseUrl

export async function startServer({ seed = false } = {}) {
  await stopServer()
  config.drivers.db = dbDriver
  if (dbDriver === 'postgres') {
    config.database.url = process.env.TEST_DATABASE_URL
    if (!config.database.url) throw new Error('TEST_DB_DRIVER=postgres needs TEST_DATABASE_URL')
    const postgres = await import('../src/repositories/postgres.js')
    await postgres.applyMigrations()
    await repositories.initDatabase({ seed: false })
    await postgres.truncateAll()
  } else {
    await repositories.initDatabase({ seed: false })
  }
  if (seed) await (await import('../src/dev/seed.js')).seedDemoData()
  await new Promise((resolve) => {
    server = createApp().listen(0, '127.0.0.1', resolve)
  })
  baseUrl = `http://127.0.0.1:${server.address().port}`
  config.server.publicUrl = baseUrl // local-storage URLs must point at this test server
  return baseUrl
}

export async function stopServer() {
  if (server) await new Promise((resolve) => server.close(resolve))
  server = undefined
  await repositories.closeDatabase()
}

export function tokenFor(user, { secret = config.auth.jwtSecret, expiresIn = 600 } = {}) {
  return jwt.sign(
    { email: user.email, user_id: user.user_id, exp: Math.floor(Date.now() / 1000) + expiresIn },
    secret,
    { algorithm: 'HS256' },
  )
}

/** POST JSON; returns [status, body, headers]. */
export async function post(path, body, { token, headers = {}, raw } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: raw ?? JSON.stringify(body ?? {}),
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = text
  }
  return [res.status, json, res.headers]
}

export async function get(path) {
  const res = await fetch(`${baseUrl}${path}`)
  return [res.status, await res.json().catch(() => null), res.headers]
}

/** Accounts in the old Users-table shape ({ email, user_id, name, userRole, classes, password }). */
export async function putUsers(users) {
  await new LegacyImport().users(users, [])
}

/** Grading-pipeline output in the old assignment_grading row shape (one call = one batch). */
export async function putGradingRows(rows) {
  await new LegacyImport().grading(rows)
}

/** Old-format tables (keyed like config.legacyTables), e.g. the parity fixture. */
export const importTables = (tables) => new LegacyImport().run(tables)
