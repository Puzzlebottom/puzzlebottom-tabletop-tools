import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { GMRollControls } from './GMRollControls'

describe('GMRollControls', () => {
  it('renders GM controls with ad hoc and initiative sections', () => {
    const onAdHocRoll = vi.fn()
    const onRequestInitiative = vi.fn()
    const onClearInitiative = vi.fn()
    const onAdHocOptionsChange = vi.fn()

    render(
      <GMRollControls
        onRequestInitiative={onRequestInitiative}
        onAdHocRoll={onAdHocRoll}
        onClearInitiative={onClearInitiative}
        adHocOptions={{}}
        onAdHocOptionsChange={onAdHocOptionsChange}
      />
    )

    expect(screen.getByText('GM controls')).toBeInTheDocument()
    expect(
      screen.getByRole('group', { name: /ad hoc roll/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('group', { name: /initiative/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /ad hoc roll/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /request initiative roll/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /clear initiative/i })
    ).toBeInTheDocument()
  })

  it('calls onAdHocRoll with options when ad hoc roll is clicked', async () => {
    const user = userEvent.setup()
    const onAdHocRoll = vi.fn()
    const onAdHocOptionsChange = vi.fn()

    render(
      <GMRollControls
        onRequestInitiative={vi.fn()}
        onAdHocRoll={onAdHocRoll}
        onClearInitiative={vi.fn()}
        adHocOptions={{ dc: 15, advantage: 'advantage', visibility: 'gm_only' }}
        onAdHocOptionsChange={onAdHocOptionsChange}
      />
    )

    await user.click(screen.getByRole('button', { name: /ad hoc roll/i }))

    expect(onAdHocRoll).toHaveBeenCalledWith({
      dc: 15,
      advantage: 'advantage',
      visibility: 'gm_only',
    })
  })

  it('calls onRequestInitiative with options when request initiative is clicked', async () => {
    const user = userEvent.setup()
    const onRequestInitiative = vi.fn()

    render(
      <GMRollControls
        onRequestInitiative={onRequestInitiative}
        onAdHocRoll={vi.fn()}
        onClearInitiative={vi.fn()}
        adHocOptions={{}}
        onAdHocOptionsChange={vi.fn()}
      />
    )

    const dcInputs = screen.getAllByRole('spinbutton')
    const initiativeDcInput = dcInputs[1]
    await user.type(initiativeDcInput, '12')

    const advRadios = screen.getAllByRole('radio', { name: /adv/i })
    await user.click(advRadios[1])

    const privateCheckboxes = screen.getAllByRole('checkbox', {
      name: /^private$/i,
    })
    await user.click(privateCheckboxes[0])

    await user.click(
      screen.getByRole('button', { name: /request initiative roll/i })
    )

    expect(onRequestInitiative).toHaveBeenCalledWith(
      expect.objectContaining({
        dc: 12,
        advantage: 'advantage',
        isPrivate: true,
      })
    )
  })

  it('calls onAdHocOptionsChange when DC is changed', () => {
    const onAdHocOptionsChange = vi.fn()

    render(
      <GMRollControls
        onRequestInitiative={vi.fn()}
        onAdHocRoll={vi.fn()}
        onClearInitiative={vi.fn()}
        adHocOptions={{}}
        onAdHocOptionsChange={onAdHocOptionsChange}
      />
    )

    const dcInputs = screen.getAllByRole('spinbutton')
    fireEvent.change(dcInputs[0], { target: { value: '15' } })
    expect(onAdHocOptionsChange).toHaveBeenCalledWith(
      expect.objectContaining({ dc: 15 })
    )
  })

  it('calls onAdHocOptionsChange when private checkbox is changed', async () => {
    const user = userEvent.setup()
    const onAdHocOptionsChange = vi.fn()

    render(
      <GMRollControls
        onRequestInitiative={vi.fn()}
        onAdHocRoll={vi.fn()}
        onClearInitiative={vi.fn()}
        adHocOptions={{}}
        onAdHocOptionsChange={onAdHocOptionsChange}
      />
    )

    const privateCheckbox = screen.getByRole('checkbox', {
      name: /private \(gm only\)/i,
    })
    await user.click(privateCheckbox)
    expect(onAdHocOptionsChange).toHaveBeenCalledWith(
      expect.objectContaining({ visibility: 'gm_only' })
    )
  })

  it('disables ad hoc roll button when rolling', () => {
    render(
      <GMRollControls
        onRequestInitiative={vi.fn()}
        onAdHocRoll={vi.fn()}
        onClearInitiative={vi.fn()}
        adHocOptions={{}}
        onAdHocOptionsChange={vi.fn()}
        rolling
      />
    )
    expect(screen.getByRole('button', { name: /rolling…/i })).toBeDisabled()
  })

  it('disables request initiative when requestingInitiative', () => {
    render(
      <GMRollControls
        onRequestInitiative={vi.fn()}
        onAdHocRoll={vi.fn()}
        onClearInitiative={vi.fn()}
        adHocOptions={{}}
        onAdHocOptionsChange={vi.fn()}
        requestingInitiative
      />
    )
    expect(screen.getByRole('button', { name: /requesting…/i })).toBeDisabled()
  })
})
