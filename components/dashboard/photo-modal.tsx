'use client'

import { useState } from 'react'

/** Lightbox for a card's intake photo, per app/shop/README.md. */
export function PhotoModal({ url, alt }: { url: string; alt: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block w-full h-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={alt} className="w-full h-full object-cover" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={() => setOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={alt} className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </>
  )
}
