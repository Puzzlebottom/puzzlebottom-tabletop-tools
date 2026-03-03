import { describe, expect, it } from 'vitest'

import { MINIMAL_CONTEXT } from '../../test/lambda-context.js'
import { handler } from './player-left'

describe('player-left handler', () => {
  it('parses valid PlayerLeft detail without throwing', async () => {
    const event = { playTableId: 'pt-1', id: 'p1' }

    await expect(handler(event, MINIMAL_CONTEXT)).resolves.toBeUndefined()
  })
})
