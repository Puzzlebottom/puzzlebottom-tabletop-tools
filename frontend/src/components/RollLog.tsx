import type { Roll } from '@puzzlebottom-tabletop-tools/graphql-types'

export type RollDisplayItem = Roll

function formatRoll(item: Roll): string {
  const id = item.id ?? 'unknown'
  const total = item.rollResult
  return `Roll ${id.slice(0, 8)}…: ${total}`
}

function isVisibleToViewer(item: Roll, viewerIsGm: boolean): boolean {
  if (item.isPrivate && !viewerIsGm) return false
  return true
}

export function RollLog({
  rolls,
  onLoadMore,
  hasMore,
  loading,
  viewerIsGm = true,
}: {
  rolls: Roll[]
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
            const key = item.id
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
