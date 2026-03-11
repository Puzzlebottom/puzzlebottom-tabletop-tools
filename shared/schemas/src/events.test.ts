import { describe, expect, it } from 'vitest'

import {
  DETAIL_TYPE_PLAYER_JOINED,
  DETAIL_TYPE_PLAYER_LEFT,
  DETAIL_TYPE_ROLL_COMPLETED,
  DETAIL_TYPE_ROLL_REQUEST_COMPLETED,
  EventBridgeEnvelopeSchema,
  EventDetailSchema,
  parseEventDetail,
  PlayerJoinedDetailSchema,
  PlayerLeftDetailSchema,
  RollCompletedDetailSchema,
  RollRequestCompletedDetailSchema,
} from './events'

describe('EventBridgeEnvelopeSchema', () => {
  const validEnvelope = {
    version: '0',
    id: 'evt-123',
    'detail-type': 'RollCompleted',
    source: 'puzzlebottom-tabletop-tools',
    detail: {
      playTableId: 'pt-1',
      rollId: 'roll-1',
      rollerId: 'gm',
      rollNotation: 'd20',
      values: [10],
      modifier: 0,
      rollResult: 10,
      isPrivate: false,
      createdAt: '2025-01-01T00:00:00.000Z',
    },
  }

  it('accepts valid event envelopes', () => {
    expect(EventBridgeEnvelopeSchema.safeParse(validEnvelope).success).toBe(
      true
    )
  })

  it('rejects missing detail-type', () => {
    const invalidEnvelope = {
      version: validEnvelope.version,
      id: validEnvelope.id,
      source: validEnvelope.source,
      detail: validEnvelope.detail,
    }
    expect(EventBridgeEnvelopeSchema.safeParse(invalidEnvelope).success).toBe(
      false
    )
  })

  it('rejects missing detail', () => {
    expect(
      EventBridgeEnvelopeSchema.safeParse({
        version: '0',
        id: 'evt-123',
        'detail-type': 'RollCompleted',
        source: 'puzzlebottom-tabletop-tools',
      }).success
    ).toBe(false)
  })

  it('rejects envelope that is not an object', () => {
    expect(EventBridgeEnvelopeSchema.safeParse('string').success).toBe(false)
  })
})

describe('RollCompletedDetailSchema', () => {
  const validDetail = {
    playTableId: 'pt-1',
    rollId: 'roll-1',
    rollerId: 'gm-sub',
    rollNotation: 'd20',
    values: [15],
    modifier: 3,
    rollResult: 18,
    isPrivate: false,
    createdAt: '2025-01-01T00:00:00.000Z',
  }

  it('accepts valid detail with required fields only', () => {
    expect(RollCompletedDetailSchema.safeParse(validDetail).success).toBe(true)
  })

  it('accepts valid detail with optional fields', () => {
    const detail = {
      ...validDetail,
      rollRequestId: 'rr-1',
      type: 'initiative' as const,
      deletedAt: null,
    }
    expect(RollCompletedDetailSchema.safeParse(detail).success).toBe(true)
  })

  it('rejects invalid type', () => {
    expect(
      RollCompletedDetailSchema.safeParse({
        ...validDetail,
        type: 'invalid',
      }).success
    ).toBe(false)
  })

  it('rejects missing required fields', () => {
    const { rollNotation, ...withoutRollNotation } = validDetail
    void rollNotation
    expect(
      RollCompletedDetailSchema.safeParse(withoutRollNotation).success
    ).toBe(false)
  })
})

