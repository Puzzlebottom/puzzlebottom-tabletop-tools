import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CreatePlayTablePage } from './CreatePlayTablePage'

const { mockGraphql } = vi.hoisted(() => ({ mockGraphql: vi.fn() }))

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

vi.mock('aws-amplify/api', () => ({
  generateClient: () => ({ graphql: mockGraphql }),
}))

describe('CreatePlayTablePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders create play table heading', () => {
    render(
      <MemoryRouter initialEntries={['/dice/create']}>
        <Routes>
          <Route path="/dice/create" element={<CreatePlayTablePage />} />
        </Routes>
      </MemoryRouter>
    )
    expect(
      screen.getByRole('heading', { name: 'Create play table' })
    ).toBeInTheDocument()
  })

  it('renders back to dice link', () => {
    render(
      <MemoryRouter initialEntries={['/dice/create']}>
        <Routes>
          <Route path="/dice/create" element={<CreatePlayTablePage />} />
        </Routes>
      </MemoryRouter>
    )
    expect(
      screen.getByRole('link', { name: /← Back to dice/ })
    ).toHaveAttribute('href', '/dice')
  })

  it('calls createPlayTable and displays invite link on success', async () => {
    const user = userEvent.setup()
    mockGraphql.mockResolvedValue({
      data: {
        createPlayTable: {
          id: 'table-123',
          inviteCode: 'ABC456',
          createdAt: '2025-01-01T00:00:00Z',
        },
      },
    })

    render(
      <MemoryRouter initialEntries={['/dice/create']}>
        <Routes>
          <Route path="/dice/create" element={<CreatePlayTablePage />} />
        </Routes>
      </MemoryRouter>
    )

    await user.click(screen.getByRole('button', { name: /Create play table/ }))

    expect(mockGraphql).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining('CreatePlayTable'),
      })
    )

    expect(await screen.findByText(/dice\/join\/ABC456/)).toBeInTheDocument()
    expect(screen.getByText('Invite link')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Go to play table/ })
    ).toHaveAttribute('href', '/dice/table/table-123')
  })

  it('shows error when createPlayTable fails', async () => {
    const user = userEvent.setup()
    mockGraphql.mockRejectedValue(new Error('Network error'))

    render(
      <MemoryRouter initialEntries={['/dice/create']}>
        <Routes>
          <Route path="/dice/create" element={<CreatePlayTablePage />} />
        </Routes>
      </MemoryRouter>
    )

    await user.click(screen.getByRole('button', { name: /Create play table/ }))

    expect(await screen.findByText('Network error')).toBeInTheDocument()
  })

  it('shows generic error when createPlayTable rejects with non-Error', async () => {
    const user = userEvent.setup()
    mockGraphql.mockRejectedValue('Unknown error')

    render(
      <MemoryRouter initialEntries={['/dice/create']}>
        <Routes>
          <Route path="/dice/create" element={<CreatePlayTablePage />} />
        </Routes>
      </MemoryRouter>
    )

    await user.click(screen.getByRole('button', { name: /Create play table/ }))

    expect(
      await screen.findByText('Failed to create play table')
    ).toBeInTheDocument()
  })
})
