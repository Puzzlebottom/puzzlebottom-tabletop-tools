import { describe, expect, it } from 'vitest'

import { MINIMAL_CONTEXT } from '../../test/lambda-context.js'
import { handler } from './player-joined'

describe('player-joined handler', () => {
  it('parses valid PlayerJoined detail without throwing', async () => {
    const event = {
      playTableId: 'pt-1',
      id: 'p1',
      characterName: 'Alice',
      initiativeModifier: 3,
    }

    await expect(handler(event, MINIMAL_CONTEXT)).resolves.toBeUndefined()
  })
})
