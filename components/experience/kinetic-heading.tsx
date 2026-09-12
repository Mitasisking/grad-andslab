'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'

/** Splits `text` into per-word spans that gently float and fade in with depth staggering, establishing scale before any scroll interaction. */
export function KineticHeading({
  text,
  className = '',
  style,
}: {
  text: string
  className?: string
  style?: React.CSSProperties
}) {
  const containerRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const words = containerRef.current?.querySelectorAll('[data-word]')
    if (!words?.length) return

    gsap.fromTo(
      words,
      { y: 60, opacity: 0, rotateX: -25, filter: 'blur(6px)' },
      {
        y: 0,
        opacity: 1,
        rotateX: 0,
        filter: 'blur(0px)',
        duration: 1.4,
        ease: 'power4.out',
        stagger: 0.08,
        delay: 0.2,
      }
    )

    const floats = gsap.to(words, {
      y: -10,
      duration: 3.2,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
      stagger: { each: 0.4, from: 'random' },
      delay: 1.6,
    })

    return () => {
      floats.kill()
    }
  }, [])

  return (
    <h1
      ref={containerRef}
      className={`flex flex-wrap justify-center gap-x-6 gap-y-2 [perspective:800px] ${className}`}
      style={style}
    >
      {text.split(' ').map((word, i) => (
        <span key={i} data-word className="inline-block will-change-transform">
          {word}
        </span>
      ))}
    </h1>
  )
}
