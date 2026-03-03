import { describe, expect, it } from 'vitest'

import { PlayTableSchema } from './domain'

describe('PlayTableSchema', () => {
  const validPlayTable = {
    id: 'pt-123',
    gmUserId: 'cognito-sub-abc',
    inviteCode: 'ABC123',
    createdAt: '2025-01-01T00:00:00.000Z',
  }

  it('accepts valid play table', () => {
    expect(PlayTableSchema.safeParse(validPlayTable).success).toBe(true)
  })

  it('rejects missing id', () => {
    const { id, ...withoutId } = validPlayTable
    void id
    expect(PlayTableSchema.safeParse(withoutId).success).toBe(false)
  })

  it('rejects missing gmUserId', () => {
    const { gmUserId, ...withoutGmUserId } = validPlayTable
    void gmUserId
    expect(PlayTableSchema.safeParse(withoutGmUserId).success).toBe(false)
  })

  it('rejects missing inviteCode', () => {
    const { inviteCode, ...withoutInviteCode } = validPlayTable
    void inviteCode
    expect(PlayTableSchema.safeParse(withoutInviteCode).success).toBe(false)
  })

  it('rejects missing createdAt', () => {
    const { createdAt, ...withoutCreatedAt } = validPlayTable
    void createdAt
    expect(PlayTableSchema.safeParse(withoutCreatedAt).success).toBe(false)
  })

  it('rejects invalid types', () => {
    expect(
      PlayTableSchema.safeParse({ ...validPlayTable, id: 123 }).success
    ).toBe(false)
    expect(
      PlayTableSchema.safeParse({ ...validPlayTable, gmUserId: null }).success
    ).toBe(false)
  })
})
