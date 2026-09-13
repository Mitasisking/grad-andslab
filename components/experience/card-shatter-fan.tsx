'use client'

import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import type { SceneState } from './scene-state'
import { CHASE_CARDS, type ChaseCard } from './chase-cards'

// Real card print ratio (63mm x 88mm) -- gives the fragment grid below its
// correct aspect instead of guessing a square.
const CARD_WIDTH = 1
const CARD_HEIGHT = CARD_WIDTH / (63 / 88)
const FRAGMENT_COLS = 5
const FRAGMENT_ROWS = 7

interface FragmentDef {
  restPosition: THREE.Vector3
  /** Fixed per-fragment outward direction the shatter travels along -- deterministic (seeded), not re-randomized on every render. */
  direction: THREE.Vector3
  rotationSpeed: number
}

/**
 * Remaps a PlaneGeometry's default [0,1] UVs down to one [col,row] cell of a
 * `FRAGMENT_COLS`x`FRAGMENT_ROWS` grid, so this one fragment samples only its
 * own patch of the source card texture -- this is what makes a fragment's
 * color literally a piece of that card's own artwork rather than a guessed
 * flat tint, and what makes the fragments reassemble into the exact card
 * image when they're at rest (explode = 0).
 */
function sliceFragmentUVs(geometry: THREE.PlaneGeometry, col: number, row: number) {
  const uv = geometry.attributes.uv
  const uMin = col / FRAGMENT_COLS
  const uMax = (col + 1) / FRAGMENT_COLS
  // Row 0 is the top of the card; texture V=1 is also the top (TextureLoader's
  // default flipY), so row 0 maps to the *top* slice of V, not the bottom.
  const vMin = 1 - (row + 1) / FRAGMENT_ROWS
  const vMax = 1 - row / FRAGMENT_ROWS
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i)
    const v = uv.getY(i)
    uv.setXY(i, uMin + u * (uMax - uMin), vMin + v * (vMax - vMin))
  }
  uv.needsUpdate = true
}

/** Deterministic pseudo-random 0-1 value from an integer seed (no Math.random -- a fragment's shatter path must be stable across re-renders). */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function buildFragments(cardSeed: number): FragmentDef[] {
  const fragments: FragmentDef[] = []
  const fragW = CARD_WIDTH / FRAGMENT_COLS
  const fragH = CARD_HEIGHT / FRAGMENT_ROWS
  for (let row = 0; row < FRAGMENT_ROWS; row++) {
    for (let col = 0; col < FRAGMENT_COLS; col++) {
      const x = -CARD_WIDTH / 2 + (col + 0.5) * fragW
      const y = CARD_HEIGHT / 2 - (row + 0.5) * fragH
      const index = row * FRAGMENT_COLS + col
      const rand = seededRandom(index + cardSeed * 97)
      const jitterAngle = rand * Math.PI * 2
      // Mostly radiates away from the card's own center, with enough random
      // jitter mixed in that the shatter reads as debris, not a uniform burst.
      const outward = new THREE.Vector3(x, y, 0).normalize()
      const jitter = new THREE.Vector3(Math.cos(jitterAngle), Math.sin(jitterAngle), (rand - 0.5) * 2)
      fragments.push({
        restPosition: new THREE.Vector3(x, y, 0),
        direction: outward.lerp(jitter, 0.6).normalize(),
        rotationSpeed: 0.4 + rand * 1.4,
      })
    }
  }
  return fragments
}

interface CardFragmentsProps {
  card: ChaseCard
  texture: THREE.Texture
  sceneState: React.MutableRefObject<SceneState>
  seed: number
}

/**
 * One chase card, sliced into a grid of textured fragments that sit flush
 * (forming the whole card) at rest and fly outward along their own fixed
 * direction as `sceneState.explode` rises -- reading `sceneState` directly in
 * `useFrame` (not React state) is what keeps this card's shatter in lockstep
 * with the other two, since all three read the exact same ref every frame.
 */
