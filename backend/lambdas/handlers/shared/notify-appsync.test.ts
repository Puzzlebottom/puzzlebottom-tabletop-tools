import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  notifyInitiativeUpdated,
  notifyRollCompleted,
  notifyRollRequestCreated,
} from './notify-appsync.js'

const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}))

vi.stubGlobal('fetch', mockFetch)

describe('notify-appsync', () => {
  const graphqlUrl = 'https://xxx.appsync-api.us-east-1.amazonaws.com/graphql'

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.AWS_REGION = 'us-east-1'
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('{}') })
  })

  describe('notifyInitiativeUpdated', () => {
    it('calls AppSync and succeeds', async () => {
      await notifyInitiativeUpdated(graphqlUrl, 'pt-1', [
        { id: 'p1', characterName: 'Alice', value: 18, modifier: 2, total: 20 },
      ])
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('throws when response has GraphQL errors', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({ errors: [{ message: 'Not Authorized' }] })
          ),
      })
      await expect(
        notifyInitiativeUpdated(graphqlUrl, 'pt-1', [])
      ).rejects.toThrow('GraphQL errors')
    })
  })

  describe('notifyRollRequestCreated', () => {
    it('calls AppSync and succeeds', async () => {
      await notifyRollRequestCreated(graphqlUrl, {
        id: 'rr-1',
        playTableId: 'pt-1',
        targetPlayerIds: ['p1'],
        type: 'initiative',
        isPrivate: false,
        status: 'pending',
        createdAt: '2024-01-01T00:00:00Z',
      })
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('notifyRollCompleted', () => {
    it('calls AppSync and succeeds', async () => {
      await notifyRollCompleted(graphqlUrl, {
        playTableId: 'pt-1',
        rollId: 'r-1',
        values: [18],
        modifier: 2,
        total: 20,
        visibility: 'all',
      })
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('throws when response is not ok', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      })
      await expect(
        notifyRollCompleted(graphqlUrl, {
          playTableId: 'pt-1',
          rollId: 'r-1',
          values: [18],
          modifier: 2,
          total: 20,
          visibility: 'all',
        })
      ).rejects.toThrow('NotifyRollCompleted failed')
    })
  })
})
