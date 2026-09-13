'use client'

import { useRef } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'

// Real card print ratio (63mm x 88mm), same convention as the /experience
// shatter fan -- keeps every card mesh in this app the same true shape.
export const CARD_WIDTH = 1
export const CARD_HEIGHT = CARD_WIDTH / (63 / 88)

/**
 * One 3D card mesh: a textured plane that tilts toward the cursor and lifts
 * slightly on hover. `state.pointer` from R3F is already local to this
 * mesh's own `<Canvas>` (each nav card gets its own small canvas, see
 * card-nav-hub.tsx), so no cross-card pointer plumbing is needed -- hover
 * state itself still needs an explicit enter/leave pair since `pointer`
 * alone can't say whether the cursor is currently over the mesh or just
 * last was.
 */
export function NavCardMesh({ texture }: { texture: THREE.Texture }) {
  const groupRef = useRef<THREE.Group>(null)
  const hovered = useRef(false)
  const lift = useRef(0)
  const { viewport } = useThree()
  // Fills ~88% of this card's own small canvas, leaving room so the hover
  // tilt/lift never clips against the canvas edge.
  const fitScale = (Math.min(viewport.width / CARD_WIDTH, viewport.height / CARD_HEIGHT)) * 0.88

  useFrame((state, delta) => {
    if (!groupRef.current) return
    const targetX = hovered.current ? -state.pointer.y * 0.32 : 0
    const targetY = hovered.current ? state.pointer.x * 0.32 : 0
    groupRef.current.rotation.x = THREE.MathUtils.damp(groupRef.current.rotation.x, targetX, 7, delta)
    groupRef.current.rotation.y = THREE.MathUtils.damp(groupRef.current.rotation.y, targetY, 7, delta)

    lift.current = THREE.MathUtils.damp(lift.current, hovered.current ? 1 : 0, 6, delta)
    groupRef.current.position.z = lift.current * 0.12
    // Multiplies the static `fitScale` below rather than overwriting it --
    // this inner group only ever holds the *hover* scale delta.
    groupRef.current.scale.setScalar(1 + lift.current * 0.05)
  })

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    hovered.current = true
  }
  const handlePointerOut = () => {
    hovered.current = false
  }

  return (
    <group scale={fitScale}>
      <group ref={groupRef} onPointerOver={handlePointerOver} onPointerOut={handlePointerOut}>
        <mesh>
          <planeGeometry args={[CARD_WIDTH, CARD_HEIGHT]} />
          <meshStandardMaterial map={texture} roughness={0.35} metalness={0.08} />
        </mesh>
      </group>
    </group>
  )
}
