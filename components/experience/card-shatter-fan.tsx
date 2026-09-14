'use client'

import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useTexture, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import type { SceneState } from './scene-state'
import { GRADER_SCHEMES, type ChaseCard } from './chase-cards'
import { createLabelTexture } from './label-texture'
import { playShatterSound, playGlintSound } from './sound-effects'

// Real card print ratio (63mm x 88mm) -- gives the fragment grid and the
// slab's card window their correct aspect instead of guessing a square.
const CARD_WIDTH = 1
const CARD_HEIGHT = CARD_WIDTH / (63 / 88)
const FRAGMENT_COLS = 5
const FRAGMENT_ROWS = 7

// Slab casing dimensions, derived rather than hand-picked so the header bar,
// card window and padding always stack flush with no gap or overlap.
const SLAB_PAD = 0.06
const SLAB_HEADER_H = 0.24
const SLAB_WIDTH = CARD_WIDTH + SLAB_PAD * 2
const SLAB_HEIGHT = CARD_HEIGHT + SLAB_HEADER_H + SLAB_PAD * 2
const SLAB_DEPTH = 0.16
const SLAB_HEADER_Y = SLAB_HEIGHT / 2 - SLAB_PAD - SLAB_HEADER_H / 2
const SLAB_CARD_Y = SLAB_HEADER_Y - SLAB_HEADER_H / 2 - CARD_HEIGHT / 2

// Scroll progress (0-1 across the whole journey) at which the raw card
// silently hands off to its graded slab -- chosen to land inside the plateau
// where `explode` is pinned at its max (see experience-page.tsx's
// explodeUp/explodeDown), so both mesh sets are already maximally scattered
// the instant the swap happens and the handoff itself is invisible.
const GRADED_SWAP_AT = 0.525

interface ScatterPiece {
  restPosition: THREE.Vector3
  direction: THREE.Vector3
  spin: number
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

/** Deterministic pseudo-random 0-1 value from an integer seed (no Math.random -- a piece's scatter path must be stable across re-renders). */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function scatterFrom(restPosition: THREE.Vector3, seed: number): ScatterPiece {
  const rand = seededRandom(seed)
  const jitterAngle = rand * Math.PI * 2
  const outward = restPosition.lengthSq() > 0 ? restPosition.clone().normalize() : new THREE.Vector3(0, 1, 0)
  const jitter = new THREE.Vector3(Math.cos(jitterAngle), Math.sin(jitterAngle), (rand - 0.5) * 2)
  return {
    restPosition,
    direction: outward.lerp(jitter, 0.6).normalize(),
    spin: 0.4 + rand * 1.4,
  }
}

function buildFragments(cardSeed: number): ScatterPiece[] {
  const fragments: ScatterPiece[] = []
  const fragW = CARD_WIDTH / FRAGMENT_COLS
  const fragH = CARD_HEIGHT / FRAGMENT_ROWS
  for (let row = 0; row < FRAGMENT_ROWS; row++) {
    for (let col = 0; col < FRAGMENT_COLS; col++) {
      const x = -CARD_WIDTH / 2 + (col + 0.5) * fragW
      const y = CARD_HEIGHT / 2 - (row + 0.5) * fragH
      const index = row * FRAGMENT_COLS + col
      fragments.push(scatterFrom(new THREE.Vector3(x, y, 0), index + cardSeed * 97))
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
 * Phase 1/2 -- the raw card, sliced into a grid of textured fragments that
 * sit flush (forming the whole card) at rest and fly outward along their own
 * fixed direction as `sceneState.explode` rises. Reading `sceneState`
 * directly in `useFrame` (not React state) is what keeps this card's shatter
 * in lockstep with the other two, since all three read the exact same ref
 * every frame. Hides itself past `GRADED_SWAP_AT` so Phase 3 can silently
 * hand off to <GradedSlab>.
 */
function CardFragments({ card, texture, sceneState, seed }: CardFragmentsProps) {
  const groupRef = useRef<THREE.Group>(null)
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
    const { explode, rotationBoost, scroll } = sceneState.current
    if (groupRef.current) groupRef.current.visible = scroll <= GRADED_SWAP_AT

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
      mesh.rotation.x = fragment.direction.y * tumble * fragment.spin
      mesh.rotation.y = -fragment.direction.x * tumble * fragment.spin
      mesh.rotation.z = Math.sin(t * fragment.spin + i) * tumble * 0.3
    })
  })

