'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SmoothScrollProvider } from './smooth-scroll-provider'
import { HeroScene } from './hero-scene'
import { KineticHeading } from './kinetic-heading'
import { ParallaxPanel } from './parallax-panel'
import { MagneticButton } from './magnetic-button'
import { createSceneState } from './scene-state'

gsap.registerPlugin(ScrollTrigger)

export function ExperiencePage() {
  const sceneStateRef = useRef(createSceneState())
  const journeyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const journey = journeyRef.current
    if (!journey) return

    // One scrubbed timeline drives the whole "journey": as the tall #journey
    // section crosses the viewport, it writes 0-1 progress into the shared
    // scene-state ref that geometric-cluster.tsx reads every frame.
    const trigger = ScrollTrigger.create({
      trigger: journey,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.8,
      onUpdate: (self) => {
        const p = self.progress
        sceneStateRef.current.scroll = p
        // Shards fly apart through the first half of the journey, hold, then
        // draw back in through the second half -- the object shatters and
        // reforms rather than staying broken apart.
        const explodeUp = gsap.utils.clamp(0, 1, (p - 0.1) / 0.35)
        const explodeDown = gsap.utils.clamp(0, 1, (p - 0.6) / 0.35)
        sceneStateRef.current.explode = explodeUp - explodeDown
        sceneStateRef.current.rotationBoost = Math.sin(p * Math.PI) * 1.2
      },
    })

    return () => trigger.kill()
  }, [])

  return (
    <SmoothScrollProvider>
      <HeroScene sceneStateRef={sceneStateRef} />

      <main className="relative text-[#f4ead9]">
        {/* THE HOOK -- hero */}
        <section className="relative flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <span
            className="mb-6 text-xs uppercase tracking-[0.35em] text-[#e8b84b]/80"
            style={{ textShadow: '0 2px 20px rgba(10,7,2,0.9)' }}
          >
            Cuppa&rsquo;s Cards &mdash; South Africa&rsquo;s premier middleman service
          </span>
          <KineticHeading
            text="Making every grade simple"
            className="max-w-4xl text-5xl font-serif leading-[1.05] sm:text-6xl md:text-7xl"
            style={{ textShadow: '0 4px 40px rgba(10,7,2,0.85)' }}
          />
          <p
            className="mt-8 max-w-md text-sm text-[#f4ead9]/70"
            style={{ textShadow: '0 2px 16px rgba(10,7,2,0.9)' }}
          >
            Everything should be made as simple as possible, but not simpler.
          </p>
        </section>

        {/* THE JOURNEY -- tall scroll-scrubbed section pinning the canvas behind it */}
        <div ref={journeyRef} className="relative" style={{ height: '300vh' }}>
          <div className="sticky top-0 flex h-screen flex-col justify-center gap-40 px-6">
            <ParallaxPanel speed={1.4} className="ml-auto max-w-md text-right">
              <h2 className="font-serif text-3xl sm:text-4xl">
                PCG and ACE certified middleman.
              </h2>
            </ParallaxPanel>

            <ParallaxPanel speed={0.6} className="mr-auto max-w-md">
              <h2 className="font-serif text-3xl sm:text-4xl">
                Clean, polish and prepare services available.
              </h2>
            </ParallaxPanel>
          </div>
        </div>

        {/* THE TACTILE INTERFACE */}
        <section className="relative flex min-h-screen flex-col items-center justify-center gap-10 px-6 text-center">
          <h2 className="max-w-lg font-serif text-3xl sm:text-4xl">
            Built for the collectors who notice everything.
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-5">
            <MagneticButton
              href="/dashboard"
              className="rounded-full bg-[#e8b84b] px-8 py-4 text-sm font-semibold text-[#1a1408] shadow-[0_0_40px_-10px_rgba(232,184,75,0.6)]"
            >
              Submit a Card
            </MagneticButton>
            <MagneticButton
              href="/shop"
              className="rounded-full border border-[#e8b84b]/40 px-8 py-4 text-sm font-semibold text-[#f4ead9]"
            >
              Browse the Vault
            </MagneticButton>
          </div>
        </section>
      </main>
    </SmoothScrollProvider>
  )
}
