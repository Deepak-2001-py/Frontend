// Hands a submission to the grading pipeline Lambda (GRADING_FUNCTION_NAME),
// asynchronously — the same "Event" invoke workflow.py made. In development
// (GRADING_DRIVER=log) the request is only logged.
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda'
import config from '../config/index.js'

let lambda
export const gradingRequests = [] // development/test inspection only

export async function triggerGrading(payload) {
  const fn = config.grading.functionName
  if (!fn) return
  if (config.drivers.grading === 'log') {
    gradingRequests.push(payload)
    console.log(JSON.stringify({ level: 'info', msg: 'grading request (not sent: GRADING_DRIVER=log)', ...payload, rubric: undefined }))
    return
  }
  lambda ??= new LambdaClient({ region: config.aws.region })
  await lambda.send(
    new InvokeCommand({ FunctionName: fn, InvocationType: 'Event', Payload: Buffer.from(JSON.stringify(payload)) }),
  )
}
