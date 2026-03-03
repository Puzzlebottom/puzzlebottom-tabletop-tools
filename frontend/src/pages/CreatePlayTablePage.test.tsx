import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { CreatePlayTablePage } from './CreatePlayTablePage'

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

describe('CreatePlayTablePage', () => {
  it('renders create play table heading', () => {
    render(
      <MemoryRouter initialEntries={['/dice/create']}>
        <Routes>
          <Route path="/dice/create" element={<CreatePlayTablePage />} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Create play table')).toBeInTheDocument()
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
})
