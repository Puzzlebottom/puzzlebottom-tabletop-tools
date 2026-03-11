import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda'
import {
  DETAIL_TYPE_PLAYER_JOINED,
  DETAIL_TYPE_PLAYER_LEFT,
  DETAIL_TYPE_ROLL_COMPLETED,
  DETAIL_TYPE_ROLL_REQUEST_COMPLETED,
  EventBridgeEventBodySchema,
  parseEventDetail,
  RollCompletedDetailSchema,
  RollRequestCompletedDetailSchema,
} from '@puzzlebottom-tabletop-tools/schemas'
import type { SQSHandler } from 'aws-lambda'

const lambdaClient = new LambdaClient({})
const ROLL_COMPLETED_HANDLER_ARN = process.env.ROLL_COMPLETED_HANDLER_ARN!
const PLAYER_LEFT_HANDLER_ARN = process.env.PLAYER_LEFT_HANDLER_ARN!
const PLAYER_JOINED_HANDLER_ARN = process.env.PLAYER_JOINED_HANDLER_ARN!

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
    const detailType = envelope['detail-type']

    try {
      switch (detailType) {
        case DETAIL_TYPE_ROLL_REQUEST_COMPLETED: {
          const detailResult = RollRequestCompletedDetailSchema.safeParse(
            envelope.detail
          )
          if (!detailResult.success) {
            console.error(
              'Invalid RollRequestCompleted detail:',
              detailResult.error.flatten().formErrors.join(', '),
              'Skipping record'
            )
            continue
          }
          console.log(
            `Roll request completed: ${detailResult.data.rollRequestId} (validate/ack only)`
          )
          break
        }

        case DETAIL_TYPE_ROLL_COMPLETED: {
          const detailResult = RollCompletedDetailSchema.safeParse(
            envelope.detail
          )
          if (!detailResult.success) {
            console.error(
              'Invalid RollCompleted detail:',
              detailResult.error.flatten().formErrors.join(', '),
              'Skipping record'
            )
            continue
          }
          if (detailResult.data.type !== 'initiative') {
            continue
          }
          await lambdaClient.send(
            new InvokeCommand({
              FunctionName: ROLL_COMPLETED_HANDLER_ARN,
              InvocationType: 'Event',
              Payload: JSON.stringify(detailResult.data),
            })
          )
          console.log(
            `Invoked roll-completed handler for roll ${detailResult.data.rollId}`
          )
          break
        }

        case DETAIL_TYPE_PLAYER_LEFT: {
          const parsedEvent = parseEventDetail(envelope)
          if (parsedEvent.detailType !== DETAIL_TYPE_PLAYER_LEFT) continue
          await lambdaClient.send(
            new InvokeCommand({
              FunctionName: PLAYER_LEFT_HANDLER_ARN,
              InvocationType: 'Event',
              Payload: JSON.stringify(parsedEvent.detail),
            })
          )
          console.log(
            `Invoked player-left handler for player ${parsedEvent.detail.id}`
          )
          break
        }

        case DETAIL_TYPE_PLAYER_JOINED: {
          const parsedEvent = parseEventDetail(envelope)
          if (parsedEvent.detailType !== DETAIL_TYPE_PLAYER_JOINED) continue
          await lambdaClient.send(
            new InvokeCommand({
              FunctionName: PLAYER_JOINED_HANDLER_ARN,
              InvocationType: 'Event',
              Payload: JSON.stringify(parsedEvent.detail),
            })
          )
          console.log(
            `Invoked player-joined handler for player ${parsedEvent.detail.id}`
          )
          break
        }

        default:
          console.error(
            `Unsupported detail-type: ${detailType}. Skipping record`
          )
      }
    } catch (err) {
      console.error('Dispatcher error:', err)
      throw err
    }
  }
}
