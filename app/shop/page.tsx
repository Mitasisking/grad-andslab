'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

interface ShopItem {
  id: string
  title: string
  description: string
  price: number
  currency: string
  image_url: string
  category: string
  stock_count: number
}

interface CartItem extends ShopItem {
  quantity: number
}

export default function ShopPage() {
  const [items, setItems] = useState<ShopItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('All')
  
  // Cart State
  const [cart, setCart] = useState<CartItem[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  
  const router = useRouter()

  useEffect(() => {
    async function fetchInventory() {
      const { data, error } = await supabase
        .from('shop_items')
        .select('*')
        .gt('stock_count', 0)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setItems(data)
      }
      setLoading(false)
    }
    fetchInventory()
  }, [])

  const addToCart = (item: ShopItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id)
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, { ...item, quantity: 1 }]
    })
    setIsCartOpen(true) 
  }

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(i => i.id !== id))
  }

  const handleStripeCheckout = async () => {
    setIsCheckingOut(true)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cartItems: cart }),
      })
      const data = await res.json()
      
      if (data.url) {
        router.push(data.url)
      }
    } catch (err) {
      console.error("Checkout error", err)
    }
    setIsCheckingOut(false)
  }

  // Convert USD / JPY into South African Rands (R) for local display
  const convertToRands = (price: number, currency: string = 'USD') => {
    let randAmount = price
    if (currency === 'USD') {
      randAmount = price * 18.5 // Estimated USD to ZAR rate
    } else if (currency === 'JPY') {
      randAmount = price * 0.12 // Estimated JPY to ZAR rate
    }
    return `R ${randAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const categories = ['All', 'In Print', 'Out of Print', 'Slabs', 'Accessories']
  const filteredItems = activeCategory === 'All' ? items : items.filter(item => item.category === activeCategory)
  
  // Calculate total in ZAR
  const cartTotalZAR = cart.reduce((sum, item) => {
    let multiplier = 1
    if (item.currency === 'USD') multiplier = 18.5
    if (item.currency === 'JPY') multiplier = 0.12
    return sum + (item.price * multiplier * item.quantity)
  }, 0)

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <p>Loading Inventory...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8 pb-24 relative overflow-hidden">
      
      {/* Floating Cart Button */}
      {cartItemCount > 0 && (
        <button 
          onClick={() => setIsCartOpen(true)}
          className="fixed bottom-8 right-8 z-40 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black p-4 rounded-full shadow-[0_0_20px_rgba(245,158,11,0.3)] transition transform hover:scale-105 flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span className="bg-slate-950 text-white text-xs px-2 py-1 rounded-full">{cartItemCount}</span>
        </button>
      )}

      {/* Slide-out Cart Panel */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border-l border-slate-700 h-full shadow-2xl flex flex-col animate-slide-in-right">
            
            <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800">
              <h2 className="text-xl font-bold text-amber-500 flex items-center gap-2">
                Your Cart
              </h2>
              <button onClick={() => setIsCartOpen(false)} className="text-slate-400 hover:text-white transition">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {cart.length === 0 ? (
                <p className="text-slate-400 text-center mt-10">Your cart is empty.</p>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex gap-4 bg-slate-800 border border-slate-700 p-3 rounded-xl">
                    <img src={item.image_url} alt={item.title} className="w-16 h-16 object-contain bg-slate-900 rounded" />
                    <div className="flex-1">
                      <h4 className="font-bold text-sm text-slate-200 line-clamp-1">{item.title}</h4>
                      <p className="text-xs text-slate-400">Qty: {item.quantity}</p>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-sm font-bold text-emerald-400">
                          {convertToRands(item.price * item.quantity, item.currency)}
                        </span>
                        <button onClick={() => removeFromCart(item.id)} className="text-[10px] text-red-400 hover:underline">Remove</button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-6 border-t border-slate-700 bg-slate-800">
              <div className="flex justify-between text-slate-300 mb-2">
                <span>Total (ZAR)</span>
                <span className="font-bold text-lg text-amber-400">
                  R {cartTotalZAR.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-sm text-slate-400 mb-6 border-t border-slate-700 pt-2">
                <span>Shipping & Taxes</span>
                <span>Calculated at checkout</span>
              </div>
              <button 
                onClick={handleStripeCheckout}
                disabled={cart.length === 0 || isCheckingOut}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex justify-center items-center gap-2"
              >
                {isCheckingOut ? 'Securing Session...' : 'Checkout Securely'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shop Header */}
      <div className="max-w-6xl mx-auto border-b border-slate-700 pb-8 mt-4">
        <h1 className="text-4xl font-black text-amber-500 tracking-tight">The Slab Shop</h1>
        <p className="mt-2 text-slate-400 text-lg">
          Premium graded cards and sealed product, shipped securely across South Africa.
        </p>
      </div>

      {/* Category Filters */}
      <div className="max-w-6xl mx-auto py-6 flex gap-3 overflow-x-auto hide-scrollbar">
        {categories.map(category => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`px-5 py-2 rounded-full text-sm font-medium transition whitespace-nowrap ${
              activeCategory === category 
                ? 'bg-amber-500 text-slate-950' 
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Product Grid */}
      <div className="max-w-6xl mx-auto mt-6">
        {filteredItems.length === 0 ? (
          <div className="text-center py-20 bg-slate-800/50 rounded-xl border border-slate-700">
            <p className="text-slate-400">No products found in this category right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredItems.map(item => (
              <div key={item.id} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden hover:border-amber-500/50 transition duration-300 flex flex-col group">
                
                {/* Image Container */}
                <div className="h-48 bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
                  {item.image_url ? (
                    <img 
                      src={item.image_url} 
                      alt={item.title} 
                      className="max-h-full max-w-full object-contain group-hover:scale-110 transition duration-500" 
                    />
                  ) : (
                    <span className="text-slate-600 text-sm">No Image</span>
                  )}
                  {item.stock_count < 3 && (
                    <div className="absolute top-2 right-2 bg-red-500/90 text-white text-[10px] font-bold px-2 py-1 rounded">
                      Only {item.stock_count} left!
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="p-5 flex flex-col flex-grow">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <h3 className="font-bold text-slate-100 leading-tight">{item.title}</h3>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2 mb-4 flex-grow">
                    {item.description}
                  </p>
                  
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-700/50">
                    <span className="text-lg font-black text-amber-400">
                      {convertToRands(item.price, item.currency)}
                    </span>
                    <button 
                      onClick={() => addToCart(item)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 px-4 rounded transition"
                    >
                      Add to Cart
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}