interface GMRollControlsProps {
  onRequestInitiative: () => void
  onAdHocRoll: () => void
  onClearInitiative: () => void
  requestingInitiative?: boolean
  rolling?: boolean
  clearing?: boolean
}

export function GMRollControls({
  onRequestInitiative,
  onAdHocRoll,
  onClearInitiative,
  requestingInitiative = false,
  rolling = false,
  clearing = false,
}: GMRollControlsProps) {
  return (
    <section aria-label="GM roll controls">
      <h2>GM controls</h2>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onRequestInitiative}
          disabled={requestingInitiative}
        >
          {requestingInitiative ? 'Requesting…' : 'Request initiative roll'}
        </button>
        <button type="button" onClick={onAdHocRoll} disabled={rolling}>
          {rolling ? 'Rolling…' : 'Ad hoc roll'}
        </button>
        <button type="button" onClick={onClearInitiative} disabled={clearing}>
          {clearing ? 'Clearing…' : 'Clear initiative'}
        </button>
      </div>
    </section>
  )
}
