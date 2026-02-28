import type { SubmitDataResponse } from '@puzzlebottom-tabletop-tools/graphql-types'
import { PayloadSchema } from '@puzzlebottom-tabletop-tools/schemas'
import { generateClient } from 'aws-amplify/api'
import { type SubmitEvent, useState } from 'react'

const client = generateClient()

const SUBMIT_DATA_MUTATION = `
  mutation SubmitData($source: String!, $payload: String!) {
    submitData(source: $source, payload: $payload) {
      id
      status
      submittedAt
    }
  }
`

export default function SubmitDataForm() {
  const [source, setSource] = useState('')
  const [payload, setPayload] = useState('{\n  "key": "value"\n}')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SubmitDataResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)

    let parsed: unknown
    try {
      parsed = JSON.parse(payload)
    } catch {
      setError('Payload must be valid JSON')
      setLoading(false)
      return
    }

    const payloadResult = PayloadSchema.safeParse(parsed)
    if (!payloadResult.success) {
      const errors = payloadResult.error.flatten().formErrors.join(', ')
      setError(`Invalid payload: ${errors || 'Payload must be a JSON object'}`)
      setLoading(false)
      return
    }

    try {
      const response = await client.graphql({
        query: SUBMIT_DATA_MUTATION,
        variables: { source, payload },
      })

      if ('data' in response && response.data) {
        setResult(
          (response.data as { submitData: SubmitDataResponse }).submitData
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section>
      <h2>Submit Data</h2>
      <form
        onSubmit={(e) => {
          void handleSubmit(e)
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
      >
        <div>
          <label
            htmlFor="source"
            style={{
              display: 'block',
              marginBottom: '0.25rem',
              fontWeight: 600,
            }}
          >
            Source
          </label>
          <input
            id="source"
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="e.g. sensor-data, user-upload"
            required
            style={{
              width: '100%',
              padding: '0.5rem',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <div>
          <label
            htmlFor="payload"
            style={{
              display: 'block',
              marginBottom: '0.25rem',
              fontWeight: 600,
            }}
          >
            Payload (JSON)
          </label>
          <textarea
            id="payload"
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            rows={8}
            style={{
              width: '100%',
              padding: '0.5rem',
              fontFamily: 'monospace',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          style={{ padding: '0.75rem', fontWeight: 600 }}
        >
          {loading ? 'Submitting...' : 'Submit'}
        </button>
      </form>

      {error && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            background: '#fee',
            border: '1px solid #fcc',
            borderRadius: 4,
          }}
        >
          {error}
        </div>
      )}

      {result && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            background: '#efe',
            border: '1px solid #cfc',
            borderRadius: 4,
          }}
        >
          <p>
            <strong>ID:</strong> {result.id}
          </p>
          <p>
            <strong>Status:</strong> {result.status}
          </p>
          <p>
            <strong>Submitted:</strong> {result.submittedAt}
          </p>
        </div>
      )}
    </section>
  )
}
