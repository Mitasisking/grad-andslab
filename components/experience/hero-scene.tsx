'use client'

import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { CardShatterFan } from './card-shatter-fan'
import type { SceneState } from './scene-state'
import type { ChaseCard } from './chase-cards'

interface HeroSceneProps {
  sceneStateRef: React.MutableRefObject<SceneState>
  chaseCards: ChaseCard[]
}

/**
 * Fixed full-viewport canvas that sits behind the scrolling HTML content --
 * this is what gives the "pinned 3D object" effect without needing
 * ScrollTrigger's DOM `pin` (which pins elements, not R3F scene objects).
 * The scroll-tied timeline in experience-page.tsx writes into `sceneStateRef`
 * every frame; this component only owns the render surface.
 */
export function HeroScene({ sceneStateRef, chaseCards }: HeroSceneProps) {
  return (
    <div className="fixed inset-0 -z-10" aria-hidden="true">
      <Canvas
        dpr={[1, 1.8]}
        camera={{ position: [0, 0, 5.5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.45} />
        <directionalLight position={[3, 4, 5]} intensity={1} color="#fff3d6" />
        <pointLight position={[-4, -2, -3]} intensity={0.3} color="#e8b84b" />
        <Suspense fallback={null}>
          <CardShatterFan sceneState={sceneStateRef} chaseCards={chaseCards} />
        </Suspense>
      </Canvas>
    </div>
  )
}
