'use client'

import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import type { EventSettingsRow } from '@/lib/submission-types'

interface Props {
  initialSettings: EventSettingsRow
}

/**
 * Renders the wrapping <svg> from a QRCodeSVG ref to a PNG data URL and
 * triggers a browser download -- QRCodeSVG only ever renders inline SVG, so
 * this is the standard SVG -> canvas -> PNG round-trip rather than a
 * server-side rendering step.
 */
function downloadSvgAsPng(svg: SVGSVGElement, filename: string) {
  // QRCodeSVG sets width/height attrs to its `size` prop directly, but
  // viewBox to the QR's cell-count grid (e.g. "0 0 29 29") -- the rendered
  // pixel size, not the cell count, is what we want here.
  const size = svg.width.baseVal.value || 256
  const scale = 4 // upscale for a crisp print, not just a 1:1 screen-res PNG
  const serialized = new XMLSerializer().serializeToString(svg)
  const svgBlob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  const image = new Image()
  image.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = size * scale
    canvas.height = size * scale
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    }
    URL.revokeObjectURL(url)

    const link = document.createElement('a')
    link.download = filename
    link.href = canvas.toDataURL('image/png')
    link.click()
  }
  image.src = url
}

export function EventSettingsPanel({ initialSettings }: Props) {
  const [slug, setSlug] = useState(initialSettings.active_event_slug ?? '')
  const [name, setName] = useState(initialSettings.active_event_name ?? '')
  const [isLive, setIsLive] = useState(initialSettings.is_live)
  const [saved, setSaved] = useState<EventSettingsRow>(initialSettings)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // window.location.origin isn't available during SSR -- populated on mount
  // so the booth link/QR only ever show a real, working origin. Deliberately
  // NOT siteConfig.domain (cuppascards.co.za): that domain isn't live yet
  // (see PROJECT_STATE.md's Resend domain-verification note), so hardcoding
  // it here would print a QR code that leads nowhere. Once DNS actually
  // points there, this naturally resolves to the same domain.
  const [origin, setOrigin] = useState('')
  const qrRef = useRef<SVGSVGElement | null>(null)

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const dirty = slug !== (saved.active_event_slug ?? '') || name !== (saved.active_event_name ?? '') || isLive !== saved.is_live

  const boothPath = slug.trim() ? `/submit?intake=in-person&event=${encodeURIComponent(slug.trim())}` : '/submit?intake=in-person'
  const boothLink = origin ? `${origin}${boothPath}` : ''

  async function save() {
    setSaving(true)
    setError(null)

    const res = await fetch('/api/admin/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeEventSlug: slug.trim() || null, activeEventName: name.trim() || null, isLive }),
    })
    const data = await res.json()
    setSaving(false)

    if (!res.ok) {
      setError(data.error ?? 'Could not save event settings.')
      return
    }
    setSaved(data)
    setSlug(data.active_event_slug ?? '')
    setName(data.active_event_name ?? '')
    setIsLive(data.is_live)
  }

  function copyBoothLink() {
    if (boothLink) navigator.clipboard?.writeText(boothLink)
  }

  function downloadQr() {
    if (qrRef.current) downloadSvgAsPng(qrRef.current, `${slug.trim() || 'booth'}-qr.png`)
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="print:hidden">
        <label className="text-[13px] block mb-1.5" style={{ color: 'var(--ink-muted)' }}>
          Event name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Comic Con Cape Town 2026"
          className="w-full border rounded-[3px] px-3 py-2 text-[14px] bg-transparent"
          style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
        />
      </div>

      <div className="print:hidden">
        <label className="text-[13px] block mb-1.5" style={{ color: 'var(--ink-muted)' }}>
          Active event slug
        </label>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="e.g. comic-con-jhb"
          className="w-full border rounded-[3px] px-3 py-2 text-[14px] bg-transparent"
          style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
        />
      </div>

      <label className="print:hidden flex items-center gap-3 py-3 border-t border-b cursor-pointer" style={{ borderColor: 'var(--line)' }}>
        <Switch
          checked={isLive}
          onCheckedChange={setIsLive}
          style={{ background: isLive ? 'var(--seal)' : 'var(--line)' }}
        />
        <span className="text-[14px]" style={{ color: 'var(--ink)' }}>
          Activate Live Event Mode — default every /submit visitor to in-person drop-off
        </span>
      </label>

      <p className="print:hidden text-[12.5px]" style={{ color: 'var(--ink-muted)' }}>
        Currently {saved.is_live ? 'live' : 'off'}
        {saved.active_event_name ? ` — "${saved.active_event_name}"` : saved.active_event_slug ? ` — "${saved.active_event_slug}"` : ''}.
      </p>

      {error && (
        <p className="print:hidden text-[13px]" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      <Button onClick={save} disabled={!dirty || saving} className="print:hidden rounded-[3px]">
        {saving ? 'Saving…' : 'Save'}
      </Button>

      <div className="border-t pt-6 print:border-0 print:pt-0" style={{ borderColor: 'var(--line)' }}>
        <h2 className="print:hidden text-[16px] mb-3" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
          Booth link &amp; QR code
        </h2>

        <div className="flex flex-col items-start gap-4 print:items-center print:mt-16">
          {name.trim() && <p className="hidden print:block text-[22px] mb-2 text-center">{name.trim()}</p>}

          <div className="bg-white p-3 rounded-[3px] print:p-0 print:rounded-none">
            {boothLink ? <QRCodeSVG ref={qrRef} value={boothLink} size={160} /> : null}
          </div>

          <p className="print:hidden text-[13px] break-all" style={{ color: 'var(--ink-muted)' }}>
            {boothLink || 'Resolving link…'}
          </p>
          <p className="hidden print:block text-[13px] mt-2">{boothLink}</p>

          <div className="print:hidden flex gap-3">
            <Button type="button" variant="outline" className="rounded-[3px]" onClick={copyBoothLink} disabled={!boothLink}>
              Copy link
            </Button>
            <Button type="button" variant="outline" className="rounded-[3px]" onClick={downloadQr} disabled={!boothLink}>
              Download QR
            </Button>
            <Button type="button" variant="outline" className="rounded-[3px]" onClick={() => window.print()} disabled={!boothLink}>
              Print
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
