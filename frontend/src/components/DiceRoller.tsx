import { Canvas } from '@react-three/fiber'

import { DiceRollerScene } from './DiceRollerScene'

export interface DiceRollerProps {
  onRoll: () => void
  rolling: boolean
  disabled?: boolean
  /** d20 value when roll settled (1–20). Used to orient die. */
  settledValue?: number
  /** True when roll failed or timed out; show cocked die. */
  cocked?: boolean
}

export function DiceRoller({
  onRoll,
  rolling,
  disabled = false,
  settledValue,
  cocked = false,
}: DiceRollerProps) {
  const isBlocked = disabled || rolling
  const showCocked = cocked && !rolling

  return (
    <section aria-label="Dice roller">
      <h2>Roll dice</h2>
      <div
        style={{
          width: 160,
          height: 160,
          margin: '1rem 0',
          background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <Canvas
          camera={{ position: [0, 0, 3.5], fov: 45 }}
          gl={{ antialias: true, alpha: false }}
          style={{ width: '100%', height: '100%' }}
        >
          <DiceRollerScene
            rolling={rolling}
            settledValue={settledValue}
            cocked={showCocked}
          />
        </Canvas>
      </div>
      {showCocked && (
        <p style={{ color: '#c44', marginTop: '0.5rem', fontSize: '0.9rem' }}>
          Re-roll
        </p>
      )}
      <button type="button" onClick={onRoll} disabled={isBlocked}>
        {rolling ? 'Rolling…' : 'Roll d20'}
      </button>
    </section>
  )
}
