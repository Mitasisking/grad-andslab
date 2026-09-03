'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

interface AuctionItem {
  id: string
  title: string
  description: string
  starting_price: number
  current_bid: number
  highest_bidder: string
  image_url: string
  ends_at: string
  status: string
}

export default function AuctionsPage() {
  const [auctions, setAuctions] = useState<AuctionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [bidAmounts, setBidAmounts] = useState<Record<string, string>>({})
  const [biddingId, setBiddingId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ id: string; text: string; type: 'success' | 'error' } | null>(null)

  const router = useRouter()

  useEffect(() => {
    async function loadAuctionsData() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      const { data, error } = await supabase
        .from('auctions')
        .select('*')
        .eq('status', 'active')
        .order('ends_at', { ascending: true })

      if (!error && data) {
        setAuctions(data)
      }
      setLoading(false)
    }
    loadAuctionsData()
  }, [])

  const handlePlaceBid = async (auction: AuctionItem) => {
    if (!user) {
      router.push('/login')
      return
    }

    const rawBid = bidAmounts[auction.id]
    const numericBid = parseFloat(rawBid)

    if (!numericBid || numericBid <= auction.current_bid) {
      setMessage({ id: auction.id, text: `Bid must be higher than the current bid of $${auction.current_bid.toFixed(2)}`, type: 'error' })
      return
    }

    setBiddingId(auction.id)
    setMessage(null)

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    const bidderName = profile?.full_name || user.email.split('@')[0]

    const { error } = await supabase
      .from('auctions')
      .update({
        current_bid: numericBid,
        highest_bidder: bidderName
      })
      .eq('id', auction.id)

    if (error) {
      setMessage({ id: auction.id, text: `Error: ${error.message}`, type: 'error' })
    } else {
      setMessage({ id: auction.id, text: 'Bid placed successfully!', type: 'success' })
      setBidAmounts(prev => ({ ...prev, [auction.id]: '' }))
      
      setAuctions(prev => prev.map(a => a.id === auction.id ? { ...a, current_bid: numericBid, highest_bidder: bidderName } : a))
    }

    setBiddingId(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <p>Loading Live Auctions...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8 pb-24">
      <div className="max-w-6xl mx-auto border-b border-slate-700 pb-8 mt-4">
        <div className="inline-block mb-3 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-xs font-semibold text-red-400 tracking-wide uppercase">
          ● Live Bidding Room
        </div>
        <h1 className="text-4xl font-black text-amber-500 tracking-tight">Grade & Slab Auctions</h1>
        <p className="mt-2 text-slate-400 text-lg">
          Compete for rare graded slabs and high-end collector pieces in real-time.
        </p>
      </div>

      <div className="max-w-6xl mx-auto mt-8">
        {auctions.length === 0 ? (
          <div className="text-center py-20 bg-slate-800/50 rounded-xl border border-slate-700">
            <p className="text-slate-400">No active auctions right now. Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {auctions.map(auction => {
              const minNextBid = auction.current_bid + 5
              const currentMsg = message?.id === auction.id ? message : null

              return (
                <div key={auction.id} className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden shadow-xl flex flex-col">
                  
                  <div className="h-64 bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
                    <img 
                      src={auction.image_url} 
                      alt={auction.title} 
                      className="max-h-full max-w-full object-contain drop-shadow-2xl hover:scale-105 transition duration-500" 
                    />
                    <div className="absolute top-4 left-4 bg-slate-900/90 border border-slate-700 backdrop-blur px-3 py-1.5 rounded-full text-xs font-semibold text-emerald-400 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      Active Lot
                    </div>
                  </div>

                  <div className="p-6 flex flex-col flex-grow justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-slate-100 mb-2">{auction.title}</h3>
                      <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                        {auction.description}
                      </p>

                      <div className="bg-slate-900/80 border border-slate-700/60 p-4 rounded-xl mb-6 grid grid-cols-2 gap-4">
                        <div>
                          <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Current Bid</span>
                          <span className="text-2xl font-black text-amber-400">${auction.current_bid.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Highest Bidder</span>
                          <span className="text-sm font-bold text-slate-200 truncate block mt-1">{auction.highest_bidder}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 pt-4 border-t border-slate-700/60">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">$</span>
                          <input
                            type="number"
                            min={minNextBid}
                            step="1"
                            placeholder={`Min $${minNextBid}`}
                            value={bidAmounts[auction.id] || ''}
                            onChange={(e) => setBidAmounts({ ...bidAmounts, [auction.id]: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-7 pr-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
                          />
                        </div>
                        <button
                          onClick={() => handlePlaceBid(auction)}
                          disabled={biddingId === auction.id}
                          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-2 rounded-xl text-sm transition disabled:opacity-50 shadow-md"
                        >
                          {biddingId === auction.id ? 'Placing Bid...' : 'Place Bid'}
                        </button>
                      </div>

                      {currentMsg && (
                        <p className={`text-xs ${currentMsg.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>
                          {currentMsg.text}
                        </p>
                      )}
                    </div>

                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}