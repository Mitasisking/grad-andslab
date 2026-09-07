'use client'

import { useState } from 'react'
import { SPORT_OPTIONS } from '@/lib/submission-types'
import type { CardType, Sport } from '@/lib/submission-types'
import { CARD_VARIANT_OPTIONS } from '@/lib/shop/product-type'
import type { CardVariant } from '@/lib/shop/product-type'
import type { ProductCategory } from '@/lib/admin/product-input'
import type { AdminProduct } from './types'

const CATEGORY_OPTIONS: { value: ProductCategory; label: string }[] = [
  { value: 'sealed', label: 'Sealed' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'graded', label: 'Graded' },
  { value: 'cards', label: 'Raw Cards' },
]

interface Draft {
  title: string
  description: string
  category: ProductCategory
  price: string
  stock: string
  imageUrl: string
  isActive: boolean
  cardType: CardType
  setName: string
  cardNumber: string
  sport: Sport | ''
  brand: string
  cardVariant: CardVariant | ''
  playerName: string
}

function draftFromProduct(product: AdminProduct | null): Draft {
  return {
    title: product?.title ?? '',
    description: product?.description ?? '',
    category: product?.category ?? 'sealed',
    price: product ? String(product.price) : '',
    stock: product ? String(product.stock) : '0',
    imageUrl: product?.images?.[0] ?? '',
    isActive: product?.is_active ?? true,
    cardType: product?.card_type ?? 'pokemon',
    setName: product?.set_name ?? '',
    cardNumber: product?.card_number ?? '',
    sport: product?.sport ?? '',
    brand: product?.brand ?? '',
    cardVariant: product?.card_variant ?? '',
    playerName: product?.player_name ?? '',
  }
}

const inputClass = 'w-full border rounded-[3px] px-3 py-2 text-[14px] bg-transparent'
const inputStyle = { borderColor: 'var(--line)', color: 'var(--ink)' }
const labelClass = 'text-[12.5px] block mb-1'
const labelStyle = { color: 'var(--ink-muted)' }

interface Props {
  product: AdminProduct | null
  onClose: () => void
  onSaved: (product: AdminProduct) => void
}

