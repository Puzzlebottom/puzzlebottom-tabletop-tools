import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  publishInitiativeUpdated,
  publishRollCompleted,
  publishRollRequestCreated,
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

  describe('publishInitiativeUpdated', () => {
    it('calls AppSync and succeeds', async () => {
      await publishInitiativeUpdated(graphqlUrl, {
        rolls: [
          {
            id: 'r-1',
            playTableId: 'pt-1',
            rollerId: 'p1',
            rollNotation: 'd20',
            values: [18],
            modifier: 2,
            rollResult: 20,
            isPrivate: false,
            type: 'initiative',
            rollRequestId: 'rr-1',
            createdAt: '2024-01-01T00:00:00Z',
            deletedAt: null,
          },
        ],
      })
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
        publishInitiativeUpdated(graphqlUrl, { rolls: [] })
      ).rejects.toThrow('GraphQL errors')
    })
  })

  describe('publishRollRequestCreated', () => {
    it('calls AppSync and succeeds', async () => {
      await publishRollRequestCreated(graphqlUrl, {
        id: 'rr-1',
        playTableId: 'pt-1',
        targetPlayerIds: ['p1'],
        rollNotation: 'd20',
        type: 'initiative',
        isPrivate: false,
        createdAt: '2024-01-01T00:00:00Z',
        deletedAt: null,
        rolls: [],
      })
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('publishRollCompleted', () => {
    it('calls AppSync and succeeds', async () => {
      await publishRollCompleted(graphqlUrl, {
        id: 'r-1',
        playTableId: 'pt-1',
        rollerId: 'p1',
        rollNotation: 'd20',
        values: [18],
        modifier: 2,
        rollResult: 20,
        isPrivate: false,
        type: 'initiative',
        rollRequestId: 'rr-1',
        createdAt: '2024-01-01T00:00:00Z',
        deletedAt: null,
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
        publishRollCompleted(graphqlUrl, {
          id: 'r-1',
          playTableId: 'pt-1',
          rollerId: 'p1',
          rollNotation: 'd20',
          values: [18],
          modifier: 2,
          rollResult: 20,
          isPrivate: false,
          type: 'initiative',
          rollRequestId: 'rr-1',
          createdAt: '2024-01-01T00:00:00Z',
          deletedAt: null,
        })
      ).rejects.toThrow('PublishRollCompleted failed')
    })
  })
})
