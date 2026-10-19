// Prints the DynamoDB table definitions (CreateTable input, one per table) for the
// configured DYNAMODB_TABLE_PREFIX. Nothing is created. For example:
//   npm run --silent tables:print > tables.json
// then, per table: aws dynamodb create-table --cli-input-json "$(jq '.[0]' tables.json)"
import { tableDefinitions } from '../src/dev/schema.js'

console.log(JSON.stringify(tableDefinitions(), null, 2))
