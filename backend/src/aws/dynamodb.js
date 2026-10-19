// DynamoDB clients (AWS SDK v3). The same code runs against real DynamoDB
// (production), DynamoDB Local (DYNAMODB_ENDPOINT), or an in-process DynamoDB
// emulator (DB_DRIVER=memory, offline development and tests) — only the
// endpoint changes. The data model lives in src/repositories/dynamodb/.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'
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
 * Connects; with DB_DRIVER=memory, first starts the in-process emulator. Local
 * databases (emulator or DYNAMODB_ENDPOINT) get the tables created if missing.
 */
export async function connectDynamo() {
  if (docClient) return
  if (config.drivers.db === 'memory') {
    const { startLocalDynamo } = await import('../dev/localDynamo.js')
    localServer = await startLocalDynamo()
    makeClients(localServer.endpoint)
  } else {
    makeClients(config.aws.dynamodbEndpoint)
  }
  if (config.drivers.db === 'memory' || config.aws.dynamodbEndpoint) {
    const { createTables } = await import('../dev/schema.js')
    await createTables(rawClient, { ifMissing: true })
  }
}

export async function closeDynamo() {
  rawClient?.destroy()
  docClient = undefined
  rawClient = undefined
  if (localServer) await localServer.close()
  localServer = undefined
}

/** The document client (connects lazily, e.g. in scripts). */
export function dynamo() {
  if (!docClient) makeClients(config.aws.dynamodbEndpoint)
  return docClient
}

/** Every item of a Query or Scan, following LastEvaluatedKey. */
export async function paginate(Command, params) {
  const items = []
  let start
  do {
    const page = await dynamo().send(new Command({ ...params, ExclusiveStartKey: start }))
    items.push(...(page.Items ?? []))
    start = page.LastEvaluatedKey
  } while (start)
  return items
}

export const queryAll = (params) => paginate(QueryCommand, params)
export const scanAll = (params) => paginate(ScanCommand, params)
