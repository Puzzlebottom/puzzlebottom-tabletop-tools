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
        rollerId: 'p1',
        rollerType: 'player',
        total: 15,
        values: [12],
        modifier: 3,
        visibility: 'all',
        createdAt: '2024-01-01T00:00:00Z',
      },
      {
        rollId: 'roll-def456',
        total: 20,
        values: [20],
        modifier: 0,
        visibility: 'all',
      },
    ]
    render(<RollLog rolls={rolls} />)
    expect(screen.getByText(/Roll roll-abc…: 15/)).toBeInTheDocument()
    expect(screen.getByText(/Roll roll-def…: 20/)).toBeInTheDocument()
  })

  it('shows DC and success when present', () => {
    const rolls: RollDisplayItem[] = [
      {
        id: 'roll-1',
        rollerId: 'p1',
        rollerType: 'player',
        total: 18,
        values: [15],
        modifier: 3,
        dc: 15,
        success: true,
        visibility: 'all',
        createdAt: '2024-01-01T00:00:00Z',
      },
    ]
    render(<RollLog rolls={rolls} />)
    expect(screen.getByText(/DC 15.*success/)).toBeInTheDocument()
  })

  it('shows DC without success/fail when success is null', () => {
    const rolls: RollDisplayItem[] = [
      {
        id: 'roll-1',
        rollerId: 'p1',
        rollerType: 'player',
        total: 18,
        values: [15],
        modifier: 3,
        dc: 15,
        success: null,
        visibility: 'all',
        createdAt: '2024-01-01T00:00:00Z',
      },
    ]
    render(<RollLog rolls={rolls} />)
    expect(screen.getByText(/DC 15/)).toBeInTheDocument()
    expect(screen.queryByText(/success/)).not.toBeInTheDocument()
    expect(screen.queryByText(/fail/)).not.toBeInTheDocument()
  })

  it('shows DC and fail when success is false', () => {
    const rolls: RollDisplayItem[] = [
      {
        id: 'roll-2',
        rollerId: 'p1',
        rollerType: 'player',
        total: 10,
        values: [8],
        modifier: 2,
        dc: 15,
        success: false,
        visibility: 'all',
        createdAt: '2024-01-01T00:00:00Z',
      },
    ]
    render(<RollLog rolls={rolls} />)
    expect(screen.getByText(/DC 15.*fail/)).toBeInTheDocument()
  })

  it('hides gm_only rolls when viewerIsGm is false', () => {
    const rolls: RollDisplayItem[] = [
      {
        id: 'roll-1',
        rollerId: 'gm',
        rollerType: 'gm',
        total: 15,
        values: [15],
        modifier: 0,
        visibility: 'all',
        createdAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 'roll-2',
        rollerId: 'gm',
        rollerType: 'gm',
        total: 20,
        values: [20],
        modifier: 0,
        visibility: 'gm_only',
        createdAt: '2024-01-01T00:00:01Z',
      },
    ]
    render(<RollLog rolls={rolls} viewerIsGm={false} />)
    expect(screen.getByText(/Roll roll-1…: 15/)).toBeInTheDocument()
    expect(screen.queryByText(/Roll roll-2…: 20/)).not.toBeInTheDocument()
  })

  it('shows all rolls including gm_only when viewerIsGm is true', () => {
    const rolls: RollDisplayItem[] = [
      {
        id: 'roll-1',
        rollerId: 'gm',
        rollerType: 'gm',
        total: 20,
        values: [20],
        modifier: 0,
        visibility: 'gm_only',
        createdAt: '2024-01-01T00:00:00Z',
      },
    ]
    render(<RollLog rolls={rolls} viewerIsGm />)
    expect(screen.getByText(/Roll roll-1…: 20/)).toBeInTheDocument()
  })

  it('shows disadvantage when present', () => {
    const rolls: RollDisplayItem[] = [
      {
        id: 'roll-4',
        rollerId: 'p1',
        rollerType: 'player',
        total: 8,
        values: [5, 7],
        modifier: 1,
        advantage: 'disadvantage',
        visibility: 'all',
        createdAt: '2024-01-01T00:00:00Z',
      },
    ]
    render(<RollLog rolls={rolls} />)
    expect(screen.getByText(/\[disadvantage\]/)).toBeInTheDocument()
  })

  it('shows advantage when present', () => {
    const rolls: RollDisplayItem[] = [
      {
        id: 'roll-3',
        rollerId: 'p1',
        rollerType: 'player',
        total: 18,
        values: [15, 12],
        modifier: 3,
        advantage: 'advantage',
        visibility: 'all',
        createdAt: '2024-01-01T00:00:00Z',
      },
    ]
    render(<RollLog rolls={rolls} />)
    expect(screen.getByText(/\[advantage\]/)).toBeInTheDocument()
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
