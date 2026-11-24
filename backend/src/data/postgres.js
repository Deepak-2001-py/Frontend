// Postgres driver (Supabase in production, PGlite in tests) behind the database seam.
//
// Each DynamoDB table is a Postgres table in schema `gradeant` holding the whole item as
// `item jsonb`, with the key columns (and generated index columns) next to it
// (backend/sql/001_schema.sql). The table API and its semantics are DynamoDB's, so services
// don't change: conditional writes throw ConditionalCheckFailedException, an UpdateItem
// without a condition creates the item, if_not_exists keeps a stored null, `<>` is true for
// a missing attribute, and an unknown index throws ValidationException.
//
//   DB_DRIVER=postgres  pg Pool on SUPABASE_DB_URL (Supabase session pooler)
//   DB_DRIVER=pglite    in-process Postgres (tests, local runs): schema applied at start
import { readFileSync } from 'node:fs'
import path from 'node:path'
import config from '../config/index.js'
import {
  checkAllUsed,
  compileCondition,
  compileUpdate,
  parseKeyCondition,
  parseProjection,
  stripUndefined,
  UnsupportedExpression,
} from './expressions.js'
import { SCHEMA, specForTableName } from './tables.js'

/** SQL files for a fresh database, in order. 003 needs Supabase's roles, so PGlite skips it. */
export const SQL_DIR = path.join(config.root, 'sql')
export const SCHEMA_FILES = ['001_schema.sql', '002_pipeline_api.sql']
export const SUPABASE_ONLY_FILES = ['003_supabase_access.sql']

let db // { query(sql, params) → rows, exec(sql), transaction(fn), close() }

const ident = (name) => `"${String(name).replace(/"/g, '""')}"`
const tableRef = (spec) => `${SCHEMA}.${ident(spec.table)}`

function awsError(name, message) {
  return Object.assign(new Error(message), { name })
}
const conditionFailed = () => awsError('ConditionalCheckFailedException', 'The conditional request failed')
const validation = (message) => awsError('ValidationException', message)

async function openPglite() {
  const { PGlite } = await import('@electric-sql/pglite')
  const pg = new PGlite()
  const wrap = (q) => ({ query: async (sql, params) => (await q.query(sql, params)).rows })
  return {
    ...wrap(pg),
    exec: (sql) => pg.exec(sql),
    transaction: (fn) => pg.transaction((tx) => fn(wrap(tx))),
    close: () => pg.close(),
  }
}

async function openPool() {
  const { default: pg } = await import('pg')
  const { url, poolMax, sslCa } = config.postgres
  // Supabase's pooler certificate is signed by Supabase's own CA: verify it when PG_SSL_CA
  // (the CA certificate, PEM) is set; otherwise the connection is encrypted but unverified.
  const ssl = sslCa ? { ca: sslCa, rejectUnauthorized: true } : { rejectUnauthorized: false }
  if (!sslCa) console.warn('[db] PG_SSL_CA not set: TLS to Postgres is encrypted but the server certificate is not verified')
  const pool = new pg.Pool({ connectionString: url, max: poolMax, idleTimeoutMillis: 30_000, ssl })
  pool.on('error', (err) => console.error('[db] idle client error:', err.message))
  return {
    query: async (sql, params) => (await pool.query(sql, params)).rows,
    exec: (sql) => pool.query(sql),
    async transaction(fn) {
      const client = await pool.connect()
      try {
        await client.query('begin')
        const result = await fn({ query: async (sql, params) => (await client.query(sql, params)).rows })
        await client.query('commit')
        return result
      } catch (err) {
        await client.query('rollback').catch(() => {})
        throw err
      } finally {
        client.release()
      }
    },
    close: () => pool.end(),
  }
}

/** Connects; for pglite also creates the schema and (with seed) the demo data. Call once at startup. */
export async function initDatabase({ seed = config.aws.seedDemoData, local = config.drivers.db === 'pglite' } = {}) {
  if (db) return
  db = local ? await openPglite() : await openPool()
  if (!local) return
  for (const file of SCHEMA_FILES) await db.exec(readFileSync(path.join(SQL_DIR, file), 'utf8'))
  if (seed) {
    const { seedDemoData } = await import('../dev/seed.js')
    await seedDemoData()
  }
}

export async function closeDatabase() {
  const current = db
  db = undefined
  await current?.close()
}

function connection() {
  if (!db) throw new Error('Postgres is not connected: call initDatabase() at startup')
  return db
}

/** Raw SQL (tests, migration scripts). */
export const sql = (text, params) => connection().query(text, params)

export async function pingDatabase() {
  await connection().query('select 1')
}

export const isMissingIndexError = (err) => err?.name === 'ValidationException' || err?.name === 'ResourceNotFoundException'

// ---- helpers -----------------------------------------------------------------------

