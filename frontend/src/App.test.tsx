import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import App from './App'

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
  it('renders app title', () => {
    render(<App />)
    expect(
      screen.getByText("Puzzlebottom's Tabletop Tools Suite")
    ).toBeInTheDocument()
  })

  it('renders sign out button', () => {
    render(<App />)
    expect(
      screen.getByRole('button', { name: /sign out/i })
    ).toBeInTheDocument()
  })
})