describe('RollRequestCompletedDetailSchema', () => {
  it('accepts valid detail', () => {
    const detail = {
      playTableId: 'pt-1',
      rollRequestId: 'rr-1',
      type: 'initiative' as const,
      timestamps: {
        createdAt: '2024-01-01T00:00:00Z',
        completedAt: '2024-01-01T00:01:00Z',
      },
      playerIds: ['pk-1', 'pk-2'],
      rollIds: ['roll-1', 'roll-2'],
      initiatedBy: 'gm-sub',
    }
    expect(RollRequestCompletedDetailSchema.safeParse(detail).success).toBe(
      true
    )
  })

  it('rejects invalid type', () => {
    expect(
      RollRequestCompletedDetailSchema.safeParse({
        playTableId: 'pt-1',
        rollRequestId: 'rr-1',
        type: 'attack',
        timestamps: {
          createdAt: '2024-01-01T00:00:00Z',
          completedAt: '2024-01-01T00:01:00Z',
        },
        playerIds: ['pk-1'],
        rollIds: ['roll-1'],
        initiatedBy: 'gm-sub',
      }).success
    ).toBe(false)
  })

  it('rejects missing timestamps', () => {
    expect(
      RollRequestCompletedDetailSchema.safeParse({
        playTableId: 'pt-1',
        rollRequestId: 'rr-1',
        type: 'initiative',
        playerIds: [],
        rollIds: [],
        initiatedBy: 'gm-sub',
      }).success
    ).toBe(false)
  })
})

describe('PlayerLeftDetailSchema', () => {
  it('accepts valid detail', () => {
    const detail = { playTableId: 'pt-1', id: 'pk-1' }
    expect(PlayerLeftDetailSchema.safeParse(detail).success).toBe(true)
  })

  it('rejects missing id', () => {
    expect(
      PlayerLeftDetailSchema.safeParse({ playTableId: 'pt-1' }).success
    ).toBe(false)
  })
})

describe('PlayerJoinedDetailSchema', () => {
  it('accepts valid detail', () => {
    const detail = {
      playTableId: 'pt-1',
      id: 'pk-1',
      characterName: 'Frodo',
      initiativeModifier: 2,
    }
    expect(PlayerJoinedDetailSchema.safeParse(detail).success).toBe(true)
  })

  it('rejects missing characterName', () => {
    expect(
      PlayerJoinedDetailSchema.safeParse({
        playTableId: 'pt-1',
        id: 'pk-1',
        initiativeModifier: 0,
      }).success
    ).toBe(false)
  })
})

describe('EventDetailSchema', () => {
  it('accepts RollCompleted', () => {
    const event = {
      detailType: DETAIL_TYPE_ROLL_COMPLETED,
      detail: {
        playTableId: 'pt-1',
        rollId: 'roll-1',
        rollerId: 'gm',
        rollNotation: 'd20',
        values: [10],
        modifier: 0,
        rollResult: 10,
        isPrivate: false,
        createdAt: '2025-01-01T00:00:00.000Z',
      },
    }
    expect(EventDetailSchema.safeParse(event).success).toBe(true)
  })

  it('accepts PlayerLeft', () => {
    const event = {
      detailType: DETAIL_TYPE_PLAYER_LEFT,
      detail: { playTableId: 'pt-1', id: 'pk-1' },
    }
    expect(EventDetailSchema.safeParse(event).success).toBe(true)
  })

  it('accepts PlayerJoined', () => {
    const event = {
      detailType: DETAIL_TYPE_PLAYER_JOINED,
      detail: {
        playTableId: 'pt-1',
        id: 'pk-1',
        characterName: 'Gandalf',
        initiativeModifier: 3,
      },
    }
    expect(EventDetailSchema.safeParse(event).success).toBe(true)
  })

  it('accepts RollRequestCompleted', () => {
    const event = {
      detailType: DETAIL_TYPE_ROLL_REQUEST_COMPLETED,
      detail: {
        playTableId: 'pt-1',
        rollRequestId: 'rr-1',
        type: 'initiative' as const,
        timestamps: {
          createdAt: '2024-01-01T00:00:00Z',
          completedAt: '2024-01-01T00:01:00Z',
        },
        playerIds: ['pk-1', 'pk-2'],
        rollIds: ['roll-1', 'roll-2'],
        initiatedBy: 'gm-sub',
      },
    }
    expect(EventDetailSchema.safeParse(event).success).toBe(true)
  })

  it('rejects unknown detailType', () => {
    expect(
      EventDetailSchema.safeParse({
        detailType: 'UnknownEvent',
        detail: {},
      }).success
    ).toBe(false)
  })
})

