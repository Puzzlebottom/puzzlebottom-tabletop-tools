import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { RollDisplayItem } from './RollLog'
import { RollLog } from './RollLog'

describe('RollLog', () => {
  it('shows empty state when no rolls and not loading', () => {
    render(<RollLog rolls={[]} />)
    expect(screen.getByText('Roll log')).toBeInTheDocument()
    expect(screen.getByText('No rolls yet.')).toBeInTheDocument()
  })

  it('shows roll items with formatted display', () => {
    const rolls: RollDisplayItem[] = [
      {
        id: 'roll-abc123',
        playTableId: 'table-1',
        rollerId: 'p1',
        rollNotation: 'd20',
        type: null,
        values: [12],
        modifier: 3,
        rollResult: 15,
        isPrivate: false,
        rollRequestId: null,
        createdAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 'roll-def456',
        playTableId: 'table-1',
        rollerId: 'p1',
        rollNotation: 'd20',
        type: null,
        values: [20],
        modifier: 0,
        rollResult: 20,
        isPrivate: false,
        rollRequestId: null,
        createdAt: '2024-01-01T00:00:01Z',
      },
    ]
    render(<RollLog rolls={rolls} />)
    expect(screen.getByText(/Roll roll-abc…: 15/)).toBeInTheDocument()
    expect(screen.getByText(/Roll roll-def…: 20/)).toBeInTheDocument()
  })

  it('hides isPrivate rolls when viewerIsGm is false', () => {
    const rolls: RollDisplayItem[] = [
      {
        id: 'roll-1',
        playTableId: 'table-1',
        rollerId: 'gm',
        rollNotation: 'd20',
        type: null,
        values: [15],
        modifier: 0,
        rollResult: 15,
        isPrivate: false,
        rollRequestId: null,
        createdAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 'roll-2',
        playTableId: 'table-1',
        rollerId: 'gm',
        rollNotation: 'd20',
        type: null,
        values: [20],
        modifier: 0,
        rollResult: 20,
        isPrivate: true,
        rollRequestId: null,
        createdAt: '2024-01-01T00:00:01Z',
      },
    ]
    render(<RollLog rolls={rolls} viewerIsGm={false} />)
    expect(screen.getByText(/Roll roll-1…: 15/)).toBeInTheDocument()
    expect(screen.queryByText(/Roll roll-2…: 20/)).not.toBeInTheDocument()
  })

  it('shows all rolls including isPrivate when viewerIsGm is true', () => {
    const rolls: RollDisplayItem[] = [
      {
        id: 'roll-1',
        playTableId: 'table-1',
        rollerId: 'gm',
        rollNotation: 'd20',
        type: null,
        values: [20],
        modifier: 0,
        rollResult: 20,
        isPrivate: true,
        rollRequestId: null,
        createdAt: '2024-01-01T00:00:00Z',
      },
    ]
    render(<RollLog rolls={rolls} viewerIsGm />)
    expect(screen.getByText(/Roll roll-1…: 20/)).toBeInTheDocument()
  })

  it('shows load more button when hasMore', async () => {
    const user = userEvent.setup()
    const onLoadMore = vi.fn()
    render(
      <RollLog rolls={[]} hasMore onLoadMore={onLoadMore} loading={false} />
    )
    const button = screen.getByRole('button', { name: /load more/i })
    expect(button).toBeInTheDocument()
    await user.click(button)
    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  it('disables load more when loading', () => {
    render(<RollLog rolls={[]} hasMore onLoadMore={vi.fn()} loading />)
    expect(screen.getByRole('button', { name: /loading/i })).toBeDisabled()
  })
})
