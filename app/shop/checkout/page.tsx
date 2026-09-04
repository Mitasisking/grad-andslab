'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useCart } from '@/lib/cart/cart-context'
import { fetchAddresses } from '@/lib/addresses-client'
import { AddAddressForm } from '@/components/submit/add-address-form'
import { StripePaymentForm } from '@/components/submit/stripe-payment-form'
import type { ShippingAddress } from '@/lib/submission-types'

const SHIPPING_FLAT_RATE = 6.5

export default function ShopCheckoutPage() {
  const { items, subtotal, clear } = useCart()
  const [addresses, setAddresses] = useState<ShippingAddress[]>([])
  const [addressId, setAddressId] = useState<string | null>(null)
  const [showAddAddress, setShowAddAddress] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [creatingOrder, setCreatingOrder] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [orderComplete, setOrderComplete] = useState(false)

  useEffect(() => {
    fetchAddresses().then((list) => {
      setAddresses(list)
      setAddressId((current) => current ?? list[0]?.id ?? null)
    })
  }, [])

  const total = subtotal + (items.length > 0 ? SHIPPING_FLAT_RATE : 0)

  async function beginCheckout() {
    if (!addressId || items.length === 0) return
    setCreatingOrder(true)
    setCheckoutError(null)

    // Step A: create the order. Only productId/quantity go over the wire —
    // price and title are looked up server-side by create_order() itself
    // (supabase/migrations/0009_stock_reservation.sql), never trusted from
    // the cart.
    const orderRes = await fetch('/api/shop/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        addressId,
        shippingCost: SHIPPING_FLAT_RATE,
        items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      }),
    })
    const orderData = await orderRes.json()
    if (!orderRes.ok) {
      setCreatingOrder(false)
      setCheckoutError(orderData.error ?? 'Could not create order')
      return
    }

    // Step B: create the PaymentIntent against that real order id — the
    // charge amount comes from orders.total server-side, not this request.
    const checkoutRes = await fetch('/api/shop/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: orderData.orderId }),
    })
    const checkoutData = await checkoutRes.json()
    setCreatingOrder(false)

    if (!checkoutRes.ok || !checkoutData.clientSecret) {
      setCheckoutError(checkoutData.error ?? 'Could not start payment')
      return
    }

    setClientSecret(checkoutData.clientSecret)
  }

  if (orderComplete) {
    return (
      <main className="max-w-xl mx-auto text-center py-16">
        <p className="text-[13px]" style={{ color: 'var(--seal)' }}>
          Order confirmed
        </p>
        <h1 className="text-[26px] mt-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
          Thanks — it&apos;s on its way to packing.
        </h1>
        <Link href="/shop" className="mt-6 inline-block text-[13.5px] underline underline-offset-2" style={{ color: 'var(--ink)' }}>
          Continue shopping
        </Link>
      </main>
    )
  }

  if (items.length === 0) {
    return (
      <main className="max-w-xl mx-auto text-center py-16">
        <p className="text-[15px]" style={{ color: 'var(--ink-muted)' }}>
          Your cart is empty.
        </p>
        <Link href="/shop" className="mt-4 inline-block text-[13.5px] underline underline-offset-2" style={{ color: 'var(--ink)' }}>
          Back to the shop
        </Link>
      </main>
    )
  }

  return (
    <main className="max-w-xl mx-auto">
      <h1 className="text-[26px]" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
        Checkout
      </h1>

      <div className="mt-8">
        <h2 className="text-[16px]" style={{ color: 'var(--ink)' }}>
          Items
        </h2>
        <div className="flex flex-col mt-3 border-t" style={{ borderColor: 'var(--line)' }}>
          {items.map((item) => (
            <div
              key={item.productId}
              className="flex justify-between py-2.5 border-b text-[14px]"
              style={{ borderColor: 'var(--line)' }}
            >
              <span style={{ color: 'var(--ink)' }}>
                {item.title} × {item.quantity}
              </span>
              <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>
                ${(item.price * item.quantity).toFixed(2)}
              </span>
            </div>
          ))}
          <div className="flex justify-between py-2.5 text-[14px]">
            <span style={{ color: 'var(--ink-muted)' }}>Shipping</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink-muted)' }}>
              ${SHIPPING_FLAT_RATE.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between py-2.5 border-t text-[15px]" style={{ borderColor: 'var(--line)' }}>
            <span style={{ color: 'var(--ink)' }}>Total</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>${total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-[16px]" style={{ color: 'var(--ink)' }}>
          Ship to
        </h2>
        {addresses.length > 0 && (
          <div className="flex flex-col mt-3 border-t" style={{ borderColor: 'var(--line)' }}>
            {addresses.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAddressId(a.id)}
                className="flex items-center justify-between py-3 border-b text-left gap-4"
                style={{ borderColor: 'var(--line)' }}
              >
                <span className="text-[14px]" style={{ color: 'var(--ink)' }}>
                  {a.name} — {a.line1}, {a.city} {a.state} {a.postal}
                </span>
                <span
                  className="w-3.5 h-3.5 rounded-full border shrink-0"
                  style={{
                    borderColor: addressId === a.id ? 'var(--seal)' : 'var(--line)',
                    background: addressId === a.id ? 'var(--seal)' : 'transparent',
                  }}
                />
              </button>
            ))}
          </div>
        )}
        {!showAddAddress ? (
          <button
            type="button"
            onClick={() => setShowAddAddress(true)}
            className="mt-3 text-[13.5px] underline underline-offset-2"
            style={{ color: 'var(--ink)' }}
          >
            + Add a new address
          </button>
        ) : (
          <AddAddressForm
            onCreated={(address) => {
              setAddresses((prev) => [...prev, address])
              setAddressId(address.id)
              setShowAddAddress(false)
            }}
            onCancel={() => setShowAddAddress(false)}
          />
        )}
      </div>

      {checkoutError && (
        <p className="text-[13px] mt-4" style={{ color: 'var(--danger)' }}>
          {checkoutError}
        </p>
      )}

      {!clientSecret ? (
        <button
          type="button"
          onClick={beginCheckout}
          disabled={!addressId || creatingOrder}
          className="mt-8 w-full px-4 py-3 text-[14px] rounded-[3px]"
          style={{ background: 'var(--vault)', color: 'var(--vault-ink)' }}
        >
          {creatingOrder ? 'Preparing order…' : `Pay $${total.toFixed(2)}`}
        </button>
      ) : (
        <div className="mt-8">
          <StripePaymentForm
            clientSecret={clientSecret}
            onSuccess={() => {
              clear()
              setOrderComplete(true)
            }}
          />
        </div>
      )}
    </main>
  )
}
