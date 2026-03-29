import {
  EventDetailSchema,
  parseEventDetail,
} from '@puzzlebottom-tabletop-tools/graphql-types/events'
import { describe, expect, it } from 'vitest'

describe('@puzzlebottom-tabletop-tools/graphql-types/events', () => {
  it('exports EventDetailSchema as a Zod schema', () => {
    expect(EventDetailSchema).toBeDefined()
    expect(typeof EventDetailSchema.parse).toBe('function')
  })

  it('exports parseEventDetail as a function', () => {
    expect(typeof parseEventDetail).toBe('function')
  })
})
