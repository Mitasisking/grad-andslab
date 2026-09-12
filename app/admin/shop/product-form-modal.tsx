'use client'

import { useRef, useState } from 'react'
import { SPORT_OPTIONS } from '@/lib/submission-types'
import type { CardType, Sport } from '@/lib/submission-types'
import { CARD_VARIANT_OPTIONS, REGION_OPTIONS } from '@/lib/shop/product-type'
import type { CardVariant, ProductRegion } from '@/lib/shop/product-type'
import type { ProductCategory, ProductFranchise } from '@/lib/admin/product-input'
import { uploadProductImage } from '@/lib/admin/product-image-upload'
import { formatByRegion } from '@/lib/currency'
import { ProductThumbnail } from './product-thumbnail'
import type { AdminProduct } from './types'

const CATEGORY_OPTIONS: { value: ProductCategory; label: string }[] = [
  { value: 'sealed', label: 'Sealed' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'graded', label: 'Graded' },
  { value: 'cards', label: 'Raw Cards' },
]

const FRANCHISE_OPTIONS: { value: ProductFranchise; label: string }[] = [
  { value: 'pokemon', label: 'Pokémon' },
  { value: 'sports', label: 'Sports' },
  { value: 'general', label: 'General' },
]

const REGION_CURRENCY_LABEL: Record<ProductRegion, string> = {
  sa: 'ZAR',
  usa: 'USD',
  uk: 'GBP',
}

interface Draft {
  title: string
  description: string
  category: ProductCategory
  franchise: ProductFranchise
  price: string
  costBasis: string
  stock: string
  imageUrl: string
  isActive: boolean
  isAuction: boolean
  releaseDate: string
  isPokemonCenter: boolean
  cardType: CardType
  setName: string
  cardNumber: string
  sport: Sport | ''
  brand: string
  cardVariant: CardVariant | ''
  playerName: string
  region: ProductRegion
}