describe('parseEventDetail', () => {
  it('parses RollCompleted envelope', () => {
    const envelope = {
      version: '0',
      id: 'evt-2',
      'detail-type': DETAIL_TYPE_ROLL_COMPLETED,
      source: 'puzzlebottom-tabletop-tools',
      detail: {
        playTableId: 'pt-1',
        rollId: 'roll-1',
        type: 'initiative' as const,
        rollerId: 'pk-1',
        rollNotation: 'd20',
        values: [18],
        modifier: 3,
        rollResult: 21,
        isPrivate: false,
        createdAt: '2025-01-01T00:00:00.000Z',
      },
    }
    const result = parseEventDetail(envelope)
    expect(result).toMatchObject({
      detailType: DETAIL_TYPE_ROLL_COMPLETED,
      detail: { rollId: 'roll-1', values: [18] },
    })
  })

  it('parses PlayerLeft envelope', () => {
    const envelope = {
      version: '0',
      id: 'evt-3',
      'detail-type': DETAIL_TYPE_PLAYER_LEFT,
      source: 'puzzlebottom-tabletop-tools',
      detail: { playTableId: 'pt-1', id: 'pk-1' },
    }
    const result = parseEventDetail(envelope)
    expect(result).toMatchObject({
      detailType: DETAIL_TYPE_PLAYER_LEFT,
      detail: { id: 'pk-1' },
    })
  })

  it('parses PlayerJoined envelope', () => {
    const envelope = {
      version: '0',
      id: 'evt-4',
      'detail-type': DETAIL_TYPE_PLAYER_JOINED,
      source: 'puzzlebottom-tabletop-tools',
      detail: {
        playTableId: 'pt-1',
        id: 'pk-1',
        characterName: 'Aragorn',
        initiativeModifier: 2,
      },
    }
    const result = parseEventDetail(envelope)
    expect(result).toMatchObject({
      detailType: DETAIL_TYPE_PLAYER_JOINED,
      detail: { characterName: 'Aragorn' },
    })
  })

  it('parses RollRequestCompleted envelope', () => {
    const envelope = {
      version: '0',
      id: 'evt-5',
      'detail-type': DETAIL_TYPE_ROLL_REQUEST_COMPLETED,
      source: 'puzzlebottom-tabletop-tools',
      detail: {
        playTableId: 'pt-1',
        rollRequestId: 'rr-1',
        type: 'initiative' as const,
        timestamps: {
          createdAt: '2024-01-01T00:00:00Z',
          completedAt: '2024-01-01T00:01:00Z',
        },
        playerIds: ['pk-1', 'pk-2'],
        rollIds: ['roll-1', 'roll-2'],
        initiatedBy: 'gm-sub',
      },
    }
    const result = parseEventDetail(envelope)
    expect(result).toMatchObject({
      detailType: DETAIL_TYPE_ROLL_REQUEST_COMPLETED,
      detail: {
        rollRequestId: 'rr-1',
        playerIds: ['pk-1', 'pk-2'],
      },
    })
  })

  it('throws for unknown detail-type', () => {
    const envelope = {
      version: '0',
      id: 'evt-6',
      'detail-type': 'UnknownEvent',
      source: 'puzzlebottom-tabletop-tools',
      detail: {},
    }
    expect(() => parseEventDetail(envelope)).toThrow('Unknown detail-type')
  })

  it('throws when detail fails validation', () => {
    const envelope = {
      version: '0',
      id: 'evt-7',
      'detail-type': DETAIL_TYPE_PLAYER_LEFT,
      source: 'puzzlebottom-tabletop-tools',
      detail: { playTableId: 'pt-1' }, // missing id
    }
    expect(() => parseEventDetail(envelope)).toThrow()
  })
})
