'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useCart } from '@/lib/cart/cart-context'

/** Slide-over drawer with quantity controls, per app/auctions/README.md's Phase 4 file map. */
export function CartButton() {
  const { items, subtotal, removeItem, setQuantity } = useCart()
  const [open, setOpen] = useState(false)
  const count = items.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[13.5px] underline underline-offset-2"
        style={{ color: 'var(--ink)' }}
      >
        Cart{count > 0 ? ` (${count})` : ''}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          style={{ background: 'rgba(0,0,0,0.35)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm h-full p-6 flex flex-col"
            style={{ background: 'var(--paper-raised)', borderLeft: '1px solid var(--line)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[18px]" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
                Your cart
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[13px] underline underline-offset-2"
                style={{ color: 'var(--ink-muted)' }}
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto mt-6 space-y-4">
              {items.length === 0 ? (
                <p className="text-[13.5px]" style={{ color: 'var(--ink-muted)' }}>
                  Your cart is empty.
                </p>
              ) : (
                items.map((item) => (
                  <div key={item.productId} className="flex gap-3 pb-4 border-b" style={{ borderColor: 'var(--line)' }}>
                    <div className="w-16 h-16 shrink-0" style={{ background: 'var(--paper-raised)' }}>
                      {item.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] truncate" style={{ color: 'var(--ink)' }}>
                        {item.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <select
                          value={item.quantity}
                          onChange={(e) => setQuantity(item.productId, Number(e.target.value))}
                          className="border rounded-[3px] text-[12.5px] px-1.5 py-0.5 bg-transparent"
                          style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
                        >
                          {Array.from({ length: Math.max(item.stock, item.quantity) }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeItem(item.productId)}
                          className="text-[12px] underline underline-offset-2"
                          style={{ color: 'var(--ink-muted)' }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <span
                      className="text-[13.5px] shrink-0"
                      style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}
                    >
                      ${(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))
              )}
            </div>

            {items.length > 0 && (
              <div className="pt-4 border-t" style={{ borderColor: 'var(--line)' }}>
                <div className="flex justify-between text-[14.5px]" style={{ color: 'var(--ink)' }}>
                  <span>Subtotal</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>${subtotal.toFixed(2)}</span>
                </div>
                <Link
                  href="/shop/checkout"
                  onClick={() => setOpen(false)}
                  className="mt-4 block text-center px-4 py-2.5 text-[14px] rounded-[3px]"
                  style={{ background: 'var(--vault)', color: 'var(--vault-ink)' }}
                >
                  Checkout
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
