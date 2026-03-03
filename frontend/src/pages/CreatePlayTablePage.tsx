import { Authenticator } from '@aws-amplify/ui-react'
import { Link } from 'react-router-dom'

export function CreatePlayTablePage() {
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
            <h1 style={{ margin: 0 }}>Create play table</h1>
            <div>
              <span style={{ marginRight: '1rem' }}>
                {user?.signInDetails?.loginId}
              </span>
              <button onClick={signOut}>Sign out</button>
            </div>
          </header>
          <p>
            <Link to="/dice">← Back to dice</Link>
          </p>
          {/* D3: createPlayTable call, invite link display */}
        </main>
      )}
    </Authenticator>
  )
}
