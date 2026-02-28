import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SubmitDataForm from './SubmitDataForm'

const { mockGraphql } = vi.hoisted(() => ({
  mockGraphql: vi.fn(),
}))

vi.mock('aws-amplify/api', () => ({
  generateClient: () => ({
    graphql: mockGraphql,
  }),
}))

describe('SubmitDataForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the form with required fields', () => {
    render(<SubmitDataForm />)

    expect(
      screen.getByRole('heading', { name: /submit data/i })
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/source/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/payload/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument()
  })

  it('shows error when payload is not valid JSON', async () => {
    const user = userEvent.setup()
    render(<SubmitDataForm />)

    const sourceInput = screen.getByLabelText(/source/i)
    const payloadInput = screen.getByLabelText(/payload/i)
    const submitButton = screen.getByRole('button', { name: /submit/i })

    await user.type(sourceInput, 'test-source')
    await user.clear(payloadInput)
    await user.type(payloadInput, 'invalid json')
    await user.click(submitButton)

    expect(
      await screen.findByText(/payload must be valid json/i)
    ).toBeInTheDocument()
  })

  it('has source field as required', () => {
    render(<SubmitDataForm />)

    const sourceInput = screen.getByLabelText(/source/i)
    expect(sourceInput).toBeRequired()
  })

  it('shows error when payload is not a JSON object', async () => {
    const user = userEvent.setup()
    render(<SubmitDataForm />)

    const sourceInput = screen.getByLabelText(/source/i)
    const payloadInput = screen.getByLabelText(/payload/i)
    const submitButton = screen.getByRole('button', { name: /submit/i })

    await user.type(sourceInput, 'test-source')
    await user.clear(payloadInput)
    await user.type(payloadInput, '123')
    await user.click(submitButton)

    expect(await screen.findByText(/invalid payload/i)).toBeInTheDocument()
  })

  it('shows result on successful submission', async () => {
    mockGraphql.mockResolvedValue({
      data: {
        submitData: {
          id: 'submitted-id-123',
          status: 'SUBMITTED',
          submittedAt: '2025-01-15T12:00:00Z',
        },
      },
    })

    const user = userEvent.setup()
    render(<SubmitDataForm />)

    const sourceInput = screen.getByLabelText(/source/i)
    const submitButton = screen.getByRole('button', { name: /submit/i })

    await user.type(sourceInput, 'test-source')
    await user.click(submitButton)

    expect(await screen.findByText(/submitted-id-123/)).toBeInTheDocument()
    expect(screen.getByText(/SUBMITTED/)).toBeInTheDocument()
  })

  it('shows error when submission fails', async () => {
    mockGraphql.mockRejectedValue(new Error('Network error'))

    const user = userEvent.setup()
    render(<SubmitDataForm />)

    const sourceInput = screen.getByLabelText(/source/i)
    const submitButton = screen.getByRole('button', { name: /submit/i })

    await user.type(sourceInput, 'test-source')
    await user.click(submitButton)

    expect(await screen.findByText(/network error/i)).toBeInTheDocument()
  })

  it('shows generic error when submission throws non-Error', async () => {
    mockGraphql.mockRejectedValue('string error')

    const user = userEvent.setup()
    render(<SubmitDataForm />)

    const sourceInput = screen.getByLabelText(/source/i)
    const submitButton = screen.getByRole('button', { name: /submit/i })

    await user.type(sourceInput, 'test-source')
    await user.click(submitButton)

    expect(await screen.findByText(/submission failed/i)).toBeInTheDocument()
  })
})
