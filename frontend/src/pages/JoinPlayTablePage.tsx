import { useParams } from 'react-router-dom'

export function JoinPlayTablePage() {
  const { inviteCode } = useParams<{ inviteCode: string }>()

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '2rem' }}>
      <h1>Join play table</h1>
      <p>Invite code: {inviteCode ?? '—'}</p>
      {/* D2: form for characterName, initiativeModifier */}
    </main>
  )
}