function CardFragments({ card, texture, sceneState, seed }: CardFragmentsProps) {
  const fragmentRefs = useRef<(THREE.Mesh | null)[]>([])
  const fragments = useMemo(() => buildFragments(seed), [seed])
  const geometries = useMemo(() => {
    return fragments.map((_, i) => {
      const row = Math.floor(i / FRAGMENT_COLS)
      const col = i % FRAGMENT_COLS
      const geometry = new THREE.PlaneGeometry(CARD_WIDTH / FRAGMENT_COLS, CARD_HEIGHT / FRAGMENT_ROWS)
      sliceFragmentUVs(geometry, col, row)
      return geometry
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fragments])

  useFrame((state) => {
    const { explode, rotationBoost } = sceneState.current
    const travel = explode * 1.7
    // Rotation is SET (a pure function of `explode`), never incremented --
    // an incremented spin keeps drifting even after `explode` returns to 0,
    // so the fragments would land back at their exact rest *positions* but
    // at random leftover angles: a jumbled mess instead of the flat,
    // correctly-oriented card the shatter is supposed to reassemble into.
    const tumble = explode * (1 + rotationBoost * 0.6)
    const t = state.clock.elapsedTime
    fragmentRefs.current.forEach((mesh, i) => {
      if (!mesh) return
      const fragment = fragments[i]
      mesh.position.set(
        fragment.restPosition.x + fragment.direction.x * travel,
        fragment.restPosition.y + fragment.direction.y * travel,
        fragment.restPosition.z + fragment.direction.z * travel
      )
      mesh.rotation.x = fragment.direction.y * tumble * fragment.rotationSpeed
      mesh.rotation.y = -fragment.direction.x * tumble * fragment.rotationSpeed
      mesh.rotation.z = Math.sin(t * fragment.rotationSpeed + i) * tumble * 0.3
    })
  })

  return (
    <group position={[card.fanX, 0, card.fanZ]} rotation={[0, 0, card.fanRotationZ]}>
      {geometries.map((geometry, i) => (
        <mesh
          key={i}
          ref={(el) => {
            fragmentRefs.current[i] = el
          }}
          geometry={geometry}
        >
          <meshStandardMaterial map={texture} metalness={0.1} roughness={0.4} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * The three chase cards (Mew ex, Pikachu ex, Mega Gengar ex) fanned out
 * Mew-left/Pikachu-center/Gengar-right, tilting toward the cursor as a whole.
 * Each card is its own grid of textured fragments (CardFragments) driven by
 * the same shared `sceneState`, so "shatter" applies to all three
 * simultaneously and every fragment's color is sampled straight from that
 * card's own artwork rather than an approximated tint.
 */
export function CardShatterFan({ sceneState }: { sceneState: React.MutableRefObject<SceneState> }) {
  const groupRef = useRef<THREE.Group>(null)
  const pointer = useRef({ x: 0, y: 0 })
  const { viewport } = useThree()
  const textures = useTexture(CHASE_CARDS.map((c) => c.image))

  useMemo(() => {
    textures.forEach((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace
      texture.needsUpdate = true
    })
  }, [textures])

  useFrame((state, delta) => {
    const { scroll } = sceneState.current

    // Mouse-follow tilt: ease toward the cursor so the fan settles instead of
    // snapping every frame.
    pointer.current.x += (state.pointer.x - pointer.current.x) * 0.06
    pointer.current.y += (state.pointer.y - pointer.current.y) * 0.06

    if (groupRef.current) {
      // A wide scroll-driven swing (the old abstract gem used up to 1.5*PI)
      // reads fine on a shape that looks the same from every angle, but
      // flat cards go edge-on and effectively disappear well before that --
      // kept small here so the fan stays face-on through the whole journey.
      groupRef.current.rotation.y = pointer.current.x * 0.5 + scroll * 0.5
      groupRef.current.rotation.x = -pointer.current.y * 0.35
      const targetScale = 1 + scroll * 0.9
      groupRef.current.scale.setScalar(
        THREE.MathUtils.damp(groupRef.current.scale.x, targetScale, 4, delta)
      )
    }
  })

  const scaleForViewport = Math.min(viewport.width, viewport.height) * 0.11

  return (
    <group ref={groupRef} scale={THREE.MathUtils.clamp(scaleForViewport, 0.32, 0.55)}>
      {CHASE_CARDS.map((card, i) => (
        <CardFragments key={card.tcgdexId} card={card} texture={textures[i]} sceneState={sceneState} seed={i} />
      ))}
    </group>
  )
}
