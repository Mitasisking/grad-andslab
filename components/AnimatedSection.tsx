'use client'

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface AnimatedSectionProps {
  children: ReactNode
  className?: string
  /** Stagger offset in seconds -- pass increasing values (0, 0.1, 0.2, ...) to a sibling group for a staggered entrance. */
  delay?: number
}

/**
 * Fade-up entrance animation for major page sections, playing once when the
 * element scrolls into view. Uses this app's own --ease-fluid curve
 * (app/globals.css) rather than framer-motion's default easing, so
 * scroll-triggered motion feels consistent with every CSS-transitioned
 * hover/press interaction elsewhere on the page. Deliberately a small,
 * generic wrapper (not tied to any one section's markup) so it can wrap any
 * block-level content without affecting layout.
 */
export function AnimatedSection({ children, className, delay = 0 }: AnimatedSectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
