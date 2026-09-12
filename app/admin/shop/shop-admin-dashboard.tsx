'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatByRegion } from '@/lib/currency'
import { ProductFormModal } from './product-form-modal'
import { ProductThumbnail } from './product-thumbnail'
import type { AdminProduct } from './types'
import type { ProductCategory, ProductFranchise } from '@/lib/admin/product-input'

const CATEGORY_LABEL: Record<string, string> = {
  sealed: 'Sealed',
  accessories: 'Accessories',
  graded: 'Graded',
  cards: 'Raw Cards',
}

const FRANCHISE_LABEL: Record<string, string> = {
  pokemon: 'Pokémon',
  sports: 'Sports',
  general: 'General',
}

const CATEGORY_FILTER_OPTIONS: { value: ProductCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All categories' },
  { value: 'sealed', label: 'Sealed' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'graded', label: 'Graded' },
  { value: 'cards', label: 'Raw Cards' },
]

const FRANCHISE_FILTER_OPTIONS: { value: ProductFranchise | 'all'; label: string }[] = [
  { value: 'all', label: 'All franchises' },
  { value: 'pokemon', label: 'Pokémon' },
  { value: 'sports', label: 'Sports' },
  { value: 'general', label: 'General' },
]

const selectClass = 'border rounded-[3px] px-3 py-2 text-[13.5px] bg-transparent'
const selectStyle = { borderColor: 'var(--line)', color: 'var(--ink)' }

const REGION_LABEL: Record<string, string> = {
  sa: 'SA',
  usa: 'USA',
  uk: 'UK',
}

