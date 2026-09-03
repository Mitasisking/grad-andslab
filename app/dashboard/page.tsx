'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { calculateDHLShipping } from '../../lib/shipping'

const TIER_CONFIG: Record<string, { base: number; markup: number; turnaround: string }> = {
  'Bulk 50+': { base: 14.95, markup: 5.00, turnaround: '40-60 Days' },
  'Standard': { base: 19.95, markup: 5.00, turnaround: '20-30 Days' },
  'Express': { base: 49.95, markup: 10.00, turnaround: '7-10 Days' },
}

interface Submission {
  id: string
  card_name: string
  card_number?: string
  set_name: string
  declared_value: number
  service_tier?: string
  status: string
  created_at: string
}

interface Order {
  id: string
  order_number: string
  total_cards: number
  total_declared_value: number
  total_base_cost: number
  total_markup: number
  grand_total: number
  status: string
  created_at: string
  submissions: Submission[]
}

interface TCGdexCard {
  id: string
  localId: string
  name: string
  image?: string
  lang?: 'en' | 'ja' | 'ja-translated'
}

interface UserProfile {
  full_name: string
  phone: string
  street_address: string
  city: string
  postal_code: string
  country: string
}

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  
  // Profile & Google Maps state
  const [profile, setProfile] = useState<UserProfile>({
    full_name: '', phone: '', street_address: '', city: '', postal_code: '', country: ''
  })
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')
  const addressInputRef = useRef<HTMLInputElement>(null)
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<TCGdexCard[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedCardImage, setSelectedCardImage] = useState<string | null>(null)

  // Form inputs
  const [cardName, setCardName] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [setName, setSetName] = useState('')
  const [declaredValue, setDeclaredValue] = useState('')
  const [serviceTier, setServiceTier] = useState('Standard')
  const [submitting, setSubmitting] = useState(false)
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [message, setMessage] = useState('')
  
  // UI State
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
  const [isManualMode, setIsManualMode] = useState(false)

  const router = useRouter()

  useEffect(() => {
    async function loadDashboardData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)
      await Promise.all([
        fetchSubmissions(user.id),
        fetchOrders(user.id),
        fetchProfile(user.id)
      ])
      setLoading(false)
    }
    loadDashboardData()
  }, [router])

  // Inject Google Maps Places API for Address Autocomplete
  useEffect(() => {
    const GOOGLE_API_KEY = 'AIzaSyCwk4HUaRQYTHlqP9A2q6loI1tlSsGguzs'
    
    const initAutocomplete = () => {
      if (addressInputRef.current && window.google) {
        const autocomplete = new window.google.maps.places.Autocomplete(addressInputRef.current, {
          fields: ['address_components', 'formatted_address'],
        })

        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace()
          if (!place.address_components) return

          let street = ''
          let city = ''
          let postalCode = ''
          let country = ''

          for (const component of place.address_components) {
            const types = component.types
            if (types.includes('street_number')) street += component.long_name + ' '
            if (types.includes('route')) street += component.long_name
            if (types.includes('locality') || types.includes('postal_town')) city = component.long_name
            if (types.includes('postal_code')) postalCode = component.long_name
            if (types.includes('country')) country = component.long_name
          }

          setProfile(prev => ({
            ...prev,
            street_address: street || place.formatted_address || '',
            city,
            postal_code: postalCode,
            country
          }))
        })
      }
    }

    if (document.getElementById('google-maps-script') || window.google) {
      initAutocomplete()
      return
    }

    const script = document.createElement('script')
    script.id = 'google-maps-script'
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&libraries=places`
    script.async = true
    script.defer = true
    
    script.onload = () => {
      initAutocomplete()
    }
    
    document.head.appendChild(script)
  }, [])

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (data && !error) {
      setProfile({
        full_name: data.full_name || '',
        phone: data.phone || '',
        street_address: data.street_address || '',
        city: data.city || '',
        postal_code: data.postal_code || '',
        country: data.country || ''
      })
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingProfile(true)
    setProfileMessage('')

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        ...profile,
        updated_at: new Date().toISOString()
      })

    if (error) {
      setProfileMessage(`Error: ${error.message}`)
    } else {
      setProfileMessage('Shipping profile saved successfully!')
      setTimeout(() => setProfileMessage(''), 3000)
    }
    setSavingProfile(false)
  }

  // Live card search with translation
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      const query = searchQuery.trim()
      if (query.length < 1) {
        setSearchResults([])
        setIsSearching(false)
        return
      }

      setIsSearching(true)
      try {
        const encodedName = encodeURIComponent(query)
        const idPart = query.split('/')[0].trim()
        const encodedId = encodeURIComponent(idPart)
        
        const [nameResEn, idResEn, nameResJa, idResJa] = await Promise.all([
          fetch(`https://api.tcgdex.net/v2/en/cards?name=${encodedName}`),
          fetch(`https://api.tcgdex.net/v2/en/cards?localId=${encodedId}`),
          fetch(`https://api.tcgdex.net/v2/ja/cards?name=${encodedName}`),
          fetch(`https://api.tcgdex.net/v2/ja/cards?localId=${encodedId}`)
        ])

        const parseJson = async (res: Response) => res.ok ? await res.json() : []

        const [nameDataEn, idDataEn, nameDataJa, idDataJa] = await Promise.all([
          parseJson(nameResEn), parseJson(idResEn), parseJson(nameResJa), parseJson(idResJa)
        ])

        const enCards = [...(Array.isArray(nameDataEn) ? nameDataEn : []), ...(Array.isArray(idDataEn) ? idDataEn : [])].map(c => ({ ...c, lang: 'en' as const }))
        const jaCards = [...(Array.isArray(nameDataJa) ? nameDataJa : []), ...(Array.isArray(idDataJa) ? idDataJa : [])].map(c => ({ ...c, lang: 'ja' as const }))

        const uniqueEn = Array.from(new Map(enCards.map((c) => [c.id, c])).values())
        const uniqueJa = Array.from(new Map(jaCards.map((c) => [c.id, c])).values())

        const enIds = new Set(uniqueEn.map(c => c.id))
        const exclusiveJa = uniqueJa.filter(c => !enIds.has(c.id)).slice(0, 15)

        const translatedJa = await Promise.all(exclusiveJa.map(async (card) => {
          try {
            const res = await fetch(`https://api.tcgdex.net/v2/en/cards/${card.id}`)
            if (res.ok) {
              const fullEn = await res.json()
              if (fullEn.name) return { ...card, name: fullEn.name, lang: 'ja-translated' as const }
            }
            
            const translateRes = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=en&dt=t&q=${encodeURIComponent(card.name)}`)
            if (translateRes.ok) {
              const transData = await translateRes.json()
              if (transData && transData[0] && transData[0][0] && transData[0][0][0]) {
                return { ...card, name: transData[0][0][0], lang: 'ja-translated' as const }
              }
            }
          } catch (e) {
            console.error("Translation fetch failed", e)
          }
          return card 
        }))

        const finalResults = [...uniqueEn.slice(0, 30), ...translatedJa]
        setSearchResults(finalResults)

      } catch (err) {
        console.error('Search error:', err)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 450)

    return () => clearTimeout(delayDebounceFn)
  }, [searchQuery])

  const selectCardFromSearch = async (card: TCGdexCard) => {
    setCardName(card.name)
    setCardNumber(card.localId)
    setSearchResults([])
    setSearchQuery('')

    try {
      let res = await fetch(`https://api.tcgdex.net/v2/en/cards/${card.id}`)
      if (!res.ok) res = await fetch(`https://api.tcgdex.net/v2/ja/cards/${card.id}`)

      if (res.ok) {
        const fullCard = await res.json()
        if (fullCard.set?.name) setSetName(fullCard.set.name)
        if (fullCard.image) setSelectedCardImage(`${fullCard.image}/high.png`)
      }
    } catch (err) {
      console.error('Card detail fetch error:', err)
    }
  }

  const fetchSubmissions = async (userId: string) => {
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('user_id', userId)
      .is('order_id', null)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setSubmissions(data)
    }
  }

  const fetchOrders = async (userId: string) => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        submissions (*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setOrders(data)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setMessage('')

    if (editingId) {
      const { error } = await supabase
        .from('submissions')
        .update({
          card_name: cardName,
          card_number: cardNumber,
          set_name: setName,
          declared_value: parseFloat(declaredValue) || 0,
          service_tier: serviceTier
        })
        .eq('id', editingId)

      if (error) {
        setMessage(`Error: ${error.message}`)
      } else {
        setMessage('Submission updated!')
        cancelEdit()
        await fetchSubmissions(user.id)
      }
    } else {
      const { error } = await supabase.from('submissions').insert([
        {
          user_id: user.id,
          grading_company: 'PCG',
          card_name: cardName,
          card_number: cardNumber,
          set_name: setName,
          declared_value: parseFloat(declaredValue) || 0,
          service_tier: serviceTier,
          status: 'Pending'
        }
      ])

      if (error) {
        setMessage(`Error: ${error.message}`)
      } else {
        setMessage('Submission added!')
        cancelEdit()
        await fetchSubmissions(user.id)
      }
    }
    setSubmitting(false)
  }

  const pendingSubmissions = submissions.filter(sub => sub.status === 'Pending')
  
  const totalBaseCost = pendingSubmissions.reduce((sum, sub) => {
    const tier = TIER_CONFIG[sub.service_tier || 'Standard'] || TIER_CONFIG['Standard']
    return sum + tier.base
  }, 0)

  const totalMarkup = pendingSubmissions.reduce((sum, sub) => {
    const tier = TIER_CONFIG[sub.service_tier || 'Standard'] || TIER_CONFIG['Standard']
    return sum + tier.markup
  }, 0)

  const totalDeclaredValue = pendingSubmissions.reduce((sum, sub) => sum + Number(sub.declared_value), 0)

  // Calculate DHL Shipping & Tax dynamically using our new engine
  const shippingCalculation = calculateDHLShipping(pendingSubmissions.length, totalDeclaredValue, profile.country || 'South Africa')
  const grandTotal = totalBaseCost + totalMarkup + shippingCalculation.totalShippingAndTax

  const handleCheckout = async () => {
    if (!profile.full_name || !profile.street_address) {
      alert("Please save your shipping profile below before checking out!")
      return
    }

    if (pendingSubmissions.length === 0) return

    setIsCheckingOut(true)
    
    const orderNumber = `GS-${Math.floor(10000 + Math.random() * 90000)}`

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([
        {
          user_id: user.id,
          order_number: orderNumber,
          total_cards: pendingSubmissions.length,
          total_declared_value: totalDeclaredValue,
          total_base_cost: totalBaseCost,
          total_markup: totalMarkup,
          grand_total: grandTotal,
          status: 'Order Placed'
        }
      ])
      .select()
      .single()

    if (orderError) {
      alert(`Checkout failed: ${orderError.message}`)
      setIsCheckingOut(false)
      return
    }

    const pendingIds = pendingSubmissions.map(sub => sub.id)
    const { error: updateError } = await supabase
      .from('submissions')
      .update({ 
        order_id: orderData.id,
        status: 'Order Placed' 
      })
      .in('id', pendingIds)

    if (updateError) {
      alert(`Error linking cards to order: ${updateError.message}`)
    } else {
      await fetchSubmissions(user.id)
      await fetchOrders(user.id) 
    }
    
    setIsCheckingOut(false)
  }

  const handleEditClick = (sub: Submission) => {
    setEditingId(sub.id)
    setCardName(sub.card_name)
    setCardNumber(sub.card_number || '')
    setSetName(sub.set_name)
    setDeclaredValue(sub.declared_value.toString())
    setServiceTier(sub.service_tier || 'Standard')
    setSelectedCardImage(null)
    setMessage('')
    setIsManualMode(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDeleteClick = async (id: string) => {
    if (!window.confirm('Delete this card?')) return
    const { error } = await supabase.from('submissions').delete().eq('id', id)
    if (!error) {
      await fetchSubmissions(user.id)
      if (editingId === id) cancelEdit()
    }
  }

  const toggleOrderDetails = (orderId: string) => {
    setExpandedOrderId(expandedOrderId === orderId ? null : orderId)
  }

  const toggleManualMode = () => {
    setIsManualMode(!isManualMode)
    setSearchQuery('')
    setSearchResults([])
    setSelectedCardImage(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setCardName('')
    setCardNumber('')
    setSetName('')
    setDeclaredValue('')
    setServiceTier('Standard')
    setSelectedCardImage(null)
    setMessage('')
    setIsManualMode(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <p>Loading PCG Portal...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8 pb-20">
      
      <div className="max-w-5xl mx-auto border-b border-slate-700 pb-6 mt-4">
        <h1 className="text-3xl font-bold">My Dashboard</h1>
        <p className="mt-1 text-slate-400">
          Welcome back, <span className="text-amber-400 font-medium">{user?.email}</span>
        </p>
      </div>

      <div className="max-w-5xl mx-auto mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Form Column */}
        <div className="md:col-span-1 bg-slate-800 border border-slate-700 rounded-xl p-6 h-fit">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-amber-400">
              {editingId ? 'Edit Submission' : 'New PCG Submission'}
            </h2>
            <button
              onClick={toggleManualMode}
              className="text-xs text-slate-400 hover:text-amber-400 underline decoration-slate-600 underline-offset-4 transition"
            >
              {isManualMode ? 'Return to Search' : 'Manual Entry'}
            </button>
          </div>
          
          {!isManualMode && (
            <div className="relative mb-4">
              <label className="block text-xs font-semibold text-amber-300 mb-1">
                Search Card Name or Number
              </label>
              <input
                type="text"
                placeholder="e.g. Mega Gengar or 240/193..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-amber-500/50 rounded p-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
              {isSearching && <p className="text-[11px] text-amber-400 mt-1">Searching database...</p>}

              {searchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-20 max-h-60 overflow-y-auto">
                  {searchResults.map((card) => (
                    <button
                      key={`${card.id}-${card.lang}`}
                      type="button"
                      onClick={() => selectCardFromSearch(card)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-amber-500/20 flex justify-between border-b border-slate-800/80 text-slate-200"
                    >
                      <span className="font-medium truncate mr-2">{card.name}</span>
                      <span className="text-slate-400 shrink-0">
                        #{card.localId} {card.lang === 'en' ? '(EN)' : '(JP)'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 border-t border-slate-700/60 pt-4">
            {selectedCardImage && !editingId && !isManualMode && (
              <div className="flex justify-center mb-2">
                <img src={selectedCardImage} alt="Card Preview" className="h-28 rounded shadow-md border border-slate-700" />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Service Turnaround Tier</label>
              <select
                value={serviceTier}
                onChange={(e) => setServiceTier(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:outline-none focus:border-amber-400"
              >
                <option value="Bulk 50+">Bulk 50+ ($19.95 total • 40-60 Days)</option>
                <option value="Standard">Standard ($24.95 total • 20-30 Days)</option>
                <option value="Express">Express ($59.95 total • 7-10 Days)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Card Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Mega Gengar ex"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Card Number / ID</label>
              <input
                type="text"
                placeholder="e.g. 240/193"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Set Name</label>
              <input
                type="text"
                required
                placeholder="e.g. MEGA Dream ex"
                value={setName}
                onChange={(e) => setSetName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Declared Value ($ or ¥)</label>
              <input
                type="number"
                required
                placeholder="200"
                value={declaredValue}
                onChange={(e) => setDeclaredValue(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2 rounded text-sm transition"
              >
                {submitting ? 'Saving...' : (editingId ? 'Update' : 'Add to Order')}
              </button>
              
              {editingId && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded text-sm transition"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          {message && (
            <p className={`mt-3 text-xs ${message.startsWith('Error') ? 'text-red-400' : 'text-emerald-400'}`}>
              {message}
            </p>
          )}
        </div>

        {/* Active Submissions Column */}
        <div className="md:col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-semibold mb-4 text-white">Active PCG Submissions</h2>
            
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {submissions.length === 0 ? (
                <p className="text-slate-400 text-sm">No pending cards in your active queue.</p>
              ) : (
                submissions.map((sub) => {
                  const tier = TIER_CONFIG[sub.service_tier || 'Standard'] || TIER_CONFIG['Standard']
                  const itemPrice = tier.base + tier.markup

                  return (
                    <div key={sub.id} className={`bg-slate-900 border rounded-lg p-4 flex justify-between items-center transition-colors ${editingId === sub.id ? 'border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'border-slate-700/80'}`}>
                      <div>
                        <p className="font-bold text-slate-100">
                          {sub.card_name} {sub.card_number ? <span className="text-amber-400 text-xs font-normal">#{sub.card_number}</span> : null}
                        </p>
                        <p className="text-xs text-slate-400">
                          {sub.set_name} • Value: ${sub.declared_value} • Tier: <span className="text-slate-200">{sub.service_tier || 'Standard'} (${itemPrice.toFixed(2)})</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="inline-block border text-xs px-2.5 py-1 rounded-full font-medium bg-amber-500/10 text-amber-400 border-amber-500/20">
                          {sub.status}
                        </span>
                        
                        <div className="flex justify-end gap-3 mt-2">
                          <button 
                            onClick={() => handleEditClick(sub)} 
                            className="text-[11px] text-slate-400 hover:text-amber-400 font-medium transition"
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => handleDeleteClick(sub.id)} 
                            className="text-[11px] text-red-400 hover:text-red-400 font-medium transition"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Checkout & Calculated Shipping/Tax Breakdown */}
          {pendingSubmissions.length > 0 && (
            <div className="mt-6 pt-5 border-t border-slate-700">
              <h3 className="text-base font-semibold text-white mb-3">Order Cost Breakdown</h3>
              <div className="space-y-1.5 text-xs text-slate-300 mb-4 bg-slate-900/60 p-3 rounded-lg border border-slate-700/50">
                <div className="flex justify-between">
                  <span>Total Cards:</span>
                  <span>{pendingSubmissions.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>PCG Base Grading Cost:</span>
                  <span>${totalBaseCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-400">
                  <span>Service & Handling (Margin):</span>
                  <span>+${totalMarkup.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>DHL Courier Fees:</span>
                  <span>+${shippingCalculation.courierFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Estimated Insurance & Customs/VAT:</span>
                  <span>+${shippingCalculation.estimatedTax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-amber-400 pt-2 border-t border-slate-700">
                  <span>Customer Total:</span>
                  <span>${grandTotal.toFixed(2)}</span>
                </div>
              </div>
              <button 
                onClick={handleCheckout}
                disabled={isCheckingOut}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-lg text-sm transition disabled:opacity-50"
              >
                {isCheckingOut ? 'Processing Order...' : `Checkout & Finalize Order ($${grandTotal.toFixed(2)})`}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Shipping Profile Section */}
      <div className="max-w-5xl mx-auto mt-8 bg-slate-800 border border-slate-700 rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-1 text-white">Shipping Profile</h2>
        <p className="text-xs text-slate-400 mb-6">Start typing your street address below, and Google Maps will fill out the rest.</p>
        
        <form onSubmit={handleSaveProfile} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={profile.full_name}
              onChange={(e) => setProfile({...profile, full_name: e.target.value})}
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:border-amber-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Phone Number</label>
            <input
              type="text"
              required
              value={profile.phone}
              onChange={(e) => setProfile({...profile, phone: e.target.value})}
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:border-amber-400 focus:outline-none"
            />
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-300 mb-1">Street Address</label>
            <input
              type="text"
              required
              ref={addressInputRef}
              placeholder="Search your address..."
              value={profile.street_address}
              onChange={(e) => setProfile({...profile, street_address: e.target.value})}
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:border-amber-400 focus:outline-none"
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">City</label>
            <input
              type="text"
              required
              value={profile.city}
              onChange={(e) => setProfile({...profile, city: e.target.value})}
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:border-amber-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Postal Code</label>
            <input
              type="text"
              required
              value={profile.postal_code}
              onChange={(e) => setProfile({...profile, postal_code: e.target.value})}
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:border-amber-400 focus:outline-none"
            />
          </div>
          <div className="md:col-span-2 flex items-center justify-between mt-2">
            <div className="w-full md:w-1/2">
              <label className="block text-xs font-medium text-slate-300 mb-1">Country</label>
              <input
                type="text"
                required
                value={profile.country}
                onChange={(e) => setProfile({...profile, country: e.target.value})}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:border-amber-400 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={savingProfile}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2 px-6 rounded text-sm transition disabled:opacity-50 mt-4"
            >
              {savingProfile ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
        {profileMessage && (
          <p className={`mt-3 text-xs text-right ${profileMessage.startsWith('Error') ? 'text-red-400' : 'text-emerald-400'}`}>
            {profileMessage}
          </p>
        )}
      </div>

      {/* Order History Section */}
      <div className="max-w-5xl mx-auto mt-8 bg-slate-800 border border-slate-700 rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4 text-white">Order History</h2>
        
        {orders.length === 0 ? (
          <p className="text-slate-400 text-sm">You have no finalized orders.</p>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const isExpanded = expandedOrderId === order.id
              const dateObj = new Date(order.created_at)
              const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              
              return (
                <div key={order.id} className="bg-slate-900 border border-slate-700/80 rounded-lg overflow-hidden">
                  
                  <div 
                    onClick={() => toggleOrderDetails(order.id)}
                    className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-800/50 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-amber-400 text-lg">{order.order_number}</span>
                        <span className="inline-block border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-medium">
                          {order.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {formattedDate} • {order.total_cards} {order.total_cards === 1 ? 'Card' : 'Cards'}
                      </p>
                    </div>
                    <div className="text-right flex items-center gap-4">
                      <div className="text-sm font-bold text-slate-100">
                        ${order.grand_total.toFixed(2)}
                      </div>
                      <div className="text-slate-500">
                        {isExpanded ? '▼' : '▶'}
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-4 border-t border-slate-700/50 bg-slate-900/50">
                      <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">Cards in this order</h4>
                      <div className="space-y-2 mb-6">
                        {order.submissions?.map(sub => {
                          const tier = TIER_CONFIG[sub.service_tier || 'Standard'] || TIER_CONFIG['Standard']
                          const itemPrice = tier.base + tier.markup
                          
                          return (
                            <div key={sub.id} className="flex justify-between items-center bg-slate-800/40 p-2.5 rounded border border-slate-700/30">
                              <div>
                                <p className="text-sm font-medium text-slate-200">
                                  {sub.card_name} <span className="text-slate-500 text-xs">#{sub.card_number}</span>
                                </p>
                                <p className="text-[10px] text-slate-400">{sub.set_name} • {sub.service_tier}</p>
                              </div>
                              <div className="text-sm text-slate-300">
                                ${itemPrice.toFixed(2)}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}