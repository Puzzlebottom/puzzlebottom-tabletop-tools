import { useState } from 'react'

export type AdvantageOption = 'advantage' | 'disadvantage' | null

export interface AdHocRollOptions {
  dc?: number
  advantage?: AdvantageOption
  visibility?: 'all' | 'gm_only'
}

export interface InitiativeRollRequestOptions {
  dc?: number
  advantage?: AdvantageOption
  isPrivate?: boolean
}

interface GMRollControlsProps {
  onRequestInitiative: (options: InitiativeRollRequestOptions) => void
  onAdHocRoll: (options: AdHocRollOptions) => void
  onClearInitiative: () => void
  /** Current ad hoc options; used when DiceRoller "Roll d20" is clicked. */
  adHocOptions: AdHocRollOptions
  onAdHocOptionsChange: (options: AdHocRollOptions) => void
  requestingInitiative?: boolean
  rolling?: boolean
  clearing?: boolean
}

export function GMRollControls({
  onRequestInitiative,
  onAdHocRoll,
  onClearInitiative,
  adHocOptions,
  onAdHocOptionsChange,
  requestingInitiative = false,
  rolling = false,
  clearing = false,
}: GMRollControlsProps) {
  const [initiativeDc, setInitiativeDc] = useState<string>('')
  const [initiativeAdvantage, setInitiativeAdvantage] =
    useState<AdvantageOption>(null)
  const [initiativePrivate, setInitiativePrivate] = useState(false)

  const adHocDc = adHocOptions.dc?.toString() ?? ''
  const adHocAdvantage = adHocOptions.advantage ?? null
  const adHocPrivate = adHocOptions.visibility === 'gm_only'

  const setAdHocDc = (v: string) => {
    const dc = v.trim() ? parseInt(v, 10) : undefined
    onAdHocOptionsChange({
      ...adHocOptions,
      dc: dc !== undefined && !Number.isNaN(dc) ? dc : undefined,
    })
  }
  const setAdHocAdvantage = (a: AdvantageOption) => {
    onAdHocOptionsChange({ ...adHocOptions, advantage: a })
  }
  const setAdHocPrivate = (p: boolean) => {
    onAdHocOptionsChange({
      ...adHocOptions,
      visibility: p ? 'gm_only' : 'all',
    })
  }

  const handleAdHocRoll = () => {
    onAdHocRoll(adHocOptions)
  }

  const handleRequestInitiative = () => {
    const dc = initiativeDc.trim() ? parseInt(initiativeDc, 10) : undefined
    onRequestInitiative({
      dc: dc !== undefined && !Number.isNaN(dc) ? dc : undefined,
      advantage: initiativeAdvantage,
      isPrivate: initiativePrivate,
    })
  }

  return (
    <section aria-label="GM roll controls">
      <h2>GM controls</h2>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          marginBottom: '1rem',
        }}
      >
        <fieldset style={{ border: '1px solid #ccc', padding: '0.5rem' }}>
          <legend>Ad hoc roll</legend>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.75rem',
              alignItems: 'center',
            }}
          >
            <label>
              DC:{' '}
              <input
                type="number"
                min={1}
                max={30}
                value={adHocDc}
                onChange={(e) => setAdHocDc(e.target.value)}
                placeholder="—"
                style={{ width: 48 }}
              />
            </label>
            <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                Advantage
              </legend>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {(['none', 'advantage', 'disadvantage'] as const).map((opt) => (
                  <label key={opt}>
                    <input
                      type="radio"
                      name="adHocAdvantage"
                      checked={
                        (opt === 'none' && adHocAdvantage === null) ||
                        (opt === 'advantage' &&
                          adHocAdvantage === 'advantage') ||
                        (opt === 'disadvantage' &&
                          adHocAdvantage === 'disadvantage')
                      }
                      onChange={() =>
                        setAdHocAdvantage(
                          opt === 'none'
                            ? null
                            : opt === 'advantage'
                              ? 'advantage'
                              : 'disadvantage'
                        )
                      }
                    />{' '}
                    {opt === 'none'
                      ? 'None'
                      : opt === 'advantage'
                        ? 'Adv'
                        : 'Dis'}
                  </label>
                ))}
              </div>
            </fieldset>
            <label>
              <input
                type="checkbox"
                checked={adHocPrivate}
                onChange={(e) => setAdHocPrivate(e.target.checked)}
              />{' '}
              Private (GM only)
            </label>
            <button type="button" onClick={handleAdHocRoll} disabled={rolling}>
              {rolling ? 'Rolling…' : 'Ad hoc roll'}
            </button>
          </div>
        </fieldset>

        <fieldset style={{ border: '1px solid #ccc', padding: '0.5rem' }}>
          <legend>Initiative</legend>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.75rem',
              alignItems: 'center',
            }}
          >
            <label>
              DC:{' '}
              <input
                type="number"
                min={1}
                max={30}
                value={initiativeDc}
                onChange={(e) => setInitiativeDc(e.target.value)}
                placeholder="—"
                style={{ width: 48 }}
              />
            </label>
            <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                Advantage
              </legend>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {(['none', 'advantage', 'disadvantage'] as const).map((opt) => (
                  <label key={opt}>
                    <input
                      type="radio"
                      name="initiativeAdvantage"
                      checked={
                        (opt === 'none' && initiativeAdvantage === null) ||
                        (opt === 'advantage' &&
                          initiativeAdvantage === 'advantage') ||
                        (opt === 'disadvantage' &&
                          initiativeAdvantage === 'disadvantage')
                      }
                      onChange={() =>
                        setInitiativeAdvantage(
                          opt === 'none'
                            ? null
                            : opt === 'advantage'
                              ? 'advantage'
                              : 'disadvantage'
                        )
                      }
                    />{' '}
                    {opt === 'none'
                      ? 'None'
                      : opt === 'advantage'
                        ? 'Adv'
                        : 'Dis'}
                  </label>
                ))}
              </div>
            </fieldset>
            <label>
              <input
                type="checkbox"
                checked={initiativePrivate}
                onChange={(e) => setInitiativePrivate(e.target.checked)}
              />{' '}
              Private
            </label>
            <button
              type="button"
              onClick={handleRequestInitiative}
              disabled={requestingInitiative}
            >
              {requestingInitiative ? 'Requesting…' : 'Request initiative roll'}
            </button>
          </div>
        </fieldset>

        <div>
          <button type="button" onClick={onClearInitiative} disabled={clearing}>
            {clearing ? 'Clearing…' : 'Clear initiative'}
          </button>
        </div>
      </div>
    </section>
  )
}
