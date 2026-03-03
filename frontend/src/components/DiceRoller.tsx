interface DiceRollerProps {
  onRoll: () => void
  rolling: boolean
  disabled?: boolean
}

export function DiceRoller({ onRoll, rolling, disabled }: DiceRollerProps) {
  return (
    <section aria-label="Dice roller">
      <h2>Roll dice</h2>
      <button
        type="button"
        onClick={onRoll}
        disabled={(disabled ?? false) || rolling}
      >
        {rolling ? 'Rolling…' : 'Roll d20'}
      </button>
    </section>
  )
}
