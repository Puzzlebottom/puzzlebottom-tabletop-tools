import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DiceRoller } from './DiceRoller'

describe('DiceRoller', () => {
  it('renders roll button and calls onRoll when clicked', async () => {
    const onRoll = vi.fn()
    render(<DiceRoller onRoll={onRoll} rolling={false} />)

    const button = screen.getByRole('button', { name: /roll d20/i })
    expect(button).toBeInTheDocument()

    await userEvent.click(button)
    expect(onRoll).toHaveBeenCalledTimes(1)
  })

  it('disables button when rolling', () => {
    render(<DiceRoller onRoll={vi.fn()} rolling />)

    const button = screen.getByRole('button', { name: /rolling/i })
    expect(button).toBeDisabled()
  })

  it('disables button when disabled prop is true', () => {
    render(<DiceRoller onRoll={vi.fn()} rolling={false} disabled />)

    const button = screen.getByRole('button', { name: /roll d20/i })
    expect(button).toBeDisabled()
  })

  it('shows Re-roll message when cocked', () => {
    render(<DiceRoller onRoll={vi.fn()} rolling={false} cocked />)

    expect(screen.getByText(/re-roll/i)).toBeInTheDocument()
  })

  it('does not show Re-roll when not cocked', () => {
    render(<DiceRoller onRoll={vi.fn()} rolling={false} cocked={false} />)

    expect(screen.queryByText(/re-roll/i)).not.toBeInTheDocument()
  })

  it('renders 3D canvas container', () => {
    render(<DiceRoller onRoll={vi.fn()} rolling={false} />)

    const section = screen.getByRole('region', { name: /dice roller/i })
    expect(section).toBeInTheDocument()
    expect(section.querySelector('canvas')).toBeInTheDocument()
  })
})
