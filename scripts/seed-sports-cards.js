#!/usr/bin/env node
/**
 * One-off admin utility: seeds public.products with test Sports Cards data
 * parsed from a local CSV, for exercising the shop's Sports Cards filters
 * (components/shop/sports-card-filters.tsx) before real inventory exists --
 * the only real import path (app/api/admin/import-products/route.ts) reads
 * a Collectr export, which is Pokemon-only.
 *
 * Usage:
 *   node scripts/seed-sports-cards.js [path/to/sports_card_database.csv]
 *   node scripts/seed-sports-cards.js --delete
 *
 * Every seeded row's title is prefixed "[SEED-TEST] " specifically so it
 * can be found and removed in one shot later -- either re-run this script
 * with --delete, or run directly in Supabase's SQL Editor:
 *
 *   delete from public.products where title like '[SEED-TEST]%';
 *
 * Reads Supabase credentials from .env.local (service-role key -- this
 * bypasses RLS, same trust level as the Collectr importer's own use of it).
 */

const fs = require('fs')
const path = require('path')
const Papa = require('papaparse')
const { createClient } = require('@supabase/supabase-js')

const TITLE_PREFIX = '[SEED-TEST] '

const DEFAULT_CSV_PATH = path.join(__dirname, '..', '..', 'sports_card_database.csv')

// The CSV's Sport column uses plain sport names; ours mixes sport names
// (soccer/rugby/f1) with league abbreviations (nhl/nba/mlb/nfl) --
// see supabase/migrations/0025_add_sports_card_fields.sql and
// 0027_add_baseball_football_sports.sql for why.
const SPORT_MAP = {
  Basketball: 'nba',
  Soccer: 'soccer',
  Racing: 'f1',
  'Ice Hockey': 'nhl',
  Baseball: 'mlb',
  'American Football': 'nfl',
}

// Checked before falling back to "first word" -- "Upper Deck" would
// otherwise become brand "Upper".
const MULTI_WORD_BRANDS = ['Upper Deck']

const PLACEHOLDER_IMAGE = 'https://placehold.co/400x560/e5e0d5/6b6558?text=Sports+Card'

function loadEnv(envPath) {
  const text = fs.readFileSync(envPath, 'utf8')
  return Object.fromEntries(
    text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const idx = line.indexOf('=')
        return [line.slice(0, idx), line.slice(idx + 1)]
      }),
  )
}

function extractBrand(setName) {
  const known = MULTI_WORD_BRANDS.find((brand) => setName.startsWith(brand))
  return known ?? setName.split(' ')[0]
}

// Our card_variant enum (rookie/auto/patch/parallel/base) is coarser than
// the CSV's Attributes column (e.g. "Silver Prizm", "Rookie Ticket
// Autograph", "Refractor", "Insert") -- priority order below picks the
// single most-specific bucket a compound attribute fits, and the full
// original text is kept in the product description so nothing's lost to
// this approximation.
function mapCardVariant(attributes) {
  const lower = attributes.toLowerCase()
  if (lower.includes('autograph')) return 'auto'
  if (lower.includes('rookie')) return 'rookie'
  if (lower.includes('patch') || lower.includes('memorabilia')) return 'patch'
  if (lower.includes('refractor') || lower.includes('prizm') || lower.includes('parallel') || lower.includes('insert')) {
    return 'parallel'
  }
  return 'base'
}

function mapCategory(status) {
  // Matches how the existing Pokemon Graded/Raw Cards tabs already split
  // this same category column. (An earlier version of this function
  // returned 'cards' unconditionally, working around a since-fixed bug --
  // 0028_fix_products_category_constraint.sql -- where the live
  // chk_products_category_lowercase constraint had drifted into a
  // hardcoded allow-list missing 'graded' entirely.)
  return status.trim().toLowerCase() === 'graded' ? 'graded' : 'cards'
}

// Deterministic placeholder in ZAR -- matches the rest of the shop
// (lib/currency.ts's formatZAR), not the USD/JPY originally asked for; see
// the mapping-plan discussion this seed script came out of. Not real
// pricing data -- the CSV has no price column at all.
function placeholderPriceZAR(row) {
  const seed = `${row.Player}|${row.Set}|${row['Card #']}`
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  const rands = 100 + (hash % 480000) / 100 // R100.00 – R4,900.00
  return Math.round(rands * 100) / 100
}

function buildDescription(row) {
  const parts = [row.Attributes]
  if (row.Status.trim() === 'Graded' && row['Grading Company'] !== 'N/A') {
    parts.push(`${row['Grading Company']} ${row.Grade}`)
  }
  return parts.filter(Boolean).join(' — ')
}

function mapRow(row) {
  const sport = SPORT_MAP[row.Sport.trim()]
  if (!sport) {
    return { skipped: true, reason: `unrecognized Sport "${row.Sport}"`, row }
  }

  return {
    skipped: false,
    product: {
      title: `${TITLE_PREFIX}${row.Year} ${row.Set} ${row.Player} #${row['Card #']}`,
      description: buildDescription(row),
      category: mapCategory(row.Status),
      price: placeholderPriceZAR(row),
      stock: 1,
      images: [PLACEHOLDER_IMAGE],
      is_active: true,
      set_name: row.Set,
      card_number: row['Card #'],
      card_type: 'sports_card',
      sport,
      brand: extractBrand(row.Set),
      card_variant: mapCardVariant(row.Attributes),
      player_name: row.Player,
    },
  }
}

async function main() {
  const args = process.argv.slice(2)
  const envPath = path.join(__dirname, '..', '.env.local')
  const env = loadEnv(envPath)
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

  if (args.includes('--delete')) {
    const { data, error } = await supabase.from('products').delete().like('title', `${TITLE_PREFIX}%`).select('id')
    if (error) throw error
    console.log(`Deleted ${data.length} seeded row(s).`)
    return
  }

  const csvPath = args[0] ?? DEFAULT_CSV_PATH
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV not found at ${csvPath}`)
    process.exitCode = 1
    return
  }

  const csvText = fs.readFileSync(csvPath, 'utf8')
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true })
  if (parsed.errors.length > 0) {
    console.error('CSV parse errors:', parsed.errors)
    process.exitCode = 1
    return
  }

  const mapped = parsed.data.map(mapRow)
  const skipped = mapped.filter((m) => m.skipped)
  const products = mapped.filter((m) => !m.skipped).map((m) => m.product)

  if (skipped.length > 0) {
    console.log(`Skipping ${skipped.length} row(s):`)
    for (const s of skipped) console.log(`  - ${s.reason}: ${s.row.Player}`)
  }

  console.log(`Inserting ${products.length} product(s)...`)
  const { data, error } = await supabase.from('products').insert(products).select('id, title')
  if (error) {
    console.error('Insert failed:', error.message)
    process.exitCode = 1
    return
  }

  console.log(`Inserted ${data.length} product(s).`)
  console.log('\nTo remove them later:')
  console.log(`  node scripts/seed-sports-cards.js --delete`)
  console.log(`  -- or in the Supabase SQL Editor:`)
  console.log(`  delete from public.products where title like '${TITLE_PREFIX}%';`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
