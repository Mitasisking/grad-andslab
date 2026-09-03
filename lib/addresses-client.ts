import type { ShippingAddress } from './submission-types'

interface AddressRow {
  id: string
  label: string
  full_name: string
  line1: string
  line2: string | null
  city: string
  state: string
  postal: string
  country: string
  is_default: boolean
}

function toShippingAddress(row: AddressRow): ShippingAddress {
  return {
    id: row.id,
    label: row.label,
    name: row.full_name,
    line1: row.line1,
    line2: row.line2 ?? undefined,
    city: row.city,
    state: row.state,
    postal: row.postal,
    country: row.country,
  }
}

export async function fetchAddresses(): Promise<ShippingAddress[]> {
  const res = await fetch('/api/addresses', { method: 'GET' })
  if (!res.ok) return []
  const data = await res.json()
  return (data.addresses as AddressRow[]).map(toShippingAddress)
}

export interface NewAddressInput {
  label?: string
  fullName: string
  line1: string
  line2?: string
  city: string
  state: string
  postal: string
  country?: string
  isDefault?: boolean
}

export async function createAddress(input: NewAddressInput): Promise<ShippingAddress | null> {
  const res = await fetch('/api/addresses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) return null
  const data = await res.json()
  return toShippingAddress(data.address as AddressRow)
}
