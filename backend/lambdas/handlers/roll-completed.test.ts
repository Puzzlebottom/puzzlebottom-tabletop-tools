import { describe, expect, it } from 'vitest'

import { MINIMAL_CONTEXT } from '../../test/lambda-context.js'
import { handler } from './roll-completed'

describe('roll-completed handler', () => {
  it('parses valid RollCompleted detail without throwing', async () => {
    const event = {
      playTableId: 'pt-1',
      rollId: 'roll-1',
      rollRequestType: 'initiative',
      rollerId: 'p1',
      rollerType: 'player',
      values: [15],
      modifier: 2,
      total: 17,
    }

    await expect(handler(event, MINIMAL_CONTEXT)).resolves.toBeUndefined()
  })
})
