'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export interface CartItem {
  productId: string
  title: string
  price: number
  image: string | null
  quantity: number
  stock: number
}

interface CartProduct {
  id: string
  title: string
  price: number
  images: string[]
  stock: number
}

interface CartContextValue {
  items: CartItem[]
  subtotal: number
  addItem: (product: CartProduct, quantity?: number) => void
  removeItem: (productId: string) => void
  setQuantity: (productId: string, quantity: number) => void
  clear: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

const STORAGE_KEY = 'gradeandslab-shop-cart'

/**
 * Client cart state, persisted to localStorage (this is real app code, not
 * an in-chat artifact, so browser storage is the right and only sensible
 * tool). This is a UX convenience only — every price and stock figure here
 * gets re-verified server-side inside create_order()
 * (supabase/migrations/0009_stock_reservation.sql) when checkout actually
 * runs, so nothing here needs to be trusted.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [hydrated, setHydrated] = useState(false)

  // Hydrate from localStorage after mount only, so the server render and
  // the first client render match — the cart is necessarily empty on the
  // server no matter what's stored, since this is per-browser state.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setItems(JSON.parse(raw))
    } catch {
      // Corrupt or inaccessible storage — start with an empty cart.
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      // Storage full or blocked (e.g. private browsing) — the cart still
      // works for the rest of this page load, it just won't persist.
    }
  }, [items, hydrated])

  function addItem(product: CartProduct, quantity = 1) {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id)
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: Math.min(i.quantity + quantity, product.stock) } : i,
        )
      }
      return [
        ...prev,
        {
          productId: product.id,
          title: product.title,
          price: product.price,
          image: product.images[0] ?? null,
          quantity: Math.min(quantity, product.stock),
          stock: product.stock,
        },
      ]
    })
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((i) => i.productId !== productId))
  }

  function setQuantity(productId: string, quantity: number) {
    setItems((prev) =>
      prev
        .map((i) => (i.productId === productId ? { ...i, quantity: Math.max(1, Math.min(quantity, i.stock)) } : i))
        .filter((i) => i.quantity > 0),
    )
  }

  function clear() {
    setItems([])
  }

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  return (
    <CartContext.Provider value={{ items, subtotal, addItem, removeItem, setQuantity, clear }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within a CartProvider')
  return ctx
}
