'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

interface ParallaxPanelProps {
  children: ReactNode
  /** Higher = travels further/faster as it crosses the viewport; negative drifts the opposite way. */
  speed?: number
  className?: string
}

/** An HTML panel that slides over the fixed 3D canvas at its own speed, creating the diorama layering effect as the page scrolls. */
export function ParallaxPanel({ children, speed = 1, className = '' }: ParallaxPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = panelRef.current
    if (!el) return

    const travel = 120 * speed
    const tween = gsap.fromTo(
      el,
      { y: travel },
      {
        y: -travel,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.6,
        },
      }
    )

    return () => {
      tween.scrollTrigger?.kill()
      tween.kill()
    }
  }, [speed])

  return (
    <div ref={panelRef} className={`will-change-transform ${className}`}>
      {children}
    </div>
  )
}