  return (
    <group ref={groupRef} position={[card.fanX, 0, card.fanZ]} rotation={[0, 0, card.fanRotationZ]}>
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

interface GradedSlabProps {
  card: ChaseCard
  texture: THREE.Texture
  sceneState: React.MutableRefObject<SceneState>
  seed: number
}

/**
 * Phase 3 -- the same `explode` value that drove the raw fragments apart now
 * drives this card's graded-slab pieces (shell, frosted mat, label plate,
 * rails) together: each starts scattered when `explode` is still near its
 * peak (right where CardFragments left off) and snaps into the assembled
 * slab as `explode` falls back to 0 across the rest of the scroll journey.
 * Only visible once `scroll` has crossed `GRADED_SWAP_AT`.
 */
function GradedSlab({ card, texture, sceneState, seed }: GradedSlabProps) {
  const groupRef = useRef<THREE.Group>(null)
  const shellRef = useRef<THREE.Mesh>(null)
  const borderRef = useRef<THREE.Mesh>(null)
  const cardRef = useRef<THREE.Mesh>(null)
  const labelRef = useRef<THREE.Mesh>(null)
  const railLeftRef = useRef<THREE.Mesh>(null)
  const railRightRef = useRef<THREE.Mesh>(null)
  const glintRef = useRef<THREE.Mesh>(null)

  const scheme = GRADER_SCHEMES[card.grader]
  const labelTexture = useMemo(() => createLabelTexture(card.grader, scheme), [card.grader, scheme])

  const pieces = useMemo(() => {
    const railX = SLAB_WIDTH / 2 - 0.025
    return {
      shell: scatterFrom(new THREE.Vector3(0, 0, 0), seed * 11 + 1),
      border: scatterFrom(new THREE.Vector3(0, SLAB_CARD_Y, -0.02), seed * 11 + 2),
      card: scatterFrom(new THREE.Vector3(0, SLAB_CARD_Y, 0), seed * 11 + 3),
      label: scatterFrom(new THREE.Vector3(0, SLAB_HEADER_Y, SLAB_DEPTH / 2 + 0.005), seed * 11 + 4),
      railLeft: scatterFrom(new THREE.Vector3(-railX, 0, 0), seed * 11 + 5),
      railRight: scatterFrom(new THREE.Vector3(railX, 0, 0), seed * 11 + 6),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed])

  const glintStartTime = useRef<number | null>(null)

  useFrame((state) => {
    const { explode, rotationBoost, scroll } = sceneState.current
    const isGraded = scroll > GRADED_SWAP_AT
    if (groupRef.current) groupRef.current.visible = isGraded

    // Bigger scatter radius than the raw fragments -- these are whole slab
    // components, not confetti, so they should read as chunks converging,
    // not dust settling.
    const travel = explode * 2.4
    const tumble = explode * (1 + rotationBoost * 0.5)
    const settle = 1 - explode

    const apply = (mesh: THREE.Mesh | null, piece: ScatterPiece, restScaleMul = 1) => {
      if (!mesh) return
      mesh.position.set(
        piece.restPosition.x + piece.direction.x * travel,
        piece.restPosition.y + piece.direction.y * travel,
        piece.restPosition.z + piece.direction.z * travel
      )
      mesh.rotation.x = piece.direction.y * tumble * piece.spin
      mesh.rotation.y = -piece.direction.x * tumble * piece.spin
      mesh.rotation.z = piece.direction.z * tumble * piece.spin * 0.5
      // Pieces are smaller while flying as loose "energy" chips and grow to
      // full size as they snap into the assembled slab.
      const scale = restScaleMul * (0.45 + settle * 0.55)
      mesh.scale.setScalar(scale)
    }

    apply(shellRef.current, pieces.shell)
    apply(borderRef.current, pieces.border)
    apply(cardRef.current, pieces.card)
    apply(labelRef.current, pieces.label)
    apply(railLeftRef.current, pieces.railLeft)
    apply(railRightRef.current, pieces.railRight)

    // Shine/glint: a brief additive sweep across the acrylic once the slab
    // is (close enough to) fully assembled -- retriggers each time the user
    // scrolls back into this settled state.
    if (glintRef.current) {
      const settled = explode < 0.03
      if (settled && glintStartTime.current === null) {
        glintStartTime.current = state.clock.elapsedTime
        // Spread the three cards' chimes into a chord (rather than three
        // identical copies stacked in unison, since all three settle on the
        // same shared `explode` value in the same frame).
        playGlintSound(seed * 3)
      } else if (!settled) {
        glintStartTime.current = null
      }
      if (glintStartTime.current !== null) {
        const sweepT = (state.clock.elapsedTime - glintStartTime.current) / 1.4
        const cycle = sweepT % 1
        const material = glintRef.current.material as THREE.MeshBasicMaterial
        material.opacity = cycle < 0.5 ? Math.sin(cycle * Math.PI) * 0.5 : 0
        glintRef.current.position.x = -SLAB_WIDTH / 2 + cycle * SLAB_WIDTH * 1.4
        glintRef.current.visible = true
      } else {
        glintRef.current.visible = false
      }
    }
  })

  return (
    <group position={[card.fanX, 0, card.fanZ]} rotation={[0, 0, card.fanRotationZ]} ref={groupRef}>
      {/* Frosted inner border/mat, sitting just behind the card art. */}
      <mesh ref={borderRef}>
        <planeGeometry args={[CARD_WIDTH + 0.08, CARD_HEIGHT + 0.08]} />
        <meshStandardMaterial color="#f4ead9" roughness={0.9} metalness={0} transparent opacity={0.85} />
      </mesh>

      {/* The card itself, now behind acrylic -- same art, no longer fragmented. */}
      <mesh ref={cardRef}>
        <planeGeometry args={[CARD_WIDTH, CARD_HEIGHT]} />
        <meshStandardMaterial map={texture} roughness={0.35} metalness={0.05} />
      </mesh>

      {/* Grading header plate. */}
      <mesh ref={labelRef}>
        <planeGeometry args={[SLAB_WIDTH - SLAB_PAD, SLAB_HEADER_H]} />
        <meshStandardMaterial map={labelTexture} roughness={0.4} metalness={0.2} />
      </mesh>

      {/* Clear side rails. */}
      <mesh ref={railLeftRef}>
        <boxGeometry args={[0.05, SLAB_HEIGHT - 0.04, SLAB_DEPTH + 0.02]} />
        <meshPhysicalMaterial color="#dfeaf2" roughness={0.15} metalness={0.1} transmission={0.6} thickness={0.3} />
      </mesh>
      <mesh ref={railRightRef}>
        <boxGeometry args={[0.05, SLAB_HEIGHT - 0.04, SLAB_DEPTH + 0.02]} />
        <meshPhysicalMaterial color="#dfeaf2" roughness={0.15} metalness={0.1} transmission={0.6} thickness={0.3} />
      </mesh>

      {/* Outer clear acrylic shell -- rendered last so its transparency reads correctly over everything it encases. */}
      <RoundedBox ref={shellRef} args={[SLAB_WIDTH, SLAB_HEIGHT, SLAB_DEPTH]} radius={0.05} smoothness={4}>
        <meshPhysicalMaterial
          color="#eaf2f6"
          roughness={0.08}
          metalness={0}
          transmission={0.92}
          thickness={0.4}
          ior={1.5}
          clearcoat={1}
          transparent
          opacity={0.35}
        />
      </RoundedBox>

      {/* Glint sweep -- additive, only visible once the slab has settled. */}
      <mesh ref={glintRef} position={[0, 0, SLAB_DEPTH / 2 + 0.01]} rotation={[0, 0, 0.5]} visible={false}>
        <planeGeometry args={[0.12, SLAB_HEIGHT * 1.3]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  )
}

/** 1x1 transparent GIF -- keeps useTexture's hook call unconditional even in the edge case where the Supabase fetch in chase-cards.ts returns 0 cards (no active Graded stock). */
const EMPTY_TEXTURE_SOURCE = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='

/**
 * The 3 chase cards -- the site's current top-3-priced active Graded
 * listings (components/experience/chase-cards.ts's getChaseCards), fanned
 * out into the fixed Mew-left/Pikachu-center/Gengar-right style layout,
 * tilting toward the cursor as a whole. "Raw to Graded" narrative: each
 * card's raw <CardFragments> shatters as `sceneState.explode` rises, then --
 * at the exact scroll point where all three are maximally scattered --
 * silently hands off to that card's <GradedSlab>, whose own pieces snap
 * together into an ACE- or PCG-labeled slab as `explode` falls back to 0.
 * All three cards read the same shared `sceneState`, so every phase
 * transition applies to all three at once.
 */
export function CardShatterFan({
  sceneState,
  chaseCards,
}: {
  sceneState: React.MutableRefObject<SceneState>
  chaseCards: ChaseCard[]
}) {
  const groupRef = useRef<THREE.Group>(null)
  const pointer = useRef({ x: 0, y: 0 })
  const hasPlayedShatter = useRef(false)
  const { viewport } = useThree()
  const textures = useTexture(chaseCards.length > 0 ? chaseCards.map((c) => c.image) : [EMPTY_TEXTURE_SOURCE])

  useMemo(() => {
    textures.forEach((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace
      texture.needsUpdate = true
    })
  }, [textures])

  useFrame((state, delta) => {
    const { scroll, explode } = sceneState.current

    // One shared "crack" for all three cards breaking at once, rather than
    // three separate copies -- fires once per rising crossing and re-arms
    // once `explode` has fully settled back near 0, so scrolling back up and
    // shattering again later replays it.
    if (explode > 0.12 && !hasPlayedShatter.current) {
      hasPlayedShatter.current = true
      playShatterSound()
    } else if (explode < 0.02) {
      hasPlayedShatter.current = false
    }

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
      {chaseCards.map((card, i) => (
        <group key={card.productId}>
          <CardFragments card={card} texture={textures[i]} sceneState={sceneState} seed={i} />
          <GradedSlab card={card} texture={textures[i]} sceneState={sceneState} seed={i} />
        </group>
      ))}
    </group>
  )
}
