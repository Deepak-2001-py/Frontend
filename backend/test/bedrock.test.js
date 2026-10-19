// The real Bedrock client path (AI_DRIVER=bedrock) against a local fake of the
// Bedrock Mantle Messages endpoint: request shape, refusal fallback, refusals.
import assert from 'node:assert/strict'
import http from 'node:http'
import { after, before, test } from 'node:test'

const requests = []
let mode = 'ok'
const fake = http.createServer((req, res) => {
  let raw = ''
  req.on('data', (c) => (raw += c))
  req.on('end', () => {
    const body = JSON.parse(raw)
    requests.push({ path: req.url, headers: req.headers, body })
    if (mode === 'no-structured-outputs' && body.output_config?.format) {
      res.writeHead(400, { 'content-type': 'application/json' })
      return res.end(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'output_config.format: not supported' } }))
    }
    const refuse = mode === 'refuse-all' || (mode === 'refuse-primary' && body.model === 'anthropic.claude-opus-5-5')
    const message = {
      id: `msg_${requests.length}`,
      type: 'message',
      role: 'assistant',
      model: body.model,
      content: refuse ? [] : [{ type: 'text', text: `hello from ${body.model}` }],
      stop_reason: refuse ? 'refusal' : 'end_turn',
      stop_sequence: null,
      stop_details: refuse ? { type: 'refusal', category: 'cyber', explanation: null, fallback_credit_token: 'credit-1' } : null,
      usage: { input_tokens: 10, output_tokens: refuse ? 0 : 5 },
    }
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(message))
  })
})

before(async () => {
  await new Promise((resolve) => fake.listen(0, '127.0.0.1', resolve))
  process.env.ANTHROPIC_BEDROCK_MANTLE_BASE_URL = `http://127.0.0.1:${fake.address().port}`
  process.env.AWS_BEARER_TOKEN_BEDROCK = 'test-bearer-token' // bearer auth: no AWS credential lookup
  process.env.AI_DRIVER = 'bedrock'
})
after(() => fake.close())

const load = () => import('../test/helpers.js').then(() => import('../src/aws/bedrock.js'))

test('sends the workflow request shape to the configured model', async () => {
  const { askClaude } = await load()
  mode = 'ok'
  const text = await askClaude({ system: 'sys', messages: [{ role: 'user', content: 'hi' }], effort: 'low' })
  assert.equal(text, 'hello from anthropic.claude-opus-5-5')
  const { body, path } = requests.at(-1)
  assert.match(path, /\/v1\/messages/)
  assert.equal(body.model, 'anthropic.claude-opus-5-5')
  assert.equal(body.max_tokens, 16000)
  assert.equal(body.system, 'sys')
  assert.deepEqual(body.output_config, { effort: 'low' })
})

test('passes a json_schema output format', async () => {
  const { askClaude } = await load()
  mode = 'ok'
  const format = { type: 'json_schema', schema: { type: 'object' } }
  await askClaude({ system: 's', messages: [{ role: 'user', content: 'x' }], effort: 'medium', outputFormat: format })
  assert.deepEqual(requests.at(-1).body.output_config, { effort: 'medium', format })
})

test('a refusal is retried on the fallback model', async () => {
  const { askClaude } = await load()
  mode = 'refuse-primary'
  requests.length = 0
  const text = await askClaude({ system: 's', messages: [{ role: 'user', content: 'x' }], effort: 'low' })
  assert.equal(text, 'hello from anthropic.claude-opus-5')
  assert.deepEqual(
    requests.map((r) => r.body.model),
    ['anthropic.claude-opus-5-5', 'anthropic.claude-opus-5'],
  )
})

test('returns null when every model declines', async () => {
  const { askClaude } = await load()
  mode = 'refuse-all'
  assert.equal(await askClaude({ system: 's', messages: [{ role: 'user', content: 'x' }], effort: 'low' }), null)
})

test('without structured outputs, retries asking for JSON in the prompt', async () => {
  const { askClaude } = await load()
  mode = 'no-structured-outputs'
  requests.length = 0
  const schema = { type: 'object', properties: { items: { type: 'array' } } }
  const text = await askClaude({ system: 'sys', messages: [{ role: 'user', content: 'x' }], effort: 'medium', outputFormat: { type: 'json_schema', schema } })
  assert.equal(text, 'hello from anthropic.claude-opus-5-5')
  assert.equal(requests.length, 2)
  assert.deepEqual(requests[1].body.output_config, { effort: 'medium' })
  assert.ok(requests[1].body.system.startsWith('sys\n\nRespond with only a JSON object'))
  assert.ok(requests[1].body.system.includes(JSON.stringify(schema)))
})