export function ProductFormModal({ product, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<Draft>(() => draftFromProduct(product))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  function selectCardType(cardType: CardType) {
    // Sport only applies to sports cards -- clear it so switching types
    // can't leave a stale sport on what's about to be saved as Pokemon.
    setDraft((prev) => ({ ...prev, cardType, sport: cardType === 'sports_card' ? prev.sport : '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const price = Number(draft.price)
    const stock = Number(draft.stock)

    const body = {
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      category: draft.category,
      price,
      stock,
      images: draft.imageUrl.trim() ? [draft.imageUrl.trim()] : [],
      isActive: draft.isActive,
      cardType: draft.cardType,
      setName: draft.setName.trim() || null,
      cardNumber: draft.cardNumber.trim() || null,
      sport: draft.cardType === 'sports_card' ? draft.sport || null : null,
      brand: draft.brand.trim() || null,
      cardVariant: draft.cardVariant || null,
      playerName: draft.playerName.trim() || null,
    }

    const res = await fetch(product ? `/api/admin/products/${product.id}` : '/api/admin/products', {
      method: product ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setSaving(false)

    if (!res.ok) {
      setError(data.error ?? 'Could not save product.')
      return
    }
    onSaved(data.product)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-[3px] p-6 my-8"
        style={{ background: 'var(--paper)', border: '1px solid var(--line)' }}
      >
        <h2 className="text-[20px]" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
          {product ? 'Edit product' : 'New product'}
        </h2>

        <div className="mt-5 space-y-4">
          <div>
            <label className={labelClass} style={labelStyle}>
              Name
            </label>
            <input
              required
              type="text"
              value={draft.title}
              onChange={(e) => update('title', e.target.value)}
              className={inputClass}
              style={inputStyle}
              placeholder="2023 Topps Chrome LeBron James #111"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} style={labelStyle}>
                Category
              </label>
              <select
                value={draft.category}
                onChange={(e) => update('category', e.target.value as ProductCategory)}
                className={inputClass}
                style={inputStyle}
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>
                Price (ZAR)
              </label>
              <input
                required
                type="number"
                min={0}
                step="0.01"
                value={draft.price}
                onChange={(e) => update('price', e.target.value)}
                className={inputClass}
                style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }}
                placeholder="250.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} style={labelStyle}>
                Stock
              </label>
              <input
                required
                type="number"
                min={0}
                step="1"
                value={draft.stock}
                onChange={(e) => update('stock', e.target.value)}
                className={inputClass}
                style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }}
              />
            </div>
            <div className="flex items-end pb-2.5">
              <label className="flex items-center gap-2 text-[13.5px]" style={{ color: 'var(--ink)' }}>
                <input
                  type="checkbox"
                  checked={draft.isActive}
                  onChange={(e) => update('isActive', e.target.checked)}
                />
                Visible in shop
              </label>
            </div>
          </div>

          <div>
            <label className={labelClass} style={labelStyle}>
              Image URL
            </label>
            <input
              type="text"
              value={draft.imageUrl}
              onChange={(e) => update('imageUrl', e.target.value)}
              className={inputClass}
              style={inputStyle}
              placeholder="https://…"
            />
          </div>

          <div>
            <label className={labelClass} style={labelStyle}>
              Description
            </label>
            <textarea
              rows={2}
              value={draft.description}
              onChange={(e) => update('description', e.target.value)}
              className={inputClass}
              style={inputStyle}
            />
          </div>

          <div className="pt-2 border-t" style={{ borderColor: 'var(--line)' }}>
            <label className={labelClass} style={labelStyle}>
              Card type
            </label>
            <div className="flex gap-2">
              {(['pokemon', 'sports_card'] as CardType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => selectCardType(type)}
                  className="px-3 py-1.5 text-[12.5px] rounded-[3px] border"
                  style={{
                    borderColor: draft.cardType === type ? 'var(--seal)' : 'var(--line)',
                    background: draft.cardType === type ? 'var(--seal)' : 'transparent',
                    color: draft.cardType === type ? 'var(--seal-ink)' : 'var(--ink-muted)',
                  }}
                >
                  {type === 'pokemon' ? 'Pokémon' : 'Sports Card'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} style={labelStyle}>
                Set {draft.cardType === 'sports_card' ? '/ Brand set (e.g. Topps Chrome)' : ''}
              </label>
              <input
                type="text"
                value={draft.setName}
                onChange={(e) => update('setName', e.target.value)}
                className={inputClass}
                style={inputStyle}
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>
                Card number
              </label>
              <input
                type="text"
                value={draft.cardNumber}
                onChange={(e) => update('cardNumber', e.target.value)}
                className={inputClass}
                style={inputStyle}
              />
            </div>
          </div>

          {draft.cardType === 'sports_card' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass} style={labelStyle}>
                    Sport
                  </label>
                  <select
                    required
                    value={draft.sport}
                    onChange={(e) => update('sport', e.target.value as Sport)}
                    className={inputClass}
                    style={inputStyle}
                  >
                    <option value="" disabled>
                      Choose a sport…
                    </option>
                    {SPORT_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass} style={labelStyle}>
                    Card type / variant
                  </label>
                  <select
                    value={draft.cardVariant}
                    onChange={(e) => update('cardVariant', e.target.value as CardVariant)}
                    className={inputClass}
                    style={inputStyle}
                  >
                    <option value="">—</option>
                    {CARD_VARIANT_OPTIONS.map((v) => (
                      <option key={v.value} value={v.value}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass} style={labelStyle}>
                    Brand
                  </label>
                  <input
                    type="text"
                    value={draft.brand}
                    onChange={(e) => update('brand', e.target.value)}
                    className={inputClass}
                    style={inputStyle}
                    placeholder="Topps"
                  />
                </div>
                <div>
                  <label className={labelClass} style={labelStyle}>
                    Player name
                  </label>
                  <input
                    type="text"
                    value={draft.playerName}
                    onChange={(e) => update('playerName', e.target.value)}
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="text-[13px] mt-4" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-6">
          <button type="button" onClick={onClose} className="text-[13.5px] underline underline-offset-2" style={{ color: 'var(--ink-muted)' }}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-[13.5px] rounded-[3px] disabled:opacity-50"
            style={{ background: 'var(--vault)', color: 'var(--vault-ink)' }}
          >
            {saving ? 'Saving…' : product ? 'Save changes' : 'Create product'}
          </button>
        </div>
      </form>
    </div>
  )
}
