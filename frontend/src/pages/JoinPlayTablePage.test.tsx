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
    mockGraphql.mockImplementation(
      (args: { query?: string }): Promise<unknown> => {
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
      }
    )

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
      /* eslint-disable @typescript-eslint/no-unsafe-assignment -- Vitest matchers */
      expect(mockGraphql).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: {
            inviteCode: 'ABC123',
            input: {
              characterName: 'Test Character',
              initiativeModifier: 0,
            },
          },
          authMode: 'apiKey',
          apiKey: expect.any(String),
        })
      )
      /* eslint-enable @typescript-eslint/no-unsafe-assignment */
    })
    await waitFor(() => {
      expect(mockStorePlayer).toHaveBeenCalledWith('player-123', 'table-456')
    })
  })

  it('shows error when character name is empty', async () => {
    const user = userEvent.setup()
    mockGraphql.mockResolvedValue({
      data: { playTableByInviteCode: null },
    })

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
      expect(screen.getByRole('button', { name: /Join/ })).toBeInTheDocument()
    })

    // Type only spaces to pass HTML required but fail our trim check
    await user.type(screen.getByLabelText(/Character name/), '   ')
    await user.click(screen.getByRole('button', { name: /Join/ }))

    await waitFor(() => {
      expect(screen.getByText('Character name is required')).toBeInTheDocument()
    })
    /* eslint-disable @typescript-eslint/no-unsafe-assignment -- Vitest matchers */
    expect(mockGraphql).not.toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining('JoinPlayTable'),
      }),
      expect.anything()
    )
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */
  })

  it('shows error when invite code is empty', async () => {
    const user = userEvent.setup()
    mockGraphql.mockResolvedValue({
      data: { playTableByInviteCode: null },
    })

    render(
      <MemoryRouter initialEntries={['/dice/join/   ']}>
        <Routes>
          <Route
            path="/dice/join/:inviteCode"
            element={<JoinPlayTablePage />}
          />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Join/ })).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText(/Character name/), 'Test')
    await user.click(screen.getByRole('button', { name: /Join/ }))

    await waitFor(() => {
      expect(screen.getByText('Invite code is required')).toBeInTheDocument()
    })
  })

  it('shows error message when join fails', async () => {
    const user = userEvent.setup()
    mockGraphql.mockImplementation(
      (args: { query?: string }): Promise<unknown> => {
        if (args.query?.includes('PlayTableByInviteCode')) {
          return Promise.resolve({ data: { playTableByInviteCode: null } })
        }
        return Promise.reject(new Error('Network error'))
      }
    )

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
      expect(screen.getByRole('button', { name: /Join/ })).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText(/Character name/), 'Test')
    await user.click(screen.getByRole('button', { name: /Join/ }))

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })

  it('shows error when API returns null data without errors', async () => {
    const user = userEvent.setup()
    mockGraphql.mockImplementation(
      (args: { query?: string }): Promise<unknown> => {
        if (args.query?.includes('PlayTableByInviteCode')) {
          return Promise.resolve({ data: { playTableByInviteCode: null } })
        }
        return Promise.resolve({ data: null })
      }
    )

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
      expect(screen.getByRole('button', { name: /Join/ })).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText(/Character name/), 'Test')
    await user.click(screen.getByRole('button', { name: /Join/ }))

    await waitFor(() => {
      expect(screen.getByText('Failed to join play table')).toBeInTheDocument()
    })
  })

  it('shows error when API returns GraphQL errors in response', async () => {
    const user = userEvent.setup()
    mockGraphql.mockImplementation(
      (args: { query?: string }): Promise<unknown> => {
        if (args.query?.includes('PlayTableByInviteCode')) {
          return Promise.resolve({ data: { playTableByInviteCode: null } })
        }
        return Promise.resolve({
          data: null,
          errors: [{ message: 'Invalid invite code' }],
        })
      }
    )

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
      expect(screen.getByRole('button', { name: /Join/ })).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText(/Character name/), 'Test')
    await user.click(screen.getByRole('button', { name: /Join/ }))

    await waitFor(() => {
      expect(screen.getByText('Invalid invite code')).toBeInTheDocument()
    })
  })

  it('shows error from object with message when join fails', async () => {
    const user = userEvent.setup()
    mockGraphql.mockImplementation(
      (args: { query?: string }): Promise<unknown> => {
        if (args.query?.includes('PlayTableByInviteCode')) {
          return Promise.resolve({ data: { playTableByInviteCode: null } })
        }
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- testing extractErrorMessage object path
        return Promise.reject({ message: 'Custom API error' })
      }
    )

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
      expect(screen.getByRole('button', { name: /Join/ })).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText(/Character name/), 'Test')
    await user.click(screen.getByRole('button', { name: /Join/ }))

    await waitFor(() => {
      expect(screen.getByText('Custom API error')).toBeInTheDocument()
    })
  })

  it('shows generic error when join fails with non-Error', async () => {
    const user = userEvent.setup()
    mockGraphql.mockImplementation(
      (args: { query?: string }): Promise<unknown> => {
        if (args.query?.includes('PlayTableByInviteCode')) {
          return Promise.resolve({ data: { playTableByInviteCode: null } })
        }

        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- testing non-Error path
        return Promise.reject('string error')
      }
    )

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
      expect(screen.getByRole('button', { name: /Join/ })).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText(/Character name/), 'Test')
    await user.click(screen.getByRole('button', { name: /Join/ }))

    await waitFor(() => {
      expect(screen.getByText('Failed to join play table')).toBeInTheDocument()
    })
  })

  it('uses initiative modifier 0 when input is invalid', async () => {
    const user = userEvent.setup()
    mockGraphql.mockImplementation(
      (args: { query?: string }): Promise<unknown> => {
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
      }
    )

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

    await user.type(screen.getByLabelText(/Character name/), 'Test')
    const modifierInput = screen.getByLabelText(/Initiative modifier/)
    await user.clear(modifierInput)
    await user.type(modifierInput, 'abc')
    await user.click(screen.getByRole('button', { name: /Join/ }))

    await waitFor(() => {
      /* eslint-disable @typescript-eslint/no-unsafe-assignment -- Vitest matchers */
      expect(mockGraphql).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: expect.objectContaining({
            input: expect.objectContaining({
              initiativeModifier: 0,
            }),
          }),
          authMode: 'apiKey',
          apiKey: expect.any(String),
        })
      )
      /* eslint-enable @typescript-eslint/no-unsafe-assignment */
    })
  })

  it('redirects when stored player matches play table', async () => {
    mockGetStoredPlayer.mockReturnValue({
      playerId: 'p1',
      playTableId: 'table-456',
    })
    mockGraphql.mockImplementation(
      (args: { query?: string }): Promise<unknown> => {
        if (args.query?.includes('PlayTableByInviteCode')) {
          return Promise.resolve({
            data: { playTableByInviteCode: { id: 'table-456' } },
          })
        }
        return Promise.resolve({ data: { playTableByInviteCode: null } })
      }
    )

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

    await waitFor(
      () => {
        expect(screen.getByText(/^Play table$/)).toBeInTheDocument()
      },
      { timeout: 2000 }
    )
  })
})
