import { describe, expect, it } from 'vitest'

import { PlayerSchema } from './player'

describe('PlayerSchema', () => {
  const validPlayer = {
    playerKey: 'pk-abc-123',
    characterName: 'Gandalf',
    initiativeModifier: 2,
  }

  it('accepts valid player', () => {
    expect(PlayerSchema.safeParse(validPlayer).success).toBe(true)
  })

  it('rejects missing playerKey', () => {
    const { playerKey, ...withoutPlayerKey } = validPlayer
    void playerKey
    expect(PlayerSchema.safeParse(withoutPlayerKey).success).toBe(false)
  })

  it('rejects missing characterName', () => {
    const { characterName, ...withoutCharacterName } = validPlayer
    void characterName
    expect(PlayerSchema.safeParse(withoutCharacterName).success).toBe(false)
  })

  it('rejects missing initiativeModifier', () => {
    const { initiativeModifier, ...withoutModifier } = validPlayer
    void initiativeModifier
    expect(PlayerSchema.safeParse(withoutModifier).success).toBe(false)
  })

  it('rejects initiativeModifier that is not a number', () => {
    expect(
      PlayerSchema.safeParse({
        ...validPlayer,
        initiativeModifier: '2',
      }).success
    ).toBe(false)
  })
})
