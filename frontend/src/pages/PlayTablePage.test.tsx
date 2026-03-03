import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PlayTablePage } from './PlayTablePage'

type StoredPlayer = { playerId: string; playTableId: string } | null

const {
  mockGetStoredPlayer,
  mockClearStoredPlayer,
  mockNavigate,
  mockGraphql,
  subscriptionHandlers,
} = vi.hoisted(() => ({
  mockGetStoredPlayer: vi.fn<() => StoredPlayer>(),
  mockClearStoredPlayer: vi.fn(),
  mockNavigate: vi.fn(),
  mockGraphql: vi.fn(),
  subscriptionHandlers: {} as Record<
    string,
    ((p: unknown) => void) | undefined
  >,
}))

vi.mock('../lib/player-storage', () => {
  /* eslint-disable @typescript-eslint/no-unsafe-return -- vi.fn mock return */
  return {
    getStoredPlayer: (): StoredPlayer =>
      mockGetStoredPlayer() as unknown as StoredPlayer,
    clearStoredPlayer: (...args: unknown[]) => mockClearStoredPlayer(...args),
  }
  /* eslint-enable @typescript-eslint/no-unsafe-return */
})

vi.mock('react-router-dom', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports -- dynamic mock
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('aws-amplify/api', () => ({
  generateClient: () => ({
    graphql: (config: unknown) => {
      const isSubscription =
        typeof config === 'object' &&
        config !== null &&
        'query' in config &&
        typeof (config as { query: string }).query === 'string' &&
        (config as { query: string }).query.includes('subscription')
      if (isSubscription) {
        const query = (config as { query: string }).query
        return {
          subscribe: (handlers: { next: (p: unknown) => void }) => {
            if (query.includes('RollRequestCreated')) {
              subscriptionHandlers.onRollRequestCreated = handlers.next
            }
            if (query.includes('RollCompleted')) {
              subscriptionHandlers.onRollCompleted = handlers.next
            }
            if (query.includes('InitiativeUpdated')) {
              subscriptionHandlers.onInitiativeUpdated = handlers.next
            }
            return { unsubscribe: vi.fn() }
          },
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- test mock passthrough
      return mockGraphql(config)
    },
  }),
}))

vi.mock('aws-amplify/auth', () => ({
  getCurrentUser: vi.fn(),
}))

const mockSignOut = vi.fn()
vi.mock('@aws-amplify/ui-react', () => ({
  Authenticator: ({
    children,
  }: {
    children: (props: {
      signOut: () => void
      user?: { signInDetails?: { loginId?: string } }
    }) => React.ReactNode
  }) =>
    children({
      signOut: mockSignOut,
      user: { signInDetails: { loginId: 'gm@example.com' } },
    }),
}))

const { getCurrentUser } = await import('aws-amplify/auth')

describe('PlayTablePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    subscriptionHandlers.onRollRequestCreated = undefined
    subscriptionHandlers.onRollCompleted = undefined
    subscriptionHandlers.onInitiativeUpdated = undefined
    mockGraphql.mockResolvedValue({
      data: {
        rollHistory: { items: [], nextToken: null },
        playTable: { players: [] },
      },
    })
  })

  it('shows loading while resolving view mode', () => {
    mockGetStoredPlayer.mockReturnValue(null)
    // Promise that never resolves (loading state)
    vi.mocked(getCurrentUser).mockImplementation(
      () =>
        new Promise<never>(
          // eslint-disable-next-line @typescript-eslint/no-empty-function -- executor never resolves
          () => {}
        )
    )

    render(
      <MemoryRouter initialEntries={['/dice/table/table-1']}>
        <Routes>
          <Route path="/dice/table/:playTableId" element={<PlayTablePage />} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows player view when stored player matches playTableId', async () => {
    mockGetStoredPlayer.mockReturnValue({
      playerId: 'p1',
      playTableId: 'table-1',
    })

    render(
      <MemoryRouter initialEntries={['/dice/table/table-1']}>
        <Routes>
          <Route path="/dice/table/:playTableId" element={<PlayTablePage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Play table')).toBeInTheDocument()
    })
    expect(screen.getByText('Table ID: table-1')).toBeInTheDocument()
    expect(screen.getByText('(Player view)')).toBeInTheDocument()
  })

  it('shows join required when not player and getCurrentUser rejects', async () => {
    mockGetStoredPlayer.mockReturnValue(null)
    vi.mocked(getCurrentUser).mockRejectedValue(new Error('Not signed in'))

    render(
      <MemoryRouter initialEntries={['/dice/table/table-1']}>
        <Routes>
          <Route path="/dice/table/:playTableId" element={<PlayTablePage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Join required')).toBeInTheDocument()
    })
    expect(
      screen.getByText('You need to join this play table via the invite link.')
    ).toBeInTheDocument()
  })

  it('shows GM view when getCurrentUser resolves', async () => {
    mockGetStoredPlayer.mockReturnValue(null)
    vi.mocked(getCurrentUser).mockResolvedValue({} as never)

    render(
      <MemoryRouter initialEntries={['/dice/table/table-1']}>
        <Routes>
          <Route path="/dice/table/:playTableId" element={<PlayTablePage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Play table (GM)')).toBeInTheDocument()
    })
    expect(screen.getByText('Table ID: table-1')).toBeInTheDocument()
  })

  it('shows loading when playTableId is missing', () => {
    render(
      <MemoryRouter initialEntries={['/dice/table']}>
        <Routes>
          <Route path="/dice/table" element={<PlayTablePage />} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows roll log and initiative when in player view', async () => {
    mockGetStoredPlayer.mockReturnValue({
      playerId: 'p1',
      playTableId: 'table-1',
    })

    render(
      <MemoryRouter initialEntries={['/dice/table/table-1']}>
        <Routes>
          <Route path="/dice/table/:playTableId" element={<PlayTablePage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Roll log')).toBeInTheDocument()
    })
    expect(screen.getByText('Initiative')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /roll d20/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /leave table/i })
    ).toBeInTheDocument()
  })

  it('shows GM controls when in GM view', async () => {
    mockGetStoredPlayer.mockReturnValue(null)
    vi.mocked(getCurrentUser).mockResolvedValue({} as never)

    render(
      <MemoryRouter initialEntries={['/dice/table/table-1']}>
        <Routes>
          <Route path="/dice/table/:playTableId" element={<PlayTablePage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('GM controls')).toBeInTheDocument()
    })
    expect(
      screen.getByRole('button', { name: /request initiative roll/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /clear initiative/i })
    ).toBeInTheDocument()
  })

  it('calls leavePlayTable and navigates when player clicks leave', async () => {
    const user = userEvent.setup()
    mockGetStoredPlayer.mockReturnValue({
      playerId: 'p1',
      playTableId: 'table-1',
    })
    mockGraphql
      .mockResolvedValueOnce({
        data: { rollHistory: { items: [], nextToken: null } },
      })
      .mockResolvedValueOnce({ data: { leavePlayTable: true } })

    render(
      <MemoryRouter initialEntries={['/dice/table/table-1']}>
        <Routes>
          <Route path="/dice/table/:playTableId" element={<PlayTablePage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /leave table/i })
      ).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /leave table/i }))

    await waitFor(() => {
      expect(mockGraphql).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          variables: { playTableId: 'table-1', playerId: 'p1' },
        })
      )
    })
    expect(mockClearStoredPlayer).toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith('/dice', { replace: true })
  })

  it('calls rollDice when player clicks roll d20', async () => {
    const user = userEvent.setup()
    mockGetStoredPlayer.mockReturnValue({
      playerId: 'p1',
      playTableId: 'table-1',
    })
    mockGraphql
      .mockResolvedValueOnce({
        data: { rollHistory: { items: [], nextToken: null } },
      })
      .mockResolvedValueOnce({
        data: { rollDice: { rollId: 'r1', accepted: true } },
      })

    render(
      <MemoryRouter initialEntries={['/dice/table/table-1']}>
        <Routes>
          <Route path="/dice/table/:playTableId" element={<PlayTablePage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /roll d20/i })
      ).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /roll d20/i }))

    await waitFor(() => {
      /* eslint-disable @typescript-eslint/no-unsafe-assignment -- expect.objectContaining matcher */
      expect(mockGraphql).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          variables: expect.objectContaining({
            playTableId: 'table-1',
            input: expect.objectContaining({ diceType: 'd20', id: 'p1' }),
          }),
        })
      )
      /* eslint-enable @typescript-eslint/no-unsafe-assignment */
    })
  })

  it('updates roll log and settles dice when onRollCompleted delivers matching rollId', async () => {
    const user = userEvent.setup()
    mockGetStoredPlayer.mockReturnValue({
      playerId: 'p1',
      playTableId: 'table-1',
    })
    mockGraphql
      .mockResolvedValueOnce({
        data: { rollHistory: { items: [], nextToken: null } },
      })
      .mockResolvedValueOnce({
        data: { rollDice: { rollId: 'r1', accepted: true } },
      })

    render(
      <MemoryRouter initialEntries={['/dice/table/table-1']}>
        <Routes>
          <Route path="/dice/table/:playTableId" element={<PlayTablePage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /roll d20/i })
      ).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /roll d20/i }))

    act(() => {
      subscriptionHandlers.onRollCompleted?.({
        data: {
          onRollCompleted: {
            rollId: 'r1',
            values: [15],
            modifier: 2,
            total: 17,
            visibility: 'all',
          },
        },
      })
    })

    await waitFor(() => {
      expect(screen.getByText(/Roll r1…: 17/)).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /roll d20/i })).toBeEnabled()
  })

  it('updates initiative order when onInitiativeUpdated fires', async () => {
    mockGetStoredPlayer.mockReturnValue(null)
    vi.mocked(getCurrentUser).mockResolvedValue({} as never)
    mockGraphql.mockResolvedValue({
      data: { rollHistory: { items: [], nextToken: null } },
    })

    render(
      <MemoryRouter initialEntries={['/dice/table/table-1']}>
        <Routes>
          <Route path="/dice/table/:playTableId" element={<PlayTablePage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Play table (GM)')).toBeInTheDocument()
    })

    act(() => {
      subscriptionHandlers.onInitiativeUpdated?.({
        data: {
          onInitiativeUpdated: {
            order: [
              {
                id: 'p1',
                characterName: 'Alice',
                value: 18,
                modifier: 2,
                total: 20,
              },
            ],
          },
        },
      })
    })

    await waitFor(() => {
      expect(screen.getByText(/Alice: 20/)).toBeInTheDocument()
    })
  })

  it('calls createRollRequest when GM clicks request initiative roll', async () => {
    const user = userEvent.setup()
    mockGetStoredPlayer.mockReturnValue(null)
    vi.mocked(getCurrentUser).mockResolvedValue({} as never)
    mockGraphql
      .mockResolvedValueOnce({
        data: {
          rollHistory: { items: [], nextToken: null },
          playTable: { players: [] },
        },
      })
      .mockResolvedValueOnce({
        data: {
          playTable: {
            id: 'table-1',
            inviteCode: 'ABC',
            createdAt: '2024-01-01',
            players: [
              { id: 'p1', characterName: 'Alice', initiativeModifier: 2 },
              { id: 'p2', characterName: 'Bob', initiativeModifier: -1 },
            ],
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          createRollRequest: {
            id: 'req-1',
            targetPlayerIds: ['p1', 'p2'],
            type: 'initiative',
            status: 'pending',
            createdAt: '2024-01-01',
          },
        },
      })

    render(
      <MemoryRouter initialEntries={['/dice/table/table-1']}>
        <Routes>
          <Route path="/dice/table/:playTableId" element={<PlayTablePage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /request initiative roll/i })
      ).toBeInTheDocument()
    })
    await user.click(
      screen.getByRole('button', { name: /request initiative roll/i })
    )

    await waitFor(() => {
      /* eslint-disable @typescript-eslint/no-unsafe-assignment -- expect.objectContaining returns asymmetric matcher */
      expect(mockGraphql).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          variables: expect.objectContaining({
            playTableId: 'table-1',
            input: expect.objectContaining({
              targetPlayerIds: ['p1', 'p2'],
              type: 'initiative',
            }),
          }),
        })
      )
      /* eslint-enable @typescript-eslint/no-unsafe-assignment */
    })
  })

  it('calls clearInitiative when GM clicks clear initiative', async () => {
    const user = userEvent.setup()
    mockGetStoredPlayer.mockReturnValue(null)
    vi.mocked(getCurrentUser).mockResolvedValue({} as never)
    mockGraphql.mockResolvedValue({ data: { clearInitiative: true } })

    render(
      <MemoryRouter initialEntries={['/dice/table/table-1']}>
        <Routes>
          <Route path="/dice/table/:playTableId" element={<PlayTablePage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /clear initiative/i })
      ).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /clear initiative/i }))

    await waitFor(() => {
      expect(mockGraphql).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: { playTableId: 'table-1' },
        })
      )
    })
  })

  it('calls rollDice when GM clicks roll d20 (ad hoc)', async () => {
    const user = userEvent.setup()
    mockGetStoredPlayer.mockReturnValue(null)
    vi.mocked(getCurrentUser).mockResolvedValue({} as never)
    mockGraphql
      .mockResolvedValueOnce({
        data: { rollHistory: { items: [], nextToken: null } },
      })
      .mockResolvedValueOnce({
        data: { rollDice: { rollId: 'r1', accepted: true } },
      })

    render(
      <MemoryRouter initialEntries={['/dice/table/table-1']}>
        <Routes>
          <Route path="/dice/table/:playTableId" element={<PlayTablePage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /roll d20/i })
      ).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /roll d20/i }))

    await waitFor(() => {
      /* eslint-disable @typescript-eslint/no-unsafe-assignment -- expect.objectContaining matcher */
      expect(mockGraphql).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          variables: expect.objectContaining({
            playTableId: 'table-1',
            input: expect.objectContaining({ diceType: 'd20' }),
          }),
        })
      )
      /* eslint-enable @typescript-eslint/no-unsafe-assignment */
    })
  })

  it('calls signOut when GM clicks sign out', async () => {
    const user = userEvent.setup()
    mockGetStoredPlayer.mockReturnValue(null)
    vi.mocked(getCurrentUser).mockResolvedValue({} as never)

    render(
      <MemoryRouter initialEntries={['/dice/table/table-1']}>
        <Routes>
          <Route path="/dice/table/:playTableId" element={<PlayTablePage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /sign out/i })
      ).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /sign out/i }))

    expect(mockSignOut).toHaveBeenCalled()
  })

  it('calls fetchRollHistory with nextToken when load more is clicked', async () => {
    const user = userEvent.setup()
    mockGetStoredPlayer.mockReturnValue({
      playerId: 'p1',
      playTableId: 'table-1',
    })
    mockGraphql
      .mockResolvedValueOnce({
        data: {
          rollHistory: {
            items: [
              {
                id: 'r1',
                playTableId: 'table-1',
                rollerId: 'p1',
                rollerType: 'player',
                total: 15,
                values: [15],
                modifier: 0,
                dc: null,
                success: null,
                visibility: 'visible',
                createdAt: '2024-01-01',
              },
            ],
            nextToken: 'token1',
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          rollHistory: {
            items: [],
            nextToken: null,
          },
        },
      })

    render(
      <MemoryRouter initialEntries={['/dice/table/table-1']}>
        <Routes>
          <Route path="/dice/table/:playTableId" element={<PlayTablePage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /load more/i })
      ).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /load more/i }))

    await waitFor(() => {
      /* eslint-disable @typescript-eslint/no-unsafe-assignment -- expect.objectContaining matcher */
      expect(mockGraphql).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          variables: expect.objectContaining({
            playTableId: 'table-1',
            nextToken: 'token1',
          }),
        })
      )
      /* eslint-enable @typescript-eslint/no-unsafe-assignment */
    })
  })

  it('resets leaving state when leavePlayTable rejects', async () => {
    const user = userEvent.setup()
    mockGetStoredPlayer.mockReturnValue({
      playerId: 'p1',
      playTableId: 'table-1',
    })
    mockGraphql
      .mockResolvedValueOnce({
        data: { rollHistory: { items: [], nextToken: null } },
      })
      .mockRejectedValueOnce(new Error('Leave failed'))

    render(
      <MemoryRouter initialEntries={['/dice/table/table-1']}>
        <Routes>
          <Route path="/dice/table/:playTableId" element={<PlayTablePage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /leave table/i })
      ).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /leave table/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /leave table/i })).toBeEnabled()
    })
    expect(mockClearStoredPlayer).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('calls fulfillRollRequest when player clicks roll for initiative', async () => {
    const user = userEvent.setup()
    mockGetStoredPlayer.mockReturnValue({
      playerId: 'p1',
      playTableId: 'table-1',
    })
    mockGraphql
      .mockResolvedValueOnce({
        data: { rollHistory: { items: [], nextToken: null } },
      })
      .mockResolvedValueOnce({
        data: {
          fulfillRollRequest: {
            rollId: 'r1',
            accepted: true,
          },
        },
      })

    render(
      <MemoryRouter initialEntries={['/dice/table/table-1']}>
        <Routes>
          <Route path="/dice/table/:playTableId" element={<PlayTablePage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Play table')).toBeInTheDocument()
    })

    act(() => {
      subscriptionHandlers.onRollRequestCreated?.({
        data: {
          onRollRequestCreated: {
            id: 'req-1',
            targetPlayerIds: ['p1'],
          },
        },
      })
    })

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /roll for initiative/i })
      ).toBeInTheDocument()
    })
    await user.click(
      screen.getByRole('button', { name: /roll for initiative/i })
    )

    await waitFor(() => {
      expect(mockGraphql).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          variables: {
            rollRequestId: 'req-1',
            playTableId: 'table-1',
            playerId: 'p1',
          },
        })
      )
    })
  })

  it('resets rolling state when rollDice rejects', async () => {
    const user = userEvent.setup()
    mockGetStoredPlayer.mockReturnValue({
      playerId: 'p1',
      playTableId: 'table-1',
    })
    mockGraphql
      .mockResolvedValueOnce({
        data: { rollHistory: { items: [], nextToken: null } },
      })
      .mockRejectedValueOnce(new Error('Roll failed'))

    render(
      <MemoryRouter initialEntries={['/dice/table/table-1']}>
        <Routes>
          <Route path="/dice/table/:playTableId" element={<PlayTablePage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /roll d20/i })
      ).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /roll d20/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /roll d20/i })).toBeEnabled()
    })
  })

  it('resets rolling and sets cocked when GM ad hoc roll rejects', async () => {
    const user = userEvent.setup()
    mockGetStoredPlayer.mockReturnValue(null)
    vi.mocked(getCurrentUser).mockResolvedValue({} as never)
    mockGraphql
      .mockResolvedValueOnce({
        data: { rollHistory: { items: [], nextToken: null } },
      })
      .mockRejectedValueOnce(new Error('Ad hoc roll failed'))

    render(
      <MemoryRouter initialEntries={['/dice/table/table-1']}>
        <Routes>
          <Route path="/dice/table/:playTableId" element={<PlayTablePage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /roll d20/i })
      ).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /roll d20/i }))

    await waitFor(() => {
      expect(screen.getByText(/re-roll/i)).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /roll d20/i })).toBeEnabled()
  })
})
