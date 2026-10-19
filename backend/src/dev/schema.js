// DynamoDB table definitions for the data model (docs/database-architecture.md §2).
// Used to create the tables in the in-process emulator / DynamoDB Local, and the
// reference for production (`npm run tables:print` prints them as CreateTable input).
import { CreateTableCommand, ListTablesCommand } from '@aws-sdk/client-dynamodb'
import config from '../config/index.js'

// Logical table → number of GSIs (gsi<n>pk / gsi<n>sk, projecting ALL).
const GSIS = {
  users: 1,
  classes: 1,
  assignments: 2,
  questionPapers: 0,
  submissions: 3,
  resetRequests: 1,
  auditLog: 0,
  announcements: 2,
  app: 1,
}

export function tableDefinitions() {
  return Object.entries(GSIS).map(([logical, gsiCount]) => {
    const gsis = Array.from({ length: gsiCount }, (_, i) => `gsi${i + 1}`)
    const attrs = ['pk', 'sk', ...gsis.flatMap((g) => [`${g}pk`, `${g}sk`])]
    return {
      TableName: config.tables[logical],
      BillingMode: 'PAY_PER_REQUEST',
      KeySchema: [
        { AttributeName: 'pk', KeyType: 'HASH' },
        { AttributeName: 'sk', KeyType: 'RANGE' },
      ],
      AttributeDefinitions: attrs.map((AttributeName) => ({ AttributeName, AttributeType: 'S' })),
      ...(gsis.length
        ? {
            GlobalSecondaryIndexes: gsis.map((g) => ({
              IndexName: g,
              KeySchema: [
                { AttributeName: `${g}pk`, KeyType: 'HASH' },
                { AttributeName: `${g}sk`, KeyType: 'RANGE' },
              ],
              Projection: { ProjectionType: 'ALL' },
            })),
          }
        : {}),
    }
  })
}

export async function createTables(client, { ifMissing = false } = {}) {
  const existing = ifMissing ? new Set((await client.send(new ListTablesCommand({}))).TableNames ?? []) : new Set()
  for (const def of tableDefinitions()) {
    if (existing.has(def.TableName)) continue
    await client.send(new CreateTableCommand(def))
  }
}
