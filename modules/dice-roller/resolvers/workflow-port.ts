import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn'
import type { GenerateAndStoreRollPayload } from '@puzzlebottom-tabletop-tools/schemas/steps/roll-pipeline'
import type { RollRequestStepPayload } from '@puzzlebottom-tabletop-tools/schemas/steps/roll-request-pipeline'

import type { IDiceRollerWorkflowPort } from '../application/index.js'

export function createWorkflowPort(config: {
  rollRequestStateMachineArn: string
  rollStateMachineArn: string
}): IDiceRollerWorkflowPort {
  const sfn = new SFNClient({})

  return {
    async startRollRequestPipeline(
      payload: RollRequestStepPayload
    ): Promise<void> {
      await sfn.send(
        new StartExecutionCommand({
          stateMachineArn: config.rollRequestStateMachineArn,
          name: payload.rollRequestId,
          input: JSON.stringify(payload),
        })
      )
    },

    async startRollPipeline(
      payload: GenerateAndStoreRollPayload
    ): Promise<void> {
      await sfn.send(
        new StartExecutionCommand({
          stateMachineArn: config.rollStateMachineArn,
          name: `roll-${payload.rollId}`,
          input: JSON.stringify(payload),
        })
      )
    },
  }
}