function keyValues(spec, key) {
  if (!key || typeof key !== 'object') throw validation('The provided key element does not match the schema')
  const extra = Object.keys(key).filter((k) => !spec.keys.includes(k))
  const values = spec.keys.map((k) => key[k])
  if (extra.length || values.some((v) => typeof v !== 'string' || v === '')) {
    throw validation('The provided key element does not match the schema')
  }
  return values
}

const whereKey = (spec, offset = 1) => spec.keys.map((k, i) => `${ident(k)} = $${i + offset}`).join(' and ')
const orderBy = (spec) => spec.keys.map(ident).join(', ')

function only(params, allowed, what) {
  for (const k of Object.keys(params ?? {})) {
    if (!allowed.includes(k)) throw new UnsupportedExpression(`${what}: parameter ${k} is not supported by the Postgres driver`)
  }
}

function project(items, attrs) {
  if (!attrs) return items
  return items.map((item) => Object.fromEntries(attrs.filter((a) => Object.hasOwn(item, a)).map((a) => [a, item[a]])))
}

/** DynamoDB refuses an item whose index key attribute is present but not a string (null, a number…). */
function checkIndexKeys(spec, item) {
  for (const attr of new Set(Object.values(spec.indexes))) {
    if (Object.hasOwn(item, attr) && typeof item[attr] !== 'string') {
      throw validation(`One or more parameter values were invalid: Type mismatch for Index Key ${attr}`)
    }
  }
}

async function upsert(q, spec, item) {
  checkIndexKeys(spec, item)
  const values = keyValues(spec, Object.fromEntries(spec.keys.map((k) => [k, item[k]])))
  const cols = [...spec.keys.map(ident), 'item']
  const params = [...values, JSON.stringify(item)]
  await q.query(
    `insert into ${tableRef(spec)} (${cols.join(', ')}) values (${params.map((_, i) => `$${i + 1}`).join(', ')}) ` +
      `on conflict (${spec.keys.map(ident).join(', ')}) do update set item = excluded.item`,
    params,
  )
}

/**
 * Read-modify-write in one transaction with the row locked. `produce(current)` returns the
 * new item, or null to delete. A missing row that another request creates at the same time
 * is retried (it then exists and is locked), like DynamoDB's per-item atomicity.
 */
async function readModifyWrite(spec, key, condition, produce) {
  const keys = keyValues(spec, key)
  for (let attempt = 0; attempt < 3; attempt++) {
    const outcome = await connection().transaction(async (tx) => {
      const rows = await tx.query(`select item from ${tableRef(spec)} where ${whereKey(spec)} for update`, keys)
      const current = rows[0]?.item
      if (condition && !condition(current)) throw conditionFailed()
      const next = produce(current)
      if (next !== null) checkIndexKeys(spec, next)
      if (next === null) {
        if (current !== undefined) await tx.query(`delete from ${tableRef(spec)} where ${whereKey(spec)}`, keys)
        return { current, next }
      }
      if (current === undefined) {
        const cols = [...spec.keys.map(ident), 'item']
        const params = [...keys, JSON.stringify(next)]
        const inserted = await tx.query(
          `insert into ${tableRef(spec)} (${cols.join(', ')}) values (${params.map((_, i) => `$${i + 1}`).join(', ')}) ` +
            `on conflict do nothing returning 1`,
          params,
        )
        if (!inserted.length) return { retry: true }
      } else {
        await tx.query(`update ${tableRef(spec)} set item = $${keys.length + 1}::jsonb where ${whereKey(spec)}`, [...keys, JSON.stringify(next)])
      }
      return { current, next }
    })
    if (!outcome.retry) return outcome
  }
  throw awsError('TransactionConflictException', 'Transaction conflict: the item kept changing')
}

// ---- the table API ---------------------------------------------------------------------

