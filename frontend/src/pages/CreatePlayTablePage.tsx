import { Authenticator } from '@aws-amplify/ui-react'
import type { CreatePlayTableMutation } from '@puzzlebottom-tabletop-tools/graphql-types'
import { generateClient } from 'aws-amplify/api'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { createPlayTableMutation } from '../graphql/mutations'

const client = generateClient()

export function CreatePlayTablePage() {
  return (
    <Authenticator>
      {({ signOut, user }) => (
        <CreatePlayTableContent signOut={signOut} user={user} />
      )}
    </Authenticator>
  )
}

function CreatePlayTableContent({
  signOut,
  user,
}: {
  signOut?: () => void
  user?: { signInDetails?: { loginId?: string } }
}) {
  const [playTable, setPlayTable] = useState<{
    id: string
    inviteCode: string
  } | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    setError(null)
    setCreating(true)
    try {
      const result = (await client.graphql({
        query: createPlayTableMutation,
      })) as { data: CreatePlayTableMutation }
      setPlayTable({
        id: result.data.createPlayTable.id,
        inviteCode: result.data.createPlayTable.inviteCode,
      })
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create play table'
      )
    } finally {
      setCreating(false)
    }
  }

  const inviteUrl = playTable
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/dice/join/${playTable.inviteCode}`
    : ''

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '2rem' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
        }}
      >
        <h1 style={{ margin: 0 }}>Create play table</h1>
        <div>
          <span style={{ marginRight: '1rem' }}>
            {user?.signInDetails?.loginId}
          </span>
          <button onClick={() => signOut?.()}>Sign out</button>
        </div>
      </header>
      <p>
        <Link to="/dice">← Back to dice</Link>
      </p>

      {playTable ? (
        <section>
          <h2>Invite link</h2>
          <p>Share this link with players to join your table:</p>
          <p
            style={{
              padding: '0.75rem',
              background: '#f5f5f5',
              borderRadius: 4,
              wordBreak: 'break-all',
              fontFamily: 'monospace',
            }}
          >
            {inviteUrl}
          </p>
          <Link to={`/dice/table/${playTable.id}`}>Go to play table →</Link>
        </section>
      ) : (
        <section>
          <button onClick={() => void handleCreate()} disabled={creating}>
            {creating ? 'Creating…' : 'Create play table'}
          </button>
          {error !== null && (
            <p style={{ color: 'red', marginTop: '1rem' }}>{error}</p>
          )}
        </section>
      )}
    </main>
  )
}
