import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { JoinPlayTablePage } from './JoinPlayTablePage'

const { mockGraphql, mockGetStoredPlayer, mockStorePlayer } = vi.hoisted(
  () => ({
    mockGraphql: vi.fn(),
    mockGetStoredPlayer: vi.fn(),
    mockStorePlayer: vi.fn(),
  })
)

vi.mock('aws-amplify/api', () => ({
  generateClient: () => ({ graphql: mockGraphql }),
}))

vi.mock('../lib/player-storage', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- test mock
  getStoredPlayer: () => mockGetStoredPlayer(),
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- test mock
  storePlayer: (...args: unknown[]) => mockStorePlayer(...args),
}))

describe('JoinPlayTablePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetStoredPlayer.mockReturnValue(null)
    mockGraphql.mockResolvedValue({
      data: { playTableByInviteCode: null },
    })
  })

  it('renders join form with invite code', async () => {
    render(
      <MemoryRouter initialEntries={['/dice/join/ABC123']}>
        <Routes>
          <Route
            path="/dice/join/:inviteCode"
            element={<JoinPlayTablePage />}
          />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Invite code: ABC123/)).toBeInTheDocument()
    })
    expect(screen.getByLabelText(/Character name/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Initiative modifier/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Join/ })).toBeInTheDocument()
  })

  it('calls joinPlayTable and stores player on success', async () => {
    const user = userEvent.setup()
    mockGraphql.mockImplementation((args: { query?: string }) => {
      if (args.query?.includes('PlayTableByInviteCode')) {
        return Promise.resolve({
          data: { playTableByInviteCode: null },
        })
      }
      return Promise.resolve({
        data: {
          joinPlayTable: {
            id: 'player-123',
            playTableId: 'table-456',
          },
        },
      })
    })

    render(
      <MemoryRouter initialEntries={['/dice/join/ABC123']}>
        <Routes>
          <Route
            path="/dice/join/:inviteCode"
            element={<JoinPlayTablePage />}
          />
          <Route
            path="/dice/table/:playTableId"
            element={<div>Play table</div>}
          />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Join/ })).toBeInTheDocument()
    })

    const nameInput = screen.getByLabelText(/Character name/)
    await user.clear(nameInput)
    await user.type(nameInput, 'Test Character')
    await user.click(screen.getByRole('button', { name: /Join/ }))

    await waitFor(() => {
      expect(mockGraphql).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: {
            inviteCode: 'ABC123',
            input: {
              characterName: 'Test Character',
              initiativeModifier: 0,
            },
          },
        }),
        { authMode: 'apiKey' }
      )
    })
    await waitFor(() => {
      expect(mockStorePlayer).toHaveBeenCalledWith('player-123', 'table-456')
    })
  })
})
