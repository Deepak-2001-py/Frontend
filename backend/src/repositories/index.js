// The data store the services use. DB_DRIVER picks the implementation:
//   dynamodb  production (DynamoDB tables, docs/database-architecture.md §2)
//   memory    the same tables in an in-process DynamoDB emulator (offline dev, tests)
//   postgres  local Supabase Postgres (development; supabase/migrations/)
// Both implementations return the same records and throw the same errors
// (DuplicateError, ConditionalCheckFailedException), so services never know which one runs.
import config from '../config/index.js'

let store

async function load() {
  if (config.drivers.db === 'postgres') return (await import('./postgres.js')).default
  return (await import('./dynamodb.js')).default
}

/**
 * Connects to the database. With SEED_DEMO_DATA=true an empty local database also
 * gets the demo accounts and a graded assignment. Call once at startup.
 */
export async function initDatabase({ seed = config.aws.seedDemoData } = {}) {
  if (store) return
  const next = await load()
  await next.init()
  store = next
  // Never against real DynamoDB: only the emulator, DynamoDB Local or local Postgres.
  if (seed && (config.drivers.db !== 'dynamodb' || config.aws.dynamodbEndpoint)) {
    const { seedDemoData } = await import('../dev/seed.js')
    await seedDemoData()
  }
}

export async function closeDatabase() {
  await store?.close()
  store = undefined
}

export const pingDatabase = () => current().ping()

function current() {
  if (!store) throw new Error('Database not initialised: call initDatabase() first')
  return store
}

// users.get(...) → the current store's users.get(...)
const area = (name) =>
  new Proxy(
    {},
    {
      get:
        (_, method) =>
        (...args) =>
          current()[name][method](...args),
    },
  )

export const users = area('users')
export const classes = area('classes')
export const assignments = area('assignments')
export const papers = area('papers')
export const submissions = area('submissions')
export const resets = area('resets')
export const invites = area('invites')
export const audit = area('audit')
export const announcements = area('announcements')
export const posts = area('posts')
export const tickets = area('tickets')
export const settings = area('settings')
export const metrics = area('metrics')

export { DuplicateError, isDuplicate } from './common.js'
