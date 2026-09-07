'use client'

import { useEffect, useState } from 'react'
import { formatZAR } from '@/lib/currency'
import { ProductFormModal } from './product-form-modal'
import type { AdminProduct } from './types'

const CATEGORY_LABEL: Record<string, string> = {
  sealed: 'Sealed',
  accessories: 'Accessories',
  graded: 'Graded',
  cards: 'Raw Cards',
}

export function ShopAdminDashboard() {
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalProduct, setModalProduct] = useState<AdminProduct | 'new' | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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
        <button
          type="button"
          onClick={() => setModalProduct('new')}
          className="px-4 py-2 text-[13.5px] rounded-[3px] shrink-0"
          style={{ background: 'var(--vault)', color: 'var(--vault-ink)' }}
        >
          + New Product
        </button>
      </div>

      {error && (
        <p className="text-[13px] mt-4" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      <div className="mt-8">
        {loading ? (
          <p className="text-[13.5px]" style={{ color: 'var(--ink-muted)' }}>
            Loading…
          </p>
        ) : products.length === 0 ? (
          <p className="text-[13.5px]" style={{ color: 'var(--ink-muted)' }}>
            No products yet.
          </p>
        ) : (
          <div className="border-t" style={{ borderColor: 'var(--line)' }}>
            {/* Header row */}
            <div
              className="hidden sm:grid gap-4 py-2 text-[11.5px] uppercase tracking-wide border-b"
              style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr auto', borderColor: 'var(--line)', color: 'var(--ink-muted)' }}
            >
              <span>Product</span>
              <span>Category</span>
              <span>Price</span>
              <span>Stock</span>
              <span></span>
            </div>

            {products.map((product) => {
              const outOfStock = product.stock <= 0
              return (
                <div
                  key={product.id}
                  className="grid sm:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 sm:gap-4 py-3 border-b items-center"
                  style={{ borderColor: 'var(--line)' }}
                >
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
                  </span>
                  <span className="text-[13.5px]" style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>
                    {formatZAR(product.price)}
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
