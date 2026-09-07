'use client'

import { useState } from 'react'

interface Props {
  src: string | undefined
  alt: string
  size?: number
}

/**
 * Framed, fixed-size thumbnail for the inventory table and form preview.
 * The frame's background doubles as the "loading" placeholder -- the img
 * stays invisible (not unmounted, so loading="lazy" can still do its job)
 * until it actually loads, and falls back to a "No image" label if there's
 * no URL or the URL 404s.
 */
export function ProductThumbnail({ src, alt, size = 50 }: Props) {
  const [prevSrc, setPrevSrc] = useState(src)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  // src changes on the same instance (form preview as the user types/uploads
  // a new URL) -- reset during render so a previous failure doesn't stick to
  // the new one. Not an effect: this is the React-docs-recommended way to
  // reset state on a prop change, since it resets before the stale state
  // ever paints instead of after an extra render.
  if (src !== prevSrc) {
    setPrevSrc(src)
    setLoaded(false)
    setFailed(false)
  }

  const showImage = !!src && !failed

  return (
    <div
      className="shrink-0 rounded-[3px] border overflow-hidden flex items-center justify-center"
      style={{ width: size, height: size, borderColor: 'var(--line)', background: 'var(--paper-raised)' }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className="w-full h-full object-contain transition-opacity duration-150"
          style={{ opacity: loaded ? 1 : 0 }}
        />
      ) : (
        <span className="text-[9px] text-center leading-tight px-1" style={{ color: 'var(--ink-muted)' }}>
          No image
        </span>
      )}
    </div>
  )
}
