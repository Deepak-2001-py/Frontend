// Claude on Amazon Bedrock (Bedrock Mantle Messages API) for the GradeFlow
// assistant and rubric drafting. A policy decline (stop_reason "refusal") is
// retried on BEDROCK_FALLBACK_MODEL_ID by the SDK's client-side refusal-fallback
// middleware, as workflow.py did. AI_DRIVER=canned (development) never calls AWS.
import { AnthropicBedrockMantle } from '@anthropic-ai/bedrock-sdk'
import Anthropic, { BetaFallbackState, betaRefusalFallbackMiddleware } from '@anthropic-ai/sdk'
import config from '../config/index.js'

let claude
let override

function client() {
  claude ??= new AnthropicBedrockMantle({
    awsRegion: config.bedrock.region,
    middleware: [betaRefusalFallbackMiddleware([{ model: config.bedrock.fallbackModelId }])],
  })
  return claude
}

/**
 * Returns Claude's text reply, or null when every model in the chain declined.
 * `outputFormat` (a json_schema format) makes the reply a JSON string.
 */
export async function askClaude({ system, messages, effort, maxTokens = 16000, outputFormat }) {
  if (override) return override({ system, messages, effort, maxTokens, outputFormat })
  if (config.drivers.ai === 'canned') {
    // Keep the default rubric; give the assistant a clear "not connected" reply.
    return outputFormat ? null : '(Local dev server — Claude is not called. Set AI_DRIVER=bedrock to use Amazon Bedrock.)'
  }
  // One fallback state per call: each request starts on the primary model.
  const create = (params) => client().beta.messages.create(params, { fallbackState: new BetaFallbackState() })
  const base = { model: config.bedrock.modelId, max_tokens: maxTokens, system, messages }
  let response
  try {
    response = await create({ ...base, output_config: { effort, ...(outputFormat ? { format: outputFormat } : {}) } })
  } catch (err) {
    // Structured outputs aren't available on every Bedrock deployment; ask for
    // the JSON in the prompt instead (callers parse it leniently).
    if (!outputFormat || !(err instanceof Anthropic.BadRequestError)) throw err
    response = await create({
      ...base,
      system: `${system}\n\nRespond with only a JSON object matching this JSON Schema, and no other text:\n${JSON.stringify(outputFormat.schema)}`,
      output_config: { effort },
    })
  }
  if (response.stop_reason === 'refusal') return null
  return response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
}

/** Tests replace Claude with a fake; pass undefined to restore. */
export function setClaudeOverride(fn) {
  override = fn
}
