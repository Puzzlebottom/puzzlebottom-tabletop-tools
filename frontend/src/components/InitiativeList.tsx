export interface InitiativeEntry {
  id: string
  characterName: string
  value: number
  modifier: number
  total: number
}

export function InitiativeList({ order }: { order: InitiativeEntry[] }) {
  if (order.length === 0) {
    return (
      <section aria-label="Initiative order">
        <h2>Initiative</h2>
        <p>No initiative order yet.</p>
      </section>
    )
  }

  return (
    <section aria-label="Initiative order">
      <h2>Initiative</h2>
      <ol style={{ paddingLeft: '1.5rem' }}>
        {order.map((entry) => (
          <li key={entry.id} style={{ marginBottom: '0.25rem' }}>
            {entry.characterName}: {entry.total} (d20: {entry.value} +{' '}
            {entry.modifier})
          </li>
        ))}
      </ol>
    </section>
  )
}
