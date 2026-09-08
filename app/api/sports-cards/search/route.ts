import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRouteClient } from '@/lib/supabase-route-client'
import type { Sport } from '@/lib/submission-types'

/**
 * Sports-card search backed by our own catalog (public.products,
 * card_type = 'sports_card'), not an external provider -- this replaced an
 * earlier version wired against The Card API's Market Sales endpoint,
 * whose results were noisy sale-listing titles rather than a real card
 * catalog (see git history for that version's own extensive caveats about
 * best-effort title parsing). Every field here comes straight off a real,
 * admin-catalogued product row instead: sport and card_number are exact,
 * not guessed.
 *
 * year is the one exception -- products has no dedicated year column, so
 * it's extracted from the title with a best-effort regex the same way the
 * old provider-backed version parsed sale titles. Genuinely a guess: stays
 * editable in the UI rather than locked, unlike year picked from a real
 * TCGdex card (components/submit/card-shipment-row.tsx).
 */

interface SportsCardResult {
  id: string
  sport: Sport
  playerName: string
  year: string | null
  brandSet: string | null
  cardNumber: string | null
}

interface ProductRow {
  id: string
  title: string
  sport: Sport | null
  player_name: string | null
  set_name: string | null
  brand: string | null
  card_number: string | null
}

function extractYear(title: string): string | null {
  return title.match(/\b(19|20)\d{2}\b/)?.[0] ?? null
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')?.trim()
  const brand = searchParams.get('brand')?.trim()

  if (!query || query.length < 2) {
    return NextResponse.json({ error: 'A search query of at least 2 characters is required.' }, { status: 400 })
  }

  const supabase = await getSupabaseRouteClient()

  // PostgREST's .or() takes a raw filter string where "," and "()" are
  // syntax (clause separators/grouping) -- strip them out of the user's
  // query before interpolating so it can only ever narrow the match, never
  // inject an additional OR'd clause. Bounded impact either way since
  // card_type stays a separate, hard-ANDed .eq() below, but this keeps the
  // filter well-formed instead of relying on that alone.
  const safeQuery = query.replace(/[,()]/g, ' ').trim()

  let dbQuery = supabase
    .from('products')
    .select('id, title, sport, player_name, set_name, brand, card_number')
    .eq('card_type', 'sports_card')
    .or(`title.ilike.%${safeQuery}%,player_name.ilike.%${safeQuery}%`)
    .order('title')
    .limit(25)

  if (brand) dbQuery = dbQuery.eq('brand', brand)

  const { data, error } = await dbQuery

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // chk_products_sport_matches_card_type (0026_add_shop_sports_card_products.sql)
  // guarantees sport is set for every card_type = 'sports_card' row.
  const results: SportsCardResult[] = ((data ?? []) as ProductRow[]).map((row) => ({
    id: row.id,
    sport: row.sport as Sport,
    playerName: row.player_name ?? row.title,
    year: extractYear(row.title),
    brandSet: row.set_name ?? row.brand,
    cardNumber: row.card_number,
  }))

  return NextResponse.json({ results })
}
