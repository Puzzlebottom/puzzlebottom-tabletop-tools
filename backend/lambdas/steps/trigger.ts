import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn'
import {
  EventBridgeEventBodySchema,
  type StepInput,
} from '@puzzlebottom-tabletop-tools/schemas'
import { type SQSHandler } from 'aws-lambda'
import { randomUUID } from 'crypto'

const sfnClient = new SFNClient({})
const STATE_MACHINE_ARN = process.env.STATE_MACHINE_ARN!

export const handler: SQSHandler = async (event) => {
  for (const sqsRecord of event.Records) {
    let parsed: unknown
    try {
      parsed = JSON.parse(sqsRecord.body)
    } catch {
      console.error('Invalid JSON in SQS message body, skipping record')
      continue
    }

    const parseResult = EventBridgeEventBodySchema.safeParse(parsed)
    if (!parseResult.success) {
      console.error(
        'Invalid EventBridge event body:',
        parseResult.error.flatten().formErrors.join(', '),
        'Skipping record'
      )
      continue
    }

    const { detail } = parseResult.data
    const pipelineId = randomUUID()

    const stepInput: StepInput = {
      record: detail,
      pipelineId,
      timestamp: new Date().toISOString(),
    }

    await sfnClient.send(
      new StartExecutionCommand({
        stateMachineArn: STATE_MACHINE_ARN,
        name: pipelineId,
        input: JSON.stringify(stepInput),
      })
    )

    console.log(`Started pipeline execution: ${pipelineId}`)
  }
}
