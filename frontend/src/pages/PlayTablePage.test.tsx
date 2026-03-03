import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PlayTablePage } from './PlayTablePage'

const mockGetStoredPlayer = vi.fn()
vi.mock('../lib/player-storage', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- test mock
  getStoredPlayer: () => mockGetStoredPlayer(),
}))

vi.mock('aws-amplify/auth', () => ({
  getCurrentUser: vi.fn(),
}))

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
      signOut: vi.fn(),
      user: { signInDetails: { loginId: 'gm@example.com' } },
    }),
}))

const { getCurrentUser } = await import('aws-amplify/auth')

describe('PlayTablePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
})
