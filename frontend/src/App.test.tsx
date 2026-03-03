import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import App, { AppRoutes } from './App'

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
      user: { signInDetails: { loginId: 'test@example.com' } },
    }),
}))

describe('App', () => {
  it('renders with BrowserRouter', () => {
    render(<App />)
    expect(screen.getByText('Dice Roller')).toBeInTheDocument()
  })

  it('redirects / to /dice', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>
    )
    expect(screen.getByText('Dice Roller')).toBeInTheDocument()
  })

  it('renders dice landing at /dice', () => {
    render(
      <MemoryRouter initialEntries={['/dice']}>
        <AppRoutes />
      </MemoryRouter>
    )
    expect(screen.getByText('Dice Roller')).toBeInTheDocument()
  })
})
