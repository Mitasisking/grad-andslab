import { NextRequest, NextResponse } from 'next/server'
import Papa from 'papaparse'
import { requireAdmin } from '@/lib/require-admin'
import { getSupabaseServerClient } from '@/lib/supabase-server'

/**
 * Manual admin utility: imports/re-syncs products from a Collectr
 * export.csv. POST the raw CSV text as the request body.
 *
 * Collectr's own `Category` column just says "Pokemon" (the franchise) --
 * it doesn't distinguish sealed product from individual cards from
 * accessories, so that's derived here instead: a populated `Card Number`
 * means it's a card; otherwise a sealed-product keyword in the name means
 * `sealed`; anything else falls back to `accessories`. If a product gets
 * misclassified, it's this keyword list or this ordering that needs
 * adjusting, not the CSV.
 *
 * Re-running this against a newer export updates existing rows rather than
 * duplicating them, matched on (title, set_name, card_number) -- but only
 * price/category/set_name/card_number get overwritten. images, stock, and
 * is_active are left alone on an update, since those are owned by
 * app/api/fetch-images and by actual sales, not by Collectr.
 */

const SEALED_KEYWORDS = [
  'booster box',
  'booster bundle',
  'booster pack',
  'elite trainer box',
  'bundle',
  'etb',
  'booster',
  'box',
  'pack',
  'tin',
  'collection',
]

interface CollectrRow {
  Category?: string
  Set?: string
  'Product Name'?: string
  'Card Number'?: string
  [column: string]: string | undefined
}

function parsePrice(raw: string | undefined): number {
  // "1,344.32" -> 1344.32
  const cleaned = (raw ?? '').replace(/[^0-9.]/g, '')
  const value = Number.parseFloat(cleaned)
  return Number.isFinite(value) ? value : 0
}

function classifyCategory(productName: string, cardNumber: string): 'cards' | 'sealed' | 'accessories' {
  if (cardNumber) return 'cards'
  const lower = productName.toLowerCase()
  if (SEALED_KEYWORDS.some((keyword) => lower.includes(keyword))) return 'sealed'
  return 'accessories'
}

export async function POST(request: NextRequest) {
  // Local-dev-only convenience: skip the admin-session cookie dance so this
  // can be triggered with a bare curl/POST while iterating on an import.
  // Gated on NODE_ENV, not a flag either of us has to remember to unset --
  // Next.js sets it to 'production' for every Vercel deployment (production
  // and preview alike), so this branch cannot activate there regardless of
  // what ships in the bundle. Uses the service-role client since there's no
  // real admin session to scope a client to in this branch.
  let supabase
  if (process.env.NODE_ENV !== 'production') {
    supabase = getSupabaseServerClient()
  } else {
    const auth = await requireAdmin()
    if ('error' in auth) return auth.error
    supabase = auth.supabase
  }

  const csvText = await request.text()
  if (!csvText.trim()) {
    return NextResponse.json({ error: 'No CSV content in the request body' }, { status: 400 })
  }

  const parsed = Papa.parse<CollectrRow>(csvText, { header: true, skipEmptyLines: true })
  if (parsed.errors.length > 0) {
    return NextResponse.json({ error: 'Could not parse CSV', details: parsed.errors }, { status: 400 })
  }
  if (parsed.data.length === 0) {
    return NextResponse.json({ error: 'CSV had a header row but no data rows' }, { status: 400 })
  }

  // "Market Price (As of 2026-09-04)" -- the date makes the column name
  // itself change between exports, so it's matched by prefix, not by an
  // exact, soon-to-be-wrong name.
  const priceColumn = Object.keys(parsed.data[0]).find((key) => key.startsWith('Market Price'))
  if (!priceColumn) {
    return NextResponse.json({ error: 'Could not find a "Market Price" column in the CSV' }, { status: 400 })
  }

  const results: { title: string; status: string }[] = []

  for (const row of parsed.data) {
    const title = row['Product Name']?.trim()
    if (!title) {
      results.push({ title: '(blank row)', status: 'skipped — no Product Name' })
      continue
    }

    const setName = row['Set']?.trim() ?? ''
    const cardNumber = row['Card Number']?.trim() ?? ''
    const category = classifyCategory(title, cardNumber)
    const price = parsePrice(row[priceColumn])

    // Matched on title alone, not (title, set_name, card_number) — that
    // triple was the actual cause of the 20 duplicate sealed products
    // supabase/migrations/0015_dedupe_products.sql cleaned up: when
    // Collectr started supplying set_name for a product that previously
    // had it blank, matching on the full triple read that as a different
    // product and inserted a duplicate instead of filling in the gap.
    const { data: existing, error: lookupError } = await supabase
      .from('products')
      .select('id')
      .eq('title', title)
      .maybeSingle()

    if (lookupError) {
      results.push({ title, status: `error checking for an existing row: ${lookupError.message}` })
      continue
    }

    if (existing) {
      const { error: updateError } = await supabase
        .from('products')
        .update({ category, set_name: setName, card_number: cardNumber, price })
        .eq('id', existing.id)

      results.push({
        title,
        status: updateError ? `error updating: ${updateError.message}` : `updated (${category})`,
      })
      continue
    }

    const { error: insertError } = await supabase.from('products').insert({
      title,
      category,
      set_name: setName,
      card_number: cardNumber,
      price,
      stock: 1,
      images: [],
      is_active: true,
    })

    results.push({
      title,
      status: insertError ? `error inserting: ${insertError.message}` : `imported (${category})`,
    })
  }

  return NextResponse.json({ processed: results.length, results })
}
