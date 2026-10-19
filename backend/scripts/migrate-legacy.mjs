// Copies the tables the Python Lambdas used (Users, GradeAnt_*, assignment_grading)
// into the data model (docs/database-architecture.md §7). The old tables are only read.
//
//   npm run migrate:legacy                dry run: reads the old tables and imports them into a
//                                         throwaway in-memory database, printing counts and warnings
//   npm run migrate:legacy -- --write     imports into the configured database
//                                         (DB_DRIVER=dynamodb: the gradeant-* tables; postgres: DATABASE_URL)
//
// Settings come from the environment (DB_DRIVER, AWS_DATA_REGION, DYNAMODB_TABLE_PREFIX,
// DATABASE_URL, LEGACY_*_TABLE; .env.example documents them), or from an env file with
// --mode=<name>. The old tables are read from AWS_DATA_REGION (or DYNAMODB_ENDPOINT).
// Re-running is safe: every write is an upsert.

// No server runs here, so by default no .env file (and none of its server checks) applies.
if (!process.argv.some((a) => a.startsWith('--mode='))) process.argv.push('--mode=migrate')
const { default: config } = await import('../src/config/index.js')
const { closeDynamo, scanAll } = await import('../src/aws/dynamodb.js')

const write = process.argv.includes('--write')

console.log(`Reading the old tables from ${config.aws.dynamodbEndpoint || `DynamoDB in ${config.aws.region}`}…`)
const tables = {}
for (const [logical, TableName] of Object.entries(config.legacyTables)) {
  try {
    tables[logical] = await scanAll({ TableName })
    console.log(`  ${TableName}: ${tables[logical].length} items`)
  } catch (err) {
    if (err?.name !== 'ResourceNotFoundException') throw err
    tables[logical] = []
    console.log(`  ${TableName}: (no such table)`)
  }
}
await closeDynamo()

if (!write) config.drivers.db = 'memory'
const target =
  config.drivers.db === 'postgres'
    ? `Postgres (${config.database.url.replace(/\/\/[^@]*@/, '//…@')})`
    : config.drivers.db === 'memory'
      ? 'a throwaway in-memory database (dry run; add --write to import for real)'
      : `DynamoDB tables ${Object.values(config.tables).join(', ')} (${config.aws.dynamodbEndpoint || config.aws.region})`
console.log(`\nImporting into ${target}…`)

const { closeDatabase, initDatabase } = await import('../src/repositories/index.js')
const { importLegacy } = await import('../src/repositories/legacy.js')
await initDatabase({ seed: false })
try {
  const { counts, warnings } = await importLegacy(tables)
  console.log('\nRecords written:')
  for (const [what, n] of Object.entries(counts)) console.log(`  ${what}: ${n}`)
  console.log(warnings.length ? `\n${warnings.length} warning(s):\n  ${warnings.join('\n  ')}` : '\nNo warnings.')
} finally {
  await closeDatabase()
}
