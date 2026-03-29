import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { taskInputFromSchema } from './task-input.js'

describe('taskInputFromSchema', () => {
  it('returns a JsonPath reference for a single-field schema', () => {
    const schema = z.object({ playTableId: z.string() })
    expect(taskInputFromSchema(schema)).toEqual({
      'playTableId.$': '$.playTableId',
    })
  })

  it('returns JsonPath references for all fields in a multi-field schema', () => {
    const schema = z.object({
      playTableId: z.string(),
      rollRequestId: z.string(),
      isPrivate: z.boolean(),
    })
    expect(taskInputFromSchema(schema)).toEqual({
      'playTableId.$': '$.playTableId',
      'rollRequestId.$': '$.rollRequestId',
      'isPrivate.$': '$.isPrivate',
    })
  })
})
