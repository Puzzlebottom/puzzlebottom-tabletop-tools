import type {
  JoinPlayTableMutation,
  PlayTableByInviteCodeQuery,
} from '@puzzlebottom-tabletop-tools/graphql-types'
import { generateClient } from 'aws-amplify/api'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { joinPlayTableMutation } from '../graphql/mutations'
import { playTableByInviteCodeQuery } from '../graphql/queries'
import { getStoredPlayer, storePlayer } from '../lib/player-storage'

const client = generateClient()

const API_KEY = import.meta.env.VITE_GRAPHQL_API_KEY

/** Extract user-facing message from Amplify/AppSync/GraphQL errors. */
function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  const o = err as Record<string, unknown>
  const gqlErrors = o.errors as { message?: string }[] | undefined
  if (Array.isArray(gqlErrors) && gqlErrors[0]?.message) {
    return gqlErrors[0].message
  }
  if (typeof o.message === 'string') return o.message
  return 'Failed to join play table'
}

export function JoinPlayTablePage() {
  const { inviteCode } = useParams<{ inviteCode: string }>()
  const navigate = useNavigate()
  const [characterName, setCharacterName] = useState('')
  const [initiativeModifier, setInitiativeModifier] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [checkingRejoin, setCheckingRejoin] = useState(true)

  useEffect(() => {
    if (!API_KEY) {
      setCheckingRejoin(false)
      return
    }
    const stored = getStoredPlayer()
    if (!stored || !inviteCode?.trim()) {
      setCheckingRejoin(false)
      return
    }
    let cancelled = false
    const check = async () => {
      try {
        const result = (await client.graphql({
          query: playTableByInviteCodeQuery,
          variables: { inviteCode: inviteCode.trim() },
          authMode: 'apiKey',
          apiKey: API_KEY,
        })) as { data: PlayTableByInviteCodeQuery }
        const playTableId = result.data.playTableByInviteCode?.id
        if (!cancelled && playTableId === stored.playTableId) {
          void navigate(`/dice/table/${playTableId}`, { replace: true })
        }
      } catch {
        // Fall through to show form
      } finally {
        if (!cancelled) setCheckingRejoin(false)
      }
    }
    void check()
    return () => {
      cancelled = true
    }
  }, [inviteCode, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteCode?.trim()) {
      setError('Invite code is required')
      return
    }
    if (!characterName.trim()) {
      setError('Character name is required')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const result = (await client.graphql({
        query: joinPlayTableMutation,
        variables: {
          inviteCode: inviteCode.trim(),
          input: {
            characterName: characterName.trim(),
            initiativeModifier,
          },
        },
        authMode: 'apiKey',
        apiKey: API_KEY,
      })) as {
        data?: JoinPlayTableMutation
        errors?: { message?: string }[]
      }

      const gqlErrors = result.errors
      if (Array.isArray(gqlErrors) && gqlErrors[0]?.message) {
        setError(gqlErrors[0].message)
        return
      }

      const joinResult = result.data?.joinPlayTable
      if (!joinResult) {
        setError('Failed to join play table')
        return
      }

      const { id, playTableId } = joinResult
      storePlayer(id, playTableId)
      void navigate(`/dice/table/${playTableId}`, { replace: true })
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (checkingRejoin) {
    return (
      <main style={{ maxWidth: 640, margin: '0 auto', padding: '2rem' }}>
        <p>Checking…</p>
      </main>
    )
  }

  if (!API_KEY) {
    return (
      <main style={{ maxWidth: 640, margin: '0 auto', padding: '2rem' }}>
        <h1>Join play table</h1>
        <p style={{ color: 'red' }}>
          This app is misconfigured: the API key for unauthenticated access is
          missing. Please contact the table host or try again later.
        </p>
      </main>
    )
  }

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '2rem' }}>
      <h1>Join play table</h1>
      <p>Invite code: {inviteCode ?? '—'}</p>
      <form
        onSubmit={(e) => {
          void handleSubmit(e)
        }}
      >
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="characterName">
            Character name
            <input
              id="characterName"
              type="text"
              value={characterName}
              onChange={(e) => setCharacterName(e.target.value)}
              required
              disabled={submitting}
              style={{ display: 'block', marginTop: '0.25rem', width: '100%' }}
            />
          </label>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="initiativeModifier">
            Initiative modifier
            <input
              id="initiativeModifier"
              type="number"
              value={initiativeModifier}
              onChange={(e) =>
                setInitiativeModifier(parseInt(e.target.value, 10) || 0)
              }
              disabled={submitting}
              style={{ display: 'block', marginTop: '0.25rem', width: '100%' }}
            />
          </label>
        </div>
        {error !== null && (
          <p style={{ color: 'red', marginBottom: '1rem' }}>{error}</p>
        )}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Joining…' : 'Join'}
        </button>
      </form>
    </main>
  )
}
