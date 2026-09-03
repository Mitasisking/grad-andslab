'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createAddress } from '@/lib/addresses-client'
import type { ShippingAddress } from '@/lib/submission-types'

interface Props {
  onCreated: (address: ShippingAddress) => void
  onCancel: () => void
}

export function AddAddressForm({ onCreated, onCancel }: Props) {
  const [fullName, setFullName] = useState('')
  const [line1, setLine1] = useState('')
  const [line2, setLine2] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [postal, setPostal] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSave = Boolean(fullName.trim() && line1.trim() && city.trim() && state.trim() && postal.trim())

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setError(null)

    const address = await createAddress({
      fullName,
      line1,
      line2: line2 || undefined,
      city,
      state,
      postal,
      country: 'US',
    })

    setSaving(false)
    if (!address) {
      setError('Could not save this address. Check the fields and try again.')
      return
    }
    onCreated(address)
  }

  return (
    <div className="border rounded-[3px] p-4 mt-3" style={{ borderColor: 'var(--line)' }}>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <Label className="text-[12.5px]" style={{ color: 'var(--ink-muted)' }}>
            Full name
          </Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Alex Rivera" />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-[12.5px]" style={{ color: 'var(--ink-muted)' }}>
            Address line 1
          </Label>
          <Input value={line1} onChange={(e) => setLine1(e.target.value)} placeholder="482 Birchwood Ave" />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-[12.5px]" style={{ color: 'var(--ink-muted)' }}>
            Address line 2 (optional)
          </Label>
          <Input value={line2} onChange={(e) => setLine2(e.target.value)} placeholder="Unit 4B" />
        </div>
        <div>
          <Label className="text-[12.5px]" style={{ color: 'var(--ink-muted)' }}>
            City
          </Label>
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Austin" />
        </div>
        <div>
          <Label className="text-[12.5px]" style={{ color: 'var(--ink-muted)' }}>
            State
          </Label>
          <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="TX" />
        </div>
        <div>
          <Label className="text-[12.5px]" style={{ color: 'var(--ink-muted)' }}>
            Postal code
          </Label>
          <Input value={postal} onChange={(e) => setPostal(e.target.value)} placeholder="78701" />
        </div>
      </div>

      {error && (
        <p className="text-[13px] mt-2" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 mt-3">
        <Button variant="ghost" onClick={onCancel} className="rounded-[3px]">
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={!canSave || saving}
          className="rounded-[3px]"
          style={{ background: 'var(--vault)', color: 'var(--vault-ink)' }}
        >
          {saving ? 'Saving…' : 'Save address'}
        </Button>
      </div>
    </div>
  )
}
