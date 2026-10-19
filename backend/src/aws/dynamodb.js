// DynamoDB access (AWS SDK v3 document client). The same code runs against
// real DynamoDB (production), DynamoDB Local (DYNAMODB_ENDPOINT), or an
// in-process DynamoDB emulator (DB_DRIVER=memory, local development and tests)
// — only the endpoint changes.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb'
import config from '../config/index.js'

let docClient
let rawClient
let localServer

function makeClients(endpoint) {
  const options = { region: config.aws.region }
  if (endpoint) {
    options.endpoint = endpoint
    // Local emulators accept any credentials; never send real ones to them.
    options.credentials = { accessKeyId: 'local', secretAccessKey: 'local' }
  }
  rawClient = new DynamoDBClient(options)
  docClient = DynamoDBDocumentClient.from(rawClient, {
    marshallOptions: { removeUndefinedValues: true },
  })
}

/**
 * Connects (and, for DB_DRIVER=memory, starts the in-process emulator and
 * creates the tables). With SEED_DEMO_DATA=true a local database also gets the
 * demo users and graded assignment. Call once at startup.
 */
export async function initDatabase({ seed = config.aws.seedDemoData, assignmentIndex = true } = {}) {
  if (docClient) return
  const local = config.drivers.db === 'memory' || Boolean(config.aws.dynamodbEndpoint)
  if (config.drivers.db === 'memory') {
    const { startLocalDynamo } = await import('../dev/localDynamo.js')
    localServer = await startLocalDynamo()
    makeClients(localServer.endpoint)
  } else {
    makeClients(config.aws.dynamodbEndpoint)
  }
  if (!local) return
  const { createTables } = await import('../dev/schema.js')
  await createTables(rawClient, { ifMissing: true, assignmentIndex })
  if (seed) {
    const { seedDemoData } = await import('../dev/seed.js')
    await seedDemoData()
  }
}

export async function closeDatabase() {
  rawClient?.destroy()
  docClient = undefined
  rawClient = undefined
  if (localServer) await localServer.close()
  localServer = undefined
}

function client() {
  if (!docClient) makeClients(config.aws.dynamodbEndpoint)
  return docClient
}

async function paginate(Command, params) {
  const items = []
  let start
  do {
    const page = await client().send(new Command({ ...params, ExclusiveStartKey: start }))
    items.push(...(page.Items ?? []))
    start = page.LastEvaluatedKey
  } while (start)
  return items
}

/** Thin per-table helper; `name` is read lazily so tests can reconfigure tables. */
export function table(getName) {
  const TableName = () => (typeof getName === 'function' ? getName() : getName)
  return {
    get name() {
      return TableName()
    },
    get: async (Key, extra = {}) => (await client().send(new GetCommand({ TableName: TableName(), Key, ...extra }))).Item,
    put: (Item, extra = {}) => client().send(new PutCommand({ TableName: TableName(), Item, ...extra })),
    update: (params) => client().send(new UpdateCommand({ TableName: TableName(), ...params })),
    delete: (Key, extra = {}) => client().send(new DeleteCommand({ TableName: TableName(), Key, ...extra })),
    queryAll: (params) => paginate(QueryCommand, { TableName: TableName(), ...params }),
    scanAll: (params = {}) => paginate(ScanCommand, { TableName: TableName(), ...params }),
  }
}

/** workflow.py's _to_dynamo: drops None/undefined map values, recursively. */
export function clean(value) {
  if (Array.isArray(value)) return value.map(clean)
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) if (v !== null && v !== undefined) out[k] = clean(v)
    return out
  }
  return value
}

/** Cheap connectivity probe for /health/ready. */
export async function pingDatabase() {
  await client().send(new GetCommand({ TableName: config.tables.users, Key: { email: '__healthcheck__' } }))
}

/** Missing-index / missing-table errors (used to detect the optional assignment_id GSI). */
export const isMissingIndexError = (err) =>
  err?.name === 'ValidationException' || err?.name === 'ResourceNotFoundException'
