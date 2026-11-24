// The database seam. Repositories call table(...) / initDatabase() / pingDatabase()
// from here; the driver behind them is chosen by config.drivers.db, which comes from
// config/app.yaml (`deployment:` → providers.database) in production:
//
//   memory | dynamodb   ./dynamodb.js   (AWS SDK document client; unchanged code)
//   postgres | pglite   ./postgres.js   (Supabase; pglite = in-process Postgres for tests)
//
// Every driver offers the same table API: get / put / update / delete / queryAll /
// scanAll with DynamoDB request shapes, so services and repositories don't change.
import config from '../config/index.js'
import * as dynamodb from './dynamodb.js'

let postgres // loaded on demand, only when selected

const usesPostgres = () => config.drivers.db === 'postgres' || config.drivers.db === 'pglite'

function driver() {
  if (!usesPostgres()) return dynamodb
  if (!postgres) throw new Error('The postgres database driver is not loaded: call initDatabase() at startup')
  return postgres
}

export async function initDatabase(options) {
  if (usesPostgres()) {
    postgres ??= await import('./postgres.js')
    return postgres.initDatabase(options)
  }
  return dynamodb.initDatabase(options)
}

export async function closeDatabase() {
  if (usesPostgres()) return postgres?.closeDatabase() // nothing to close before the first init
  return dynamodb.closeDatabase()
}

export const pingDatabase = () => driver().pingDatabase()

/** Per-table helper. The driver is resolved on each call, so repositories can create it at import time. */
export function table(getName) {
  const t = () => driver().table(getName)
  return {
    get name() {
      return t().name
    },
    get: (...args) => t().get(...args),
    put: (...args) => t().put(...args),
    update: (...args) => t().update(...args),
    delete: (...args) => t().delete(...args),
    queryAll: (...args) => t().queryAll(...args),
    scanAll: (...args) => t().scanAll(...args),
  }
}

// Driver-independent helpers.
export { clean } from './dynamodb.js'

/** Missing-index / missing-table errors (detects the optional assignment_id index). */
export const isMissingIndexError = (err) => driver().isMissingIndexError(err)
