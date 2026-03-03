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

function isVisibleToViewer(
  item: RollDisplayItem,
  viewerIsGm: boolean
): boolean {
  const visibility = item.visibility
  if (visibility === 'gm_only' && !viewerIsGm) return false
  return true
}

export function RollLog({
  rolls,
  onLoadMore,
  hasMore,
  loading,
  viewerIsGm = true,
}: {
  rolls: RollDisplayItem[]
  onLoadMore?: () => void
  hasMore?: boolean
  loading?: boolean
  /** When false, rolls with visibility gm_only are hidden. */
  viewerIsGm?: boolean
}) {
  const visibleRolls = viewerIsGm
    ? rolls
    : rolls.filter((r) => isVisibleToViewer(r, viewerIsGm))

  return (
    <section aria-label="Roll log">
      <h2>Roll log</h2>
      {visibleRolls.length === 0 && !loading ? (
        <p>No rolls yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {visibleRolls.map((item) => {
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
