import { describe, expect, it } from 'vitest'

import {
  DETAIL_TYPE_INITIATIVE_ROLL_REQUEST_CREATED,
  DETAIL_TYPE_PLAYER_JOINED,
  DETAIL_TYPE_PLAYER_LEFT,
  DETAIL_TYPE_ROLL_COMPLETED,
  EventBridgeEnvelopeSchema,
  EventDetailSchema,
  InitiativeRollRequestCreatedDetailSchema,
  parseEventDetail,
  PlayerJoinedDetailSchema,
  PlayerLeftDetailSchema,
  RollCompletedDetailSchema,
} from './events'

describe('EventBridgeEnvelopeSchema', () => {
  const validEnvelope = {
    version: '0',
    id: 'evt-123',
    'detail-type': 'InitiativeRollRequestCreated',
    source: 'puzzlebottom-tabletop-tools',
    detail: {
      playTableId: 'pt-1',
      rollRequestId: 'rr-1',
      targetPlayerIds: ['pk-1', 'pk-2'],
      expectedCount: 2,
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

describe('InitiativeRollRequestCreatedDetailSchema', () => {
  it('accepts valid detail', () => {
    const detail = {
      playTableId: 'pt-1',
      rollRequestId: 'rr-1',
      targetPlayerIds: ['pk-1'],
      expectedCount: 1,
    }
    expect(
      InitiativeRollRequestCreatedDetailSchema.safeParse(detail).success
    ).toBe(true)
  })

  it('rejects missing playTableId', () => {
    expect(
      InitiativeRollRequestCreatedDetailSchema.safeParse({
        rollRequestId: 'rr-1',
        targetPlayerIds: [],
        expectedCount: 0,
      }).success
    ).toBe(false)
  })

  it('rejects targetPlayerIds that is not an array of strings', () => {
    expect(
      InitiativeRollRequestCreatedDetailSchema.safeParse({
        playTableId: 'pt-1',
        rollRequestId: 'rr-1',
        targetPlayerIds: [123],
        expectedCount: 1,
      }).success
    ).toBe(false)
  })
})

describe('RollCompletedDetailSchema', () => {
  it('accepts valid detail with required fields only', () => {
    const detail = {
      playTableId: 'pt-1',
      rollId: 'roll-1',
      rollRequestType: 'ad_hoc' as const,
      rollerId: 'gm-sub',
      rollerType: 'gm' as const,
      values: [15],
      modifier: 3,
      total: 18,
    }
    expect(RollCompletedDetailSchema.safeParse(detail).success).toBe(true)
  })

  it('accepts valid detail with optional fields', () => {
    const detail = {
      playTableId: 'pt-1',
      rollId: 'roll-1',
      rollRequestId: 'rr-1',
      rollRequestType: 'initiative' as const,
      rollerId: 'pk-1',
      rollerType: 'player' as const,
      values: [12],
      modifier: 3,
      total: 15,
      advantage: 'advantage' as const,
      dc: 14,
      success: true,
    }
    expect(RollCompletedDetailSchema.safeParse(detail).success).toBe(true)
  })

  it('rejects invalid rollRequestType', () => {
    expect(
      RollCompletedDetailSchema.safeParse({
        playTableId: 'pt-1',
        rollId: 'roll-1',
        rollRequestType: 'invalid',
        rollerId: 'gm',
        rollerType: 'gm',
        values: [10],
        modifier: 0,
        total: 10,
      }).success
    ).toBe(false)
  })

  it('rejects invalid rollerType', () => {
    expect(
      RollCompletedDetailSchema.safeParse({
        playTableId: 'pt-1',
        rollId: 'roll-1',
        rollRequestType: 'ad_hoc',
        rollerId: 'gm',
        rollerType: 'npc',
        values: [10],
        modifier: 0,
        total: 10,
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
  it('accepts InitiativeRollRequestCreated', () => {
    const event = {
      detailType: DETAIL_TYPE_INITIATIVE_ROLL_REQUEST_CREATED,
      detail: {
        playTableId: 'pt-1',
        rollRequestId: 'rr-1',
        targetPlayerIds: ['pk-1'],
        expectedCount: 1,
      },
    }
    expect(EventDetailSchema.safeParse(event).success).toBe(true)
  })

  it('accepts RollCompleted', () => {
    const event = {
      detailType: DETAIL_TYPE_ROLL_COMPLETED,
      detail: {
        playTableId: 'pt-1',
        rollId: 'roll-1',
        rollRequestType: 'ad_hoc' as const,
        rollerId: 'gm',
        rollerType: 'gm' as const,
        values: [10],
        modifier: 0,
        total: 10,
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
  it('parses InitiativeRollRequestCreated envelope', () => {
    const envelope = {
      version: '0',
      id: 'evt-1',
      'detail-type': DETAIL_TYPE_INITIATIVE_ROLL_REQUEST_CREATED,
      source: 'puzzlebottom-tabletop-tools',
      detail: {
        playTableId: 'pt-1',
        rollRequestId: 'rr-1',
        targetPlayerIds: ['pk-1'],
        expectedCount: 1,
      },
    }
    const result = parseEventDetail(envelope)
    expect(result.detailType).toBe(DETAIL_TYPE_INITIATIVE_ROLL_REQUEST_CREATED)
    if (result.detailType === DETAIL_TYPE_INITIATIVE_ROLL_REQUEST_CREATED) {
      expect(result.detail.playTableId).toBe('pt-1')
      expect(result.detail.expectedCount).toBe(1)
    }
  })

  it('parses RollCompleted envelope', () => {
    const envelope = {
      version: '0',
      id: 'evt-2',
      'detail-type': DETAIL_TYPE_ROLL_COMPLETED,
      source: 'puzzlebottom-tabletop-tools',
      detail: {
        playTableId: 'pt-1',
        rollId: 'roll-1',
        rollRequestType: 'initiative',
        rollerId: 'pk-1',
        rollerType: 'player',
        values: [18],
        modifier: 3,
        total: 21,
      },
    }
    const result = parseEventDetail(envelope)
    expect(result.detailType).toBe(DETAIL_TYPE_ROLL_COMPLETED)
    if (result.detailType === DETAIL_TYPE_ROLL_COMPLETED) {
      expect(result.detail.rollId).toBe('roll-1')
      expect(result.detail.values).toEqual([18])
    }
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
    expect(result.detailType).toBe(DETAIL_TYPE_PLAYER_LEFT)
    if (result.detailType === DETAIL_TYPE_PLAYER_LEFT) {
      expect(result.detail.id).toBe('pk-1')
    }
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
    expect(result.detailType).toBe(DETAIL_TYPE_PLAYER_JOINED)
    if (result.detailType === DETAIL_TYPE_PLAYER_JOINED) {
      expect(result.detail.characterName).toBe('Aragorn')
    }
  })

  it('throws for unknown detail-type', () => {
    const envelope = {
      version: '0',
      id: 'evt-5',
      'detail-type': 'UnknownEvent',
      source: 'puzzlebottom-tabletop-tools',
      detail: {},
    }
    expect(() => parseEventDetail(envelope)).toThrow('Unknown detail-type')
  })

  it('throws when detail fails validation', () => {
    const envelope = {
      version: '0',
      id: 'evt-6',
      'detail-type': DETAIL_TYPE_PLAYER_LEFT,
      source: 'puzzlebottom-tabletop-tools',
      detail: { playTableId: 'pt-1' }, // missing id
    }
    expect(() => parseEventDetail(envelope)).toThrow()
  })
})
