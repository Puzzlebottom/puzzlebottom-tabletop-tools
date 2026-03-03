import { Canvas, useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group } from 'three'
import * as THREE from 'three'

/** Euler rotations (x, y, z) to orient d20 face for each value 1–20. */
const D20_VALUE_ROTATIONS: Record<number, [number, number, number]> = {
  1: [0, 0, 0],
  2: [0.31, 0.63, 0],
  3: [0.31, 1.26, 0],
  4: [0.31, 1.88, 0],
  5: [0.31, 2.51, 0],
  6: [0.31, 3.14, 0],
  7: [0.31, 3.77, 0],
  8: [0.31, 4.4, 0],
  9: [0.31, 5.03, 0],
  10: [0.31, 5.65, 0],
  11: [0.31, 6.28, 0],
  12: [0.31, 6.91, 0],
  13: [0.31, 7.54, 0],
  14: [0.31, 8.17, 0],
  15: [0.31, 8.8, 0],
  16: [0.31, 9.42, 0],
  17: [0.31, 10.05, 0],
  18: [0.31, 10.68, 0],
  19: [0.31, 11.31, 0],
  20: [0.31, 11.94, 0],
}

export interface DiceRollerProps {
  onRoll: () => void
  rolling: boolean
  disabled?: boolean
  /** d20 value when roll settled (1–20). Used to orient die. */
  settledValue?: number
  /** True when roll failed or timed out; show cocked die. */
  cocked?: boolean
}

function D20Mesh({
  rolling,
  settledValue,
  cocked,
}: {
  rolling: boolean
  settledValue?: number
  cocked?: boolean
}) {
  const meshRef = useRef<Group>(null)
  const targetRotation = useRef(new THREE.Euler(0, 0, 0)).current
  const currentRotation = useRef(new THREE.Euler(0, 0, 0)).current

  useFrame((_, delta) => {
    const mesh = meshRef.current
    if (!mesh) return

    if (rolling) {
      mesh.rotation.x += delta * 4
      mesh.rotation.y += delta * 6
      mesh.rotation.z += delta * 3
      currentRotation.copy(mesh.rotation)
    } else if (cocked) {
      targetRotation.set(0.4, 0.7, 0.2)
      currentRotation.x += (targetRotation.x - currentRotation.x) * delta * 2
      currentRotation.y += (targetRotation.y - currentRotation.y) * delta * 2
      currentRotation.z += (targetRotation.z - currentRotation.z) * delta * 2
      mesh.rotation.copy(currentRotation)
    } else if (
      settledValue !== undefined &&
      settledValue !== null &&
      settledValue >= 1 &&
      settledValue <= 20
    ) {
      const rot = D20_VALUE_ROTATIONS[settledValue]
      if (rot) {
        targetRotation.set(rot[0], rot[1], rot[2])
        currentRotation.x += (targetRotation.x - currentRotation.x) * delta * 4
        currentRotation.y += (targetRotation.y - currentRotation.y) * delta * 4
        currentRotation.z += (targetRotation.z - currentRotation.z) * delta * 4
        mesh.rotation.copy(currentRotation)
      }
    }
  })

  return (
    <group ref={meshRef}>
      <mesh>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          color="#e8d5b7"
          roughness={0.6}
          metalness={0.1}
          flatShading
        />
      </mesh>
    </group>
  )
}

function DiceScene({
  rolling,
  settledValue,
  cocked,
}: {
  rolling: boolean
  settledValue?: number
  cocked?: boolean
}) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 5, 5]} intensity={1} />
      <directionalLight position={[-2, 3, -2]} intensity={0.4} />
      <D20Mesh rolling={rolling} settledValue={settledValue} cocked={cocked} />
    </>
  )
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
          <DiceScene
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
