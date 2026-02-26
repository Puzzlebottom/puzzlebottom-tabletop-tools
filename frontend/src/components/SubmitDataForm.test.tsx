import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SubmitDataForm from './SubmitDataForm';

vi.mock('aws-amplify/api', () => ({
  generateClient: () => ({
    graphql: vi.fn(),
  }),
}));

describe('SubmitDataForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the form with required fields', () => {
    render(<SubmitDataForm />);

    expect(screen.getByRole('heading', { name: /submit data/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/source/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/payload/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });

  it('shows error when payload is not valid JSON', async () => {
    const user = userEvent.setup();
    render(<SubmitDataForm />);

    const sourceInput = screen.getByLabelText(/source/i);
    const payloadInput = screen.getByLabelText(/payload/i);
    const submitButton = screen.getByRole('button', { name: /submit/i });

    await user.type(sourceInput, 'test-source');
    await user.clear(payloadInput);
    await user.type(payloadInput, 'invalid json');
    await user.click(submitButton);

    expect(await screen.findByText(/payload must be valid json/i)).toBeInTheDocument();
  });

  it('has source field as required', () => {
    render(<SubmitDataForm />);

    const sourceInput = screen.getByLabelText(/source/i);
    expect(sourceInput).toBeRequired();
  });
});
