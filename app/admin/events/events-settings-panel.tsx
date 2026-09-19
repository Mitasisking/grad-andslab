'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { EventSettingsRow } from '@/lib/submission-types'

interface Props {
  initialSettings: EventSettingsRow
}

export function EventSettingsPanel({ initialSettings }: Props) {
  const [slug, setSlug] = useState(initialSettings.active_event_slug ?? '')
  const [isLive, setIsLive] = useState(initialSettings.is_live)
  const [saved, setSaved] = useState<EventSettingsRow>(initialSettings)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty = slug !== (saved.active_event_slug ?? '') || isLive !== saved.is_live

  async function save() {
    setSaving(true)
    setError(null)

    const res = await fetch('/api/admin/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeEventSlug: slug.trim() || null, isLive }),
    })
    const data = await res.json()
    setSaving(false)

    if (!res.ok) {
      setError(data.error ?? 'Could not save event settings.')
      return
    }
    setSaved(data)
    setSlug(data.active_event_slug ?? '')
    setIsLive(data.is_live)
  }

  return (
    <div className="mt-8 space-y-6">
      <div>
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

      <button
        type="button"
        onClick={() => setIsLive((v) => !v)}
        className="flex items-center gap-3 py-3 border-t border-b text-left w-full"
        style={{ borderColor: 'var(--line)' }}
      >
        <span
          className="w-3.5 h-3.5 rounded-full border shrink-0"
          style={{
            borderColor: isLive ? 'var(--seal)' : 'var(--line)',
            background: isLive ? 'var(--seal)' : 'transparent',
          }}
        />
        <span className="text-[14px]" style={{ color: 'var(--ink)' }}>
          Event is live — default every /submit visitor to in-person drop-off mode
        </span>
      </button>

      <p className="text-[12.5px]" style={{ color: 'var(--ink-muted)' }}>
        Currently {saved.is_live ? 'live' : 'off'}
        {saved.active_event_slug ? ` — "${saved.active_event_slug}"` : ''}.
      </p>

      {error && (
        <p className="text-[13px]" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      <Button onClick={save} disabled={!dirty || saving} className="rounded-[3px]">
        {saving ? 'Saving…' : 'Save'}
      </Button>
    </div>
  )
}
