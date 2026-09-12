'use client'

import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneState } from './scene-state'

interface ShardDef {
  direction: THREE.Vector3
  scale: number
  rotationSpeed: number
}

const SHARD_COUNT = 8

/**
 * The core icosahedron plus a ring of smaller "shard" icosahedra that fly
 * outward as `sceneState.explode` goes 0 -> 1. `sceneState` is a plain mutable
 * ref (not React state) so GSAP's scroll-scrubbed timeline can write to it
 * every frame without triggering React re-renders -- only the R3F render
 * loop (useFrame) ever reads it.
 */
export function GeometricCluster({ sceneState }: { sceneState: React.MutableRefObject<SceneState> }) {
  const groupRef = useRef<THREE.Group>(null)
  const coreRef = useRef<THREE.Mesh>(null)
  const shardRefs = useRef<(THREE.Mesh | null)[]>([])
  const pointer = useRef({ x: 0, y: 0 })
  const { viewport } = useThree()

  const shards = useMemo<ShardDef[]>(() => {
    return Array.from({ length: SHARD_COUNT }, (_, i) => {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / SHARD_COUNT)
      const theta = Math.PI * (1 + Math.sqrt(5)) * (i + 0.5)
      return {
        direction: new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta),
          Math.sin(phi) * Math.sin(theta),
          Math.cos(phi)
        ),
        scale: 0.32 + (i % 3) * 0.09,
        rotationSpeed: 0.3 + (i % 4) * 0.15,
      }
    })
  }, [])

  useFrame((state, delta) => {
    const { explode, scroll, rotationBoost } = sceneState.current

    // Mouse-follow tilt: normalize pointer to viewport, ease toward it so the
    // object settles instead of snapping every frame.
    pointer.current.x += (state.pointer.x - pointer.current.x) * 0.06
    pointer.current.y += (state.pointer.y - pointer.current.y) * 0.06

    if (groupRef.current) {
      groupRef.current.rotation.y = pointer.current.x * 0.5 + scroll * Math.PI * 1.5
      groupRef.current.rotation.x = -pointer.current.y * 0.35
      const targetScale = 1 + scroll * 0.9
      groupRef.current.scale.setScalar(
        THREE.MathUtils.damp(groupRef.current.scale.x, targetScale, 4, delta)
      )
    }

    if (coreRef.current) {
      coreRef.current.rotation.y += delta * (0.15 + rotationBoost)
      coreRef.current.rotation.x += delta * 0.08
      // The core visibly contracts as shards fly off, so the journey reads
      // as one object breaking apart rather than a fixed sphere sprouting
      // dust -- pure scale-up from the group above isn't enough on its own.
      const coreTargetScale = 1 - explode * 0.25
      coreRef.current.scale.setScalar(
        THREE.MathUtils.damp(coreRef.current.scale.x, coreTargetScale, 5, delta)
      )
    }

    shardRefs.current.forEach((mesh, i) => {
      if (!mesh) return
      const shard = shards[i]
      const distance = 0.55 + explode * 3.4
      mesh.position.copy(shard.direction).multiplyScalar(distance)
      mesh.rotation.x += delta * shard.rotationSpeed
      mesh.rotation.y += delta * shard.rotationSpeed * 0.7
      const opacity = THREE.MathUtils.clamp(0.55 + explode * 0.45, 0.55, 1)
      const material = mesh.material as THREE.MeshStandardMaterial
      material.opacity = opacity
    })
  })

  const scaleForViewport = Math.min(viewport.width, viewport.height) * 0.075

  return (
    <group ref={groupRef} scale={THREE.MathUtils.clamp(scaleForViewport, 0.45, 0.85)}>
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial
          color="#e8b84b"
          metalness={0.6}
          roughness={0.25}
          emissive="#3a2405"
          emissiveIntensity={0.25}
        />
      </mesh>
      {shards.map((shard, i) => (
        <mesh
          key={i}
          ref={(el) => {
            shardRefs.current[i] = el
          }}
          scale={shard.scale}
        >
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color="#fdf3de"
            metalness={0.15}
            roughness={0.45}
            emissive="#e8b84b"
            emissiveIntensity={0.5}
            transparent
            opacity={0.55}
          />
        </mesh>
      ))}
    </group>
  )
}
