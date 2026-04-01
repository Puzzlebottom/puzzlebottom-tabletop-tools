import {
  EventBridgeClient,
  PutEventsCommand,
} from '@aws-sdk/client-eventbridge'
import {
  DETAIL_TYPE_PLAYER_JOINED,
  DETAIL_TYPE_PLAYER_LEFT,
  EVENT_SOURCE,
  type PlayerJoinedDetail,
  PlayerJoinedDetailSchema,
  type PlayerLeftDetail,
  PlayerLeftDetailSchema,
} from '@puzzlebottom-tabletop-tools/schemas'

import type { IPlayTableEventPort } from '../application/index.js'

export function createEventPort(eventBusName: string): IPlayTableEventPort {
  const eb = new EventBridgeClient({})
  return {
    async publishPlayerJoined(detail: PlayerJoinedDetail): Promise<void> {
      const parsed = PlayerJoinedDetailSchema.parse(detail)
      await eb.send(
        new PutEventsCommand({
          Entries: [
            {
              Source: EVENT_SOURCE,
              DetailType: DETAIL_TYPE_PLAYER_JOINED,
              Detail: JSON.stringify(parsed),
              EventBusName: eventBusName,
            },
          ],
        })
      )
    },
    async publishPlayerLeft(detail: PlayerLeftDetail): Promise<void> {
      const parsed = PlayerLeftDetailSchema.parse(detail)
      await eb.send(
        new PutEventsCommand({
          Entries: [
            {
              Source: EVENT_SOURCE,
              DetailType: DETAIL_TYPE_PLAYER_LEFT,
              Detail: JSON.stringify(parsed),
              EventBusName: eventBusName,
            },
          ],
        })
      )
    },
  }
}
