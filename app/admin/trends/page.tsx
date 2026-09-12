import { redirect } from 'next/navigation'
import { getSupabaseRouteClient } from '@/lib/supabase-route-client'
import { TrendsDashboard, type MarketTrendRow, type WatchlistEntry } from './trends-dashboard'

export default async function AdminTrendsPage() {
  const supabase = await getSupabaseRouteClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  const [{ data: trendsData }, { data: watchlistData }] = await Promise.all([
    supabase.from('market_trends').select('*').order('profit_multiplier', { ascending: false }).limit(50),
    supabase.from('trend_watchlist').select('*').order('created_at', { ascending: false }),
  ])

  return (
    <TrendsDashboard
      initialTrends={(trendsData ?? []) as MarketTrendRow[]}
      initialWatchlist={(watchlistData ?? []) as WatchlistEntry[]}
    />
  )
}
