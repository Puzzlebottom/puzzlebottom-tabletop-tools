import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { InitiativeList } from './InitiativeList'

describe('InitiativeList', () => {
  it('shows empty state when order is empty', () => {
    render(<InitiativeList order={[]} />)
    expect(screen.getByText('Initiative')).toBeInTheDocument()
    expect(screen.getByText('No initiative order yet.')).toBeInTheDocument()
  })

  it('shows ordered list when order has entries', () => {
    const order = [
      {
        id: '1',
        characterName: 'Alice',
        value: 18,
        modifier: 2,
        total: 20,
      },
      {
        id: '2',
        characterName: 'Bob',
        value: 15,
        modifier: -1,
        total: 14,
      },
    ]
    render(<InitiativeList order={order} />)
    expect(screen.getByText(/Alice: 20 \(d20: 18 \+ 2\)/)).toBeInTheDocument()
    expect(screen.getByText(/Bob: 14 \(d20: 15 \+ -1\)/)).toBeInTheDocument()
  })
})
