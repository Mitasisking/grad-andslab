'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SmoothScrollProvider } from './smooth-scroll-provider'
import { HeroScene } from './hero-scene'
import { KineticHeading } from './kinetic-heading'
import { ParallaxPanel } from './parallax-panel'
import { MagneticButton } from './magnetic-button'
import { AudioToggle } from './audio-toggle'
import { createSceneState } from './scene-state'
import type { ChaseCard } from './chase-cards'

gsap.registerPlugin(ScrollTrigger)

/** Shared hover treatment for the two narrative beats that double as nav links -- an underline plus a shift to the same gold used throughout the page's CTAs, so a reader recognizes both as "clickable" the same way. */
const INLINE_LINK_CLASS =
  'underline decoration-[#e8b84b]/50 underline-offset-4 transition-colors duration-200 hover:text-[#e8b84b] hover:decoration-[#e8b84b]'

interface JourneyBeat {
  eyebrow: string
  heading: React.ReactNode
  body: string
  speed: number
  align: 'left' | 'right'
}

/**
 * The actual Cuppa's Cards pipeline, one beat per stage -- replaces the
 * original 2-panel placeholder copy ("PCG and ACE certified middleman." /
 * "Clean, polish and prepare services available.") with the full Intake →
 * Prep → Batching → Grading → Return story, keeping both of those exact
 * sentences (now as clickable links into the flows they name) rather than
 * discarding them.
 */
const JOURNEY_BEATS: JourneyBeat[] = [
  {
    eyebrow: '01 — Intake',
    heading: (
      <Link href="/submit" className={INLINE_LINK_CLASS}>
        PCG and ACE certified middleman.
      </Link>
    ),
    body: 'Every submission starts online: search your card, choose a tier, and it enters our queue in minutes.',
    speed: 1.4,
    align: 'right',
  },
  {
    eyebrow: '02 — Prep',
    heading: (
      <Link href="/services" className={INLINE_LINK_CLASS}>
        Clean, polish and prepare services available.
      </Link>
    ),
    body: 'Add a prep pass at checkout and our team gets every card show-ready before it ever reaches a grader.',
    speed: 0.6,
    align: 'left',
  },
  {
    eyebrow: '03 — Batching',
    heading: 'Grouped into a live batch.',
    body: "Your submission joins others on the same tier and ships the moment that batch fills — track it live from your dashboard.",
    speed: 1.1,
    align: 'right',
  },
  {
    eyebrow: '04 — Grading',
    heading: 'Inspected, graded, sealed.',
    body: 'PCG or ACE examines every angle under studio light, then seals the verdict for life inside its slab.',
    speed: 0.8,
    align: 'left',
  },
  {
    eyebrow: '05 — Return',
    heading: 'Insured, and on its way home.',
    body: 'We handle customs and duties, then ship your graded slabs back to your door with full fine-art insurance.',
    speed: 1.2,
    align: 'right',
  },
]

export function ExperiencePage({ chaseCards }: { chaseCards: ChaseCard[] }) {
  const sceneStateRef = useRef(createSceneState())
  const journeyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const journey = journeyRef.current
    if (!journey) return

    // One scrubbed timeline drives the whole "journey": as the tall #journey
    // section crosses the viewport, it writes 0-1 progress into the shared
    // scene-state ref that card-shatter-fan.tsx reads every frame. Its total
    // height is just the sum of the 5 beat sections below -- the explode/
    // rotation math is expressed as fractions of that 0-1 range, so it reads
    // the same regardless of how many beats (or how tall the section) is.
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
      <HeroScene sceneStateRef={sceneStateRef} chaseCards={chaseCards} />
      <AudioToggle />

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

        {/* THE JOURNEY -- 5 sequential pinned beats telling the actual Cuppa's Cards pipeline */}
        <div ref={journeyRef} className="relative">
          {JOURNEY_BEATS.map((beat) => (
            <div key={beat.eyebrow} className="relative h-[140vh]">
              <div className="sticky top-0 flex h-screen items-center px-6">
                <ParallaxPanel
                  speed={beat.speed}
                  className={
                    beat.align === 'right' ? 'ml-auto max-w-md text-right' : 'mr-auto max-w-md text-left'
                  }
                >
                  <span
                    className="mb-3 block text-xs uppercase tracking-[0.3em] text-[#e8b84b]/70"
                    style={{ textShadow: '0 2px 16px rgba(10,7,2,0.9)' }}
                  >
                    {beat.eyebrow}
                  </span>
                  <h2
                    className="font-serif text-3xl sm:text-4xl"
                    style={{ textShadow: '0 2px 20px rgba(10,7,2,0.9)' }}
                  >
                    {beat.heading}
                  </h2>
                  <p
                    className="mt-4 text-sm text-[#f4ead9]/70"
                    style={{ textShadow: '0 2px 16px rgba(10,7,2,0.9)' }}
                  >
                    {beat.body}
                  </p>
                </ParallaxPanel>
              </div>
            </div>
          ))}
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