export function ShopAdminDashboard() {
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalProduct, setModalProduct] = useState<AdminProduct | 'new' | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [franchiseFilter, setFranchiseFilter] = useState<ProductFranchise | 'all'>('all')
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory | 'all'>('all')

  const filteredProducts = products.filter(
    (p) =>
      (franchiseFilter === 'all' || p.franchise === franchiseFilter) &&
      (categoryFilter === 'all' || p.category === categoryFilter),
  )

  useEffect(() => {
    fetch('/api/admin/products')
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          setError(data.error ?? 'Could not load products.')
          return
        }
        setProducts(data.products)
      })
      .catch(() => setError('Could not load products.'))
      .finally(() => setLoading(false))
  }, [])

  async function handleDelete(product: AdminProduct) {
    if (!window.confirm(`Delete "${product.title}"? This can't be undone.`)) return

    setDeletingId(product.id)
    const res = await fetch(`/api/admin/products/${product.id}`, { method: 'DELETE' })
    setDeletingId(null)

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Could not delete product.')
      return
    }
    setProducts((prev) => prev.filter((p) => p.id !== product.id))
  }

  function handleSaved(saved: AdminProduct) {
    setProducts((prev) => {
      const exists = prev.some((p) => p.id === saved.id)
      return exists ? prev.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...prev]
    })
    setModalProduct(null)
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px]" style={{ color: 'var(--ink-muted)' }}>
            Admin
          </p>
          <h1 className="text-[28px] mt-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
            Shop inventory
          </h1>
        </div>
        <div className="flex flex-wrap gap-3 shrink-0">
          <Link
            href="/admin/trends"
            className="px-4 py-2 text-[13.5px] rounded-[3px] border"
            style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
          >
            Market Trends
          </Link>
          <Link
            href="/admin/shop/bulk-ace-import"
            className="px-4 py-2 text-[13.5px] rounded-[3px] border"
            style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
          >
            Bulk ACE Import
          </Link>
          <Link
            href="/admin/shop/bulk-pcg-import"
            className="px-4 py-2 text-[13.5px] rounded-[3px] border"
            style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
          >
            Bulk PCG Import
          </Link>
          <button
            type="button"
            onClick={() => setModalProduct('new')}
            className="px-4 py-2 text-[13.5px] rounded-[3px]"
            style={{ background: 'var(--vault)', color: 'var(--vault-ink)' }}
          >
            + New Product
          </button>
        </div>
      </div>

      {error && (
        <p className="text-[13px] mt-4" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3 mt-6">
        <select
          value={franchiseFilter}
          onChange={(e) => setFranchiseFilter(e.target.value as ProductFranchise | 'all')}
          className={selectClass}
          style={selectStyle}
        >
          {FRANCHISE_FILTER_OPTIONS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as ProductCategory | 'all')}
          className={selectClass}
          style={selectStyle}
        >
          {CATEGORY_FILTER_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-8">
        {loading ? (
          <p className="text-[13.5px]" style={{ color: 'var(--ink-muted)' }}>
            Loading…
          </p>
        ) : products.length === 0 ? (
          <p className="text-[13.5px]" style={{ color: 'var(--ink-muted)' }}>
            No products yet.
          </p>
        ) : filteredProducts.length === 0 ? (
          <p className="text-[13.5px]" style={{ color: 'var(--ink-muted)' }}>
            No products match these filters.
          </p>
        ) : (
          <div className="border-t" style={{ borderColor: 'var(--line)' }}>
            {/* Header row */}
            <div
              className="hidden sm:grid gap-4 py-2 text-[11.5px] uppercase tracking-wide border-b items-center"
              style={{ gridTemplateColumns: 'auto 2fr 1fr 1fr 1fr auto', borderColor: 'var(--line)', color: 'var(--ink-muted)' }}
            >
              <span>Image</span>
              <span>Product</span>
              <span>Category</span>
              <span>Price</span>
              <span>Stock</span>
              <span></span>
            </div>

            {filteredProducts.map((product) => {
              const outOfStock = product.stock <= 0
              return (
                <div
                  key={product.id}
                  className="grid sm:grid-cols-[auto_2fr_1fr_1fr_1fr_auto] gap-2 sm:gap-4 py-3 border-b items-center"
                  style={{ borderColor: 'var(--line)' }}
                >
                  <ProductThumbnail src={product.images?.[0]} alt={product.title} />
                  <div>
                    <p className="text-[14px]" style={{ color: 'var(--ink)' }}>
                      {product.title}
                    </p>
                    {!product.is_active && (
                      <span className="text-[11px]" style={{ color: 'var(--danger)' }}>
                        Hidden from shop
                      </span>
                    )}
                  </div>
                  <span className="text-[13px]" style={{ color: 'var(--ink-muted)' }}>
                    {CATEGORY_LABEL[product.category] ?? product.category}
                    <span
                      className="ml-1.5 text-[10.5px] px-1.5 py-0.5 rounded-[3px]"
                      style={{ background: 'var(--paper-raised)', color: 'var(--ink-muted)' }}
                    >
                      {FRANCHISE_LABEL[product.franchise] ?? product.franchise}
                    </span>
                    <span
                      className="ml-1.5 text-[10.5px] px-1.5 py-0.5 rounded-[3px]"
                      style={{ background: 'var(--paper-raised)', color: 'var(--ink-muted)' }}
                    >
                      {REGION_LABEL[product.region] ?? product.region}
                    </span>
                  </span>
                  <span className="text-[13.5px]" style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>
                    {formatByRegion(product.price, product.region)}
                  </span>
                  <span>
                    <span
                      className="inline-flex items-center gap-1.5 text-[12.5px]"
                      style={{ color: outOfStock ? 'var(--danger)' : 'var(--ink)' }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full inline-block"
                        style={{ background: outOfStock ? 'var(--danger)' : 'var(--seal)' }}
                      />
                      {outOfStock ? 'Out of stock' : `In stock (${product.stock})`}
                    </span>
                  </span>
                  <div className="flex gap-3 justify-end shrink-0">
                    <button
                      type="button"
                      onClick={() => setModalProduct(product)}
                      className="text-[12.5px] underline underline-offset-2"
                      style={{ color: 'var(--ink)' }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(product)}
                      disabled={deletingId === product.id}
                      className="text-[12.5px] underline underline-offset-2 disabled:opacity-50"
                      style={{ color: 'var(--danger)' }}
                    >
                      {deletingId === product.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {modalProduct && (
        <ProductFormModal
          product={modalProduct === 'new' ? null : modalProduct}
          onClose={() => setModalProduct(null)}
          onSaved={handleSaved}
        />
      )}
    </main>
  )
}
