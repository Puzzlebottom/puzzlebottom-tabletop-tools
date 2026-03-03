import { Authenticator } from '@aws-amplify/ui-react'
import { getCurrentUser } from 'aws-amplify/auth'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { getStoredPlayer } from '../lib/player-storage'

export function PlayTablePage() {
  const { playTableId } = useParams<{ playTableId: string }>()
  const [viewMode, setViewMode] = useState<
    'loading' | 'gm' | 'player' | 'redirect'
  >('loading')

  useEffect(() => {
    if (!playTableId) return

    const stored = getStoredPlayer()
    const storedPlayerKey = stored?.playerId ?? null
    const storedPlayTableId = stored?.playTableId ?? null
    const isPlayer =
      storedPlayerKey !== null && storedPlayTableId === playTableId

    if (isPlayer) {
      setViewMode('player')
      return
    }

    getCurrentUser()
      .then(() => setViewMode('gm'))
      .catch(() => setViewMode('redirect'))
  }, [playTableId])

  if (!playTableId || viewMode === 'loading') {
    return (
      <main style={{ maxWidth: 640, margin: '0 auto', padding: '2rem' }}>
        <p>Loading…</p>
      </main>
    )
  }

  if (viewMode === 'redirect') {
    return (
      <main style={{ maxWidth: 640, margin: '0 auto', padding: '2rem' }}>
        <h1>Join required</h1>
        <p>You need to join this play table via the invite link.</p>
      </main>
    )
  }

  if (viewMode === 'player') {
    return (
      <main style={{ maxWidth: 640, margin: '0 auto', padding: '2rem' }}>
        <h1>Play table</h1>
        <p>Table ID: {playTableId}</p>
        <p>(Player view)</p>
      </main>
    )
  }

  return (
    <Authenticator>
      {({ signOut, user }) => (
        <main style={{ maxWidth: 640, margin: '0 auto', padding: '2rem' }}>
          <header
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '2rem',
            }}
          >
            <h1 style={{ margin: 0 }}>Play table (GM)</h1>
            <div>
              <span style={{ marginRight: '1rem' }}>
                {user?.signInDetails?.loginId}
              </span>
              <button onClick={signOut}>Sign out</button>
            </div>
          </header>
          <p>Table ID: {playTableId}</p>
        </main>
      )}
    </Authenticator>
  )
}
