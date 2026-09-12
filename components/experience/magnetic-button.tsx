'use client'

import { useRef, type ReactNode } from 'react'
import gsap from 'gsap'
import Link from 'next/link'

interface MagneticButtonProps {
  children: ReactNode
  href?: string
  onClick?: () => void
  className?: string
  /** Radius (px) around the button within which the cursor starts pulling it. */
  pullRadius?: number
  /** How far the button travels toward the cursor, 0-1 of the raw offset. */
  strength?: number
}

/**
 * A magnetic hover button: tracks the cursor within `pullRadius`, translates
 * toward it with a soft spring, and snaps back on leave. Click plays an
 * elastic scale bounce instead of a hard CSS state change.
 */
export function MagneticButton({
  children,
  href,
  onClick,
  className = '',
  pullRadius = 90,
  strength = 0.45,
}: MagneticButtonProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = wrapperRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const dx = e.clientX - centerX
    const dy = e.clientY - centerY
    const distance = Math.hypot(dx, dy)

    if (distance < pullRadius) {
      gsap.to(el, { x: dx * strength, y: dy * strength, duration: 0.6, ease: 'power3.out' })
      gsap.to(contentRef.current, { x: dx * strength * 0.4, y: dy * strength * 0.4, duration: 0.6, ease: 'power3.out' })
    }
  }

  const handleMouseLeave = () => {
    gsap.to(wrapperRef.current, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.4)' })
    gsap.to(contentRef.current, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.4)' })
  }

  const handleClick = () => {
    gsap.fromTo(
      wrapperRef.current,
      { scale: 0.88 },
      { scale: 1, duration: 0.9, ease: 'elastic.out(1, 0.35)' }
    )
    onClick?.()
  }

  const body = (
    <div
      ref={wrapperRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      className={`inline-flex will-change-transform ${className}`}
    >
      <div ref={contentRef} className="will-change-transform">
        {children}
      </div>
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="inline-flex">
        {body}
      </Link>
    )
  }

  return body
}
