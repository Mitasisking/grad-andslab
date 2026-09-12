import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'

interface WatchlistBody {
  marketTrendId?: string
  cardName?: string
  setName?: string
}

/**
 * Backs the "Add to watchlist" toggle on /admin/trends
 * (trends-dashboard.tsx). Runs under the caller's own session (requireAdmin's
 * client), not a service-role client -- trend_watchlist_insert_admin_only/
 * select/delete (0051_trend_watchlist.sql) are the actual gate, same pattern
 * as every other session-scoped admin route in this app.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const { supabase, user } = auth

  const body = (await request.json()) as WatchlistBody
  if (!body.marketTrendId || !body.cardName || !body.setName) {
    return NextResponse.json({ error: 'marketTrendId, cardName, and setName are required' }, { status: 400 })
  }

  const { error } = await supabase.from('trend_watchlist').insert({
    market_trend_id: body.marketTrendId,
    card_name: body.cardName,
    set_name: body.setName,
    added_by: user.id,
  })

  // 23505 = unique_violation on trend_watchlist's unique(market_trend_id) --
  // this card is already bookmarked, which is exactly the state the caller
  // wanted, so treat re-adding it as a no-op success rather than an error.
  if (error && error.code !== '23505') {
    console.error('trend_watchlist insert failed:', error.message)
    return NextResponse.json({ error: 'Could not add to watchlist' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const { supabase } = auth

  const marketTrendId = request.nextUrl.searchParams.get('marketTrendId')
  if (!marketTrendId) {
    return NextResponse.json({ error: 'marketTrendId is required' }, { status: 400 })
  }

  const { error } = await supabase.from('trend_watchlist').delete().eq('market_trend_id', marketTrendId)

  if (error) {
    console.error('trend_watchlist delete failed:', error.message)
    return NextResponse.json({ error: 'Could not remove from watchlist' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
