'use client'

import { useEffect, useRef, useState } from 'react'

// BarcodeDetector is a native, camera-based decoder shipping in Chromium
// browsers — not yet part of TypeScript's DOM lib types, hence the minimal
// ambient declaration instead of pulling in a QR-decoding dependency.
declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => {
      detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>
    }
  }
}

interface Props {
  onDetected: (token: string) => void
}

/** Camera QR scanner (native BarcodeDetector API), per app/shop/README.md. */
export function QrScanner({ onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const onDetectedRef = useRef(onDetected)
  const [error, setError] = useState<string | null>(null)
  const [unsupported, setUnsupported] = useState(false)

  useEffect(() => {
    onDetectedRef.current = onDetected
  }, [onDetected])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.BarcodeDetector) {
      setUnsupported(true)
      return
    }

    const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
    let stream: MediaStream | null = null
    let frameId = 0
    let stopped = false

    async function scan() {
      if (stopped || !videoRef.current) return
      try {
        const codes = await detector.detect(videoRef.current)
        const token = codes[0]?.rawValue
        if (token) {
          stopped = true
          stream?.getTracks().forEach((track) => track.stop())
          onDetectedRef.current(token)
          return
        }
      } catch {
        // A transient decode failure (e.g. no frame ready yet) — keep scanning.
      }
      frameId = requestAnimationFrame(scan)
    }

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        scan()
      } catch {
        setError('Could not access the camera. Use manual entry below instead.')
      }
    }

    start()

    return () => {
      stopped = true
      cancelAnimationFrame(frameId)
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  if (unsupported) {
    return (
      <p className="text-[13px]" style={{ color: 'var(--ink-muted)' }}>
        Camera scanning isn&apos;t supported in this browser — use manual entry below.
      </p>
    )
  }

  return (
    <div>
      <video
        ref={videoRef}
        muted
        playsInline
        className="w-full rounded-[3px] border aspect-video object-cover"
        style={{ borderColor: 'var(--line)' }}
      />
      {error && (
        <p className="text-[13px] mt-2" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
