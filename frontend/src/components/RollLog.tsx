import type {
  Roll,
  RollResult,
} from '@puzzlebottom-tabletop-tools/graphql-types'

export type RollDisplayItem =
  | (Pick<
      Roll,
      | 'id'
      | 'rollerId'
      | 'rollerType'
      | 'total'
      | 'values'
      | 'modifier'
      | 'dc'
      | 'success'
      | 'visibility'
      | 'createdAt'
    > & {
      advantage?: string | null
    })
  | (Pick<
      RollResult,
      | 'rollId'
      | 'total'
      | 'values'
      | 'modifier'
      | 'dc'
      | 'success'
      | 'visibility'
    > & {
      advantage?: string | null
      id?: string
      rollerId?: string
      rollerType?: string
      createdAt?: string
    })

function formatRoll(item: RollDisplayItem): string {
  const id = ('id' in item ? item.id : item.rollId) ?? 'unknown'
  const total = item.total
  const dcPart =
    item.dc !== undefined && item.dc !== null
      ? ` (DC ${item.dc}${item.success !== undefined && item.success !== null ? `, ${item.success ? 'success' : 'fail'}` : ''})`
      : ''
  const advPart = item.advantage ? ` [${item.advantage}]` : ''
  return `Roll ${id.slice(0, 8)}…: ${total}${dcPart}${advPart}`
}

export function RollLog({
  rolls,
  onLoadMore,
  hasMore,
  loading,
}: {
  rolls: RollDisplayItem[]
  onLoadMore?: () => void
  hasMore?: boolean
  loading?: boolean
}) {
  return (
    <section aria-label="Roll log">
      <h2>Roll log</h2>
      {rolls.length === 0 && !loading ? (
        <p>No rolls yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {rolls.map((item) => {
            const key = 'id' in item ? item.id : item.rollId
            return (
              <li
                key={key}
                style={{
                  padding: '0.5rem 0',
                  borderBottom: '1px solid #eee',
                }}
              >
                {formatRoll(item)}
              </li>
            )
          })}
        </ul>
      )}
      {hasMore && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loading}
          style={{ marginTop: '0.5rem' }}
        >
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}
    </section>
  )
}