/** Same shape as the DynamoDB driver's table(): get / put / update / delete / queryAll / scanAll. */
export function table(getName) {
  const spec = () => specForTableName(typeof getName === 'function' ? getName() : getName)
  return {
    get name() {
      return typeof getName === 'function' ? getName() : getName
    },

    async get(Key, extra = {}) {
      only(extra, ['ConsistentRead', 'ProjectionExpression', 'ExpressionAttributeNames'], 'get')
      const s = spec()
      const used = new Set()
      const attrs = extra.ProjectionExpression ? parseProjection(extra.ProjectionExpression, extra.ExpressionAttributeNames, used) : null
      checkAllUsed(extra.ExpressionAttributeNames, undefined, used)
      const rows = await connection().query(`select item from ${tableRef(s)} where ${whereKey(s)}`, keyValues(s, Key))
      if (!rows.length) return undefined
      return project([rows[0].item], attrs)[0]
    },

    async put(Item, extra = {}) {
      only(extra, ['ConditionExpression', 'ExpressionAttributeNames', 'ExpressionAttributeValues'], 'put')
      const s = spec()
      const item = stripUndefined(Item)
      const used = new Set()
      const condition = extra.ConditionExpression
        ? compileCondition(extra.ConditionExpression, extra.ExpressionAttributeNames, extra.ExpressionAttributeValues, used)
        : null
      checkAllUsed(extra.ExpressionAttributeNames, extra.ExpressionAttributeValues, used)
      if (!condition) {
        await upsert(connection(), s, item)
        return {}
      }
      const key = Object.fromEntries(s.keys.map((k) => [k, item[k]]))
      await readModifyWrite(s, key, condition, () => item)
      return {}
    },

    async update(params) {
      only(
        params,
        ['Key', 'UpdateExpression', 'ConditionExpression', 'ExpressionAttributeNames', 'ExpressionAttributeValues', 'ReturnValues'],
        'update',
      )
      const s = spec()
      const { Key, UpdateExpression, ConditionExpression, ExpressionAttributeNames: names, ExpressionAttributeValues: values } = params
      const returnValues = params.ReturnValues ?? 'NONE'
      if (!['NONE', 'ALL_NEW', 'ALL_OLD'].includes(returnValues)) {
        throw new UnsupportedExpression(`ReturnValues ${returnValues} is not supported by the Postgres driver`)
      }
      const used = new Set()
      const apply = compileUpdate(UpdateExpression, names, values, used)
      const condition = ConditionExpression ? compileCondition(ConditionExpression, names, values, used) : null
      checkAllUsed(names, values, used)
      const { current, next } = await readModifyWrite(s, Key, condition, (cur) => {
        const updated = stripUndefined(apply(cur, Key))
        for (const k of s.keys) {
          if (updated[k] !== Key[k]) throw validation(`Cannot update attribute ${k}. This attribute is part of the key`)
        }
        return updated
      })
      if (returnValues === 'ALL_NEW') return { Attributes: next }
      if (returnValues === 'ALL_OLD') return current === undefined ? {} : { Attributes: current }
      return {}
    },

    async delete(Key, extra = {}) {
      only(extra, ['ConditionExpression', 'ExpressionAttributeNames', 'ExpressionAttributeValues'], 'delete')
      const s = spec()
      const used = new Set()
      const condition = extra.ConditionExpression
        ? compileCondition(extra.ConditionExpression, extra.ExpressionAttributeNames, extra.ExpressionAttributeValues, used)
        : null
      checkAllUsed(extra.ExpressionAttributeNames, extra.ExpressionAttributeValues, used)
      if (!condition) {
        await connection().query(`delete from ${tableRef(s)} where ${whereKey(s)}`, keyValues(s, Key))
        return {}
      }
      await readModifyWrite(s, Key, condition, () => null)
      return {}
    },

    async queryAll(params) {
      only(
        params,
        ['IndexName', 'KeyConditionExpression', 'FilterExpression', 'ProjectionExpression', 'ExpressionAttributeNames', 'ExpressionAttributeValues'],
        'query',
      )
      const s = spec()
      const { IndexName, ExpressionAttributeNames: names, ExpressionAttributeValues: values } = params
      const used = new Set()
      const { attr, value } = parseKeyCondition(params.KeyConditionExpression, names, values, used)
      const keep = compileCondition(params.FilterExpression, names, values, used)
      const attrs = params.ProjectionExpression ? parseProjection(params.ProjectionExpression, names, used) : null
      checkAllUsed(names, values, used)
      let column
      if (IndexName) {
        column = s.indexes[IndexName]
        if (!column) throw validation(`The table does not have the specified index: ${IndexName}`)
      } else {
        column = s.keys[0]
      }
      if (attr !== column) throw validation('Query condition missed key schema element')
      if (typeof value !== 'string') throw validation('One or more parameter values were invalid: Condition parameter type does not match schema type')
      // Base-table queries come back sorted by the range key, as in DynamoDB.
      const order = !IndexName && s.keys.length > 1 ? ident(s.keys[1]) : orderBy(s)
      const rows = await connection().query(`select item from ${tableRef(s)} where ${ident(column)} = $1 order by ${order}`, [value])
      return project(rows.map((r) => r.item).filter(keep), attrs)
    },

    async scanAll(params = {}) {
      only(params, ['FilterExpression', 'ProjectionExpression', 'ExpressionAttributeNames', 'ExpressionAttributeValues'], 'scan')
      const s = spec()
      const { ExpressionAttributeNames: names, ExpressionAttributeValues: values } = params
      const used = new Set()
      const keep = compileCondition(params.FilterExpression, names, values, used)
      const attrs = params.ProjectionExpression ? parseProjection(params.ProjectionExpression, names, used) : null
      checkAllUsed(names, values, used)
      const rows = await connection().query(`select item from ${tableRef(s)} order by ${orderBy(s)}`)
      return project(rows.map((r) => r.item).filter(keep), attrs)
    },
  }
}
