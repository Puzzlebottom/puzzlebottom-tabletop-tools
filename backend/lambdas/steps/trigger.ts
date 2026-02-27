import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn'
import { type SQSHandler } from 'aws-lambda'
import { randomUUID } from 'crypto'

import { type StepInput } from '../../shared/types'

const sfnClient = new SFNClient({})
const STATE_MACHINE_ARN = process.env.STATE_MACHINE_ARN!

interface EventBridgeEventBody {
  detail: StepInput['record']
}

export const handler: SQSHandler = async (event) => {
  for (const sqsRecord of event.Records) {
    const eventBridgeEvent = JSON.parse(sqsRecord.body) as EventBridgeEventBody
    const { detail } = eventBridgeEvent

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