function draftFromProduct(product: AdminProduct | null): Draft {
  return {
    title: product?.title ?? '',
    description: product?.description ?? '',
    category: product?.category ?? 'sealed',
    franchise: product?.franchise ?? 'general',
    price: product ? String(product.price) : '',
    costBasis: product?.cost_basis != null ? String(product.cost_basis) : '',
    stock: product ? String(product.stock) : '0',
    imageUrl: product?.images?.[0] ?? '',
    isActive: product?.is_active ?? true,
    isAuction: product?.is_auction ?? false,
    releaseDate: product?.release_date ?? '',
    isPokemonCenter: product?.is_pokemon_center ?? false,
    cardType: product?.card_type ?? 'pokemon',
    setName: product?.set_name ?? '',
    cardNumber: product?.card_number ?? '',
    sport: product?.sport ?? '',
    brand: product?.brand ?? '',
    cardVariant: product?.card_variant ?? '',
    playerName: product?.player_name ?? '',
    region: product?.region ?? 'sa',
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
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (!file) return

    setUploading(true)
    setUploadError(null)
    try {
      const url = await uploadProductImage(file)
      update('imageUrl', url)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Could not upload image.')
    } finally {
      setUploading(false)
    }
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
      franchise: draft.franchise,
      price,
      costBasis: draft.costBasis.trim() ? Number(draft.costBasis) : null,
      stock,
      images: draft.imageUrl.trim() ? [draft.imageUrl.trim()] : [],
      isActive: draft.isActive,
      isAuction: draft.isAuction,
      releaseDate: draft.releaseDate.trim() || null,
      isPokemonCenter: draft.isPokemonCenter,
      cardType: draft.cardType,
      setName: draft.setName.trim() || null,
      cardNumber: draft.cardNumber.trim() || null,
      sport: draft.cardType === 'sports_card' ? draft.sport || null : null,
      brand: draft.brand.trim() || null,
      cardVariant: draft.cardVariant || null,
      playerName: draft.playerName.trim() || null,
      region: draft.region,
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

          <div className="grid grid-cols-3 gap-3">
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
                Franchise
              </label>
              <select
                value={draft.franchise}
                onChange={(e) => update('franchise', e.target.value as ProductFranchise)}
                className={inputClass}
                style={inputStyle}
              >
                {FRANCHISE_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>
                Region
              </label>
              <select
                value={draft.region}
                onChange={(e) => update('region', e.target.value as ProductRegion)}
                className={inputClass}
                style={inputStyle}
              >
                {REGION_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} style={labelStyle}>
                Price ({REGION_CURRENCY_LABEL[draft.region]})
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
              {draft.price && !Number.isNaN(Number(draft.price)) && (
                <p className="text-[11.5px] mt-1" style={{ color: 'var(--ink-muted)' }}>
                  Shown to customers as {formatByRegion(Number(draft.price), draft.region)}
                </p>
              )}
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>
                Cost Price (ZAR)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={draft.costBasis}
                onChange={(e) => update('costBasis', e.target.value)}
                className={inputClass}
                style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }}
                placeholder="150.00"
              />
              <p className="text-[11.5px] mt-1" style={{ color: 'var(--ink-muted)' }}>
                Internal only -- used for margin reporting, never shown to customers.
              </p>
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
            <div>
              <label className={labelClass} style={labelStyle}>
                Release date
              </label>
              <input
                type="date"
                value={draft.releaseDate}
                onChange={(e) => update('releaseDate', e.target.value)}
                className={inputClass}
                style={inputStyle}
              />
              <p className="text-[11.5px] mt-1" style={{ color: 'var(--ink-muted)' }}>
                Drives the Sealed category&apos;s 3-year time-gate below.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <label className="flex items-center gap-2 text-[13.5px]" style={{ color: 'var(--ink)' }}>
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(e) => update('isActive', e.target.checked)}
              />
              Visible in shop
            </label>
            <label className="flex items-center gap-2 text-[13.5px]" style={{ color: 'var(--ink)' }}>
              <input
                type="checkbox"
                checked={draft.isAuction}
                onChange={(e) => update('isAuction', e.target.checked)}
              />
              Send to Auction
            </label>
            <label className="flex items-center gap-2 text-[13.5px]" style={{ color: 'var(--ink)' }}>
              <input
                type="checkbox"
                checked={draft.isPokemonCenter}
                onChange={(e) => update('isPokemonCenter', e.target.checked)}
              />
              Pokémon Center exclusive
            </label>
          </div>
          {draft.isAuction && (
            <p className="text-[11.5px] -mt-2" style={{ color: 'var(--ink-muted)' }}>
              Shows on the Live Auctions &quot;Coming Soon&quot; grid instead of the regular shop, regardless of the setting
              above.
            </p>
          )}
          {draft.isPokemonCenter && (
            <p className="text-[11.5px] -mt-2" style={{ color: 'var(--ink-muted)' }}>
              Shows under the Shop&apos;s &quot;Pokémon Center&quot; category pill regardless of category or release
              date, and skips the Sealed category&apos;s 3-year time-gate.
            </p>
          )}

          <div>
            <label className={labelClass} style={labelStyle}>
              Image URL
            </label>
            <div className="flex items-start gap-3">
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  value={draft.imageUrl}
                  onChange={(e) => update('imageUrl', e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                  placeholder="https://…"
                />
                <label className="text-[12.5px] underline underline-offset-2 cursor-pointer inline-block" style={{ color: 'var(--ink-muted)' }}>
                  {uploading ? 'Uploading…' : 'Upload a file'}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileSelected}
                    disabled={uploading}
                  />
                </label>
                {uploadError && (
                  <p className="text-[12px]" style={{ color: 'var(--danger)' }}>
                    {uploadError}
                  </p>
                )}
              </div>
              <ProductThumbnail src={draft.imageUrl || undefined} alt="Preview" size={72} />
            </div>
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
