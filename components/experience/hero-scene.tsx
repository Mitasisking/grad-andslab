'use client'

import { Canvas } from '@react-three/fiber'
import { GeometricCluster } from './geometric-cluster'
import type { SceneState } from './scene-state'

/**
 * Fixed full-viewport canvas that sits behind the scrolling HTML content --
 * this is what gives the "pinned 3D object" effect without needing
 * ScrollTrigger's DOM `pin` (which pins elements, not R3F scene objects).
 * The scroll-tied timeline in experience-page.tsx writes into `sceneStateRef`
 * every frame; this component only owns the render surface.
 */
export function HeroScene({ sceneStateRef }: { sceneStateRef: React.MutableRefObject<SceneState> }) {
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
        <GeometricCluster sceneState={sceneStateRef} />
      </Canvas>
    </div>
  )
}
