import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn'
import {
  DataRecordSchema,
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

    const envelope = parseResult.data
    if (envelope['detail-type'] !== 'DataSubmitted') {
      console.error(
        `Unsupported detail-type: ${envelope['detail-type']}. Skipping record`
      )
      continue
    }

    const detailResult = DataRecordSchema.safeParse(envelope.detail)
    if (!detailResult.success) {
      console.error(
        'Invalid DataSubmitted detail:',
        detailResult.error.flatten().formErrors.join(', '),
        'Skipping record'
      )
      continue
    }

    const pipelineId = randomUUID()

    const stepInput: StepInput = {
      record: detailResult.data,
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
