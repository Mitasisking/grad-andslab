/**
 * READ-ONLY audit of historical grading submissions for underpayment.
 *
 * Before f1cc463 ("Make grading submission pricing server-authoritative",
 * 2026-09-24) the browser chose the price: /api/submissions stored the
 * client's serviceFee as submissions.service_fee, and checkout charged
 * Payfast the client's own amountCents. This script re-prices every
 * submission from its stored rows with today's lib/submission-pricing.ts
 * and compares:
 *
 *   1. submissions.service_fee (what the browser claimed) against the
 *      recomputed service fee, both with and without the Secursus insurance
 *      legs -- insurance only became part of the price on 2026-09-23
 *      (b26c728), so an older submission legitimately matches the
 *      "without insurance" figure.
 *   2. Optionally, the amount Payfast actually received. Nothing in the
 *      database records it (the ITN webhook never stored amount_gross), so
 *      pass a Payfast transaction-history CSV export with --payfast=<file>;
 *      rows are matched on the m_payment_id column (the submission id).
 *
 * Other historical price changes (tier prices, label options, courier legs)
 * also show up as mismatches, so a flagged row means "check this one", not
 * "this customer underpaid". Nothing is written anywhere.
 *
 * Usage:
 *   npm run audit:submissions
 *   npm run audit:submissions -- --payfast=path/to/payfast-export.csv
 *   npm run audit:submissions -- --all   (also include pending/failed submissions)
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import {
  SUBMISSION_ITEM_PRICING_COLUMNS,
  SUBMISSION_PRICING_COLUMNS,
  computeSubmissionPricing,
  pricingInputFromRows,
  toCents,
} from '@/lib/submission-pricing'
import type { SubmissionItemPricingRow, SubmissionPricingRow } from '@/lib/submission-pricing'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceRoleKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (run via npm run audit:submissions)')
}
const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } })

const PAGE = 500

type SubmissionRow = SubmissionPricingRow & {
  id: string
  created_at: string
  payment_status: string
  service_fee: number | string | null
  shipping_address_snapshot: { name?: string } | null
}

async function fetchAll<T>(table: string, columns: string, filter?: (q: ReturnType<typeof query>) => ReturnType<typeof query>): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    let q = query(table, columns).range(from, from + PAGE - 1)
    if (filter) q = filter(q)
    const { data, error } = await q
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...((data ?? []) as T[]))
    if (!data || data.length < PAGE) return rows
  }
}
function query(table: string, columns: string) {
  return supabase.from(table).select(columns).order('id')
}

/** Minimal CSV parser (handles quoted fields) for a Payfast transaction export. */
function parseCsv(text: string): Record<string, string>[] {
  const records: string[][] = []
  let field = ''
  let record: string[] = []
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      record.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      record.push(field)
      if (record.some((f) => f.trim() !== '')) records.push(record)
      record = []
      field = ''
    } else field += ch
  }
  record.push(field)
  if (record.some((f) => f.trim() !== '')) records.push(record)
  const [header, ...body] = records
  const keys = header.map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'))
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])))
}

function loadPayfastAmounts(path: string): Map<string, number> {
  const rows = parseCsv(readFileSync(path, 'utf8'))
  const idKey = ['m_payment_id', 'merchant_payment_id', 'payment_id'].find((k) => k in (rows[0] ?? {}))
  const amountKey = ['amount_gross', 'gross', 'amount'].find((k) => k in (rows[0] ?? {}))
  if (!idKey || !amountKey) {
    throw new Error(`Payfast CSV needs an m_payment_id and an amount_gross/gross/amount column; found: ${Object.keys(rows[0] ?? {}).join(', ')}`)
  }
  const paid = new Map<string, number>()
  for (const row of rows) {
    const cents = toCents(Number(row[amountKey].replace(/[^0-9.-]/g, '')))
    if (row[idKey] && Number.isFinite(cents)) paid.set(row[idKey], (paid.get(row[idKey]) ?? 0) + cents)
  }
  return paid
}

function rand(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `${sign}R ${whole},${String(abs % 100).padStart(2, '0')}`
}

const includeAll = process.argv.includes('--all')
const payfastArg = process.argv.find((a) => a.startsWith('--payfast='))
const payfastPaid = payfastArg ? loadPayfastAmounts(payfastArg.slice('--payfast='.length)) : null

const submissions = await fetchAll<SubmissionRow>(
  'submissions',
  `id, created_at, payment_status, service_fee, shipping_address_snapshot, ${SUBMISSION_PRICING_COLUMNS}`,
  (q) => (includeAll ? q : q.in('payment_status', ['captured', 'authorized', 'refunded'])),
)
// Batched so the id list never makes the request URL too long.
const items: (SubmissionItemPricingRow & { submission_id: string })[] = []
const submissionIds = submissions.map((s) => s.id)
for (let i = 0; i < submissionIds.length; i += 100) {
  const batch = submissionIds.slice(i, i + 100)
  items.push(
    ...(await fetchAll<SubmissionItemPricingRow & { submission_id: string }>(
      'submission_items',
      `submission_id, ${SUBMISSION_ITEM_PRICING_COLUMNS}`,
      (q) => q.in('submission_id', batch),
    )),
  )
}
const itemsBySubmission = new Map<string, SubmissionItemPricingRow[]>()
for (const item of items) {
  if (!itemsBySubmission.has(item.submission_id)) itemsBySubmission.set(item.submission_id, [])
  itemsBySubmission.get(item.submission_id)!.push(item)
}

type Verdict = 'matches current price' | 'matches pre-insurance price' | 'OVERPAID vs current' | 'UNDER current price' | 'cannot price'
interface Result {
  id: string
  createdAt: string
  status: string
  isTest: boolean
  cards: number
  storedCents: number
  currentServiceCents: number | null
  preInsuranceServiceCents: number | null
  currentTotalCents: number | null
  payfastCents: number | null
  verdict: Verdict
  note: string
}

const results: Result[] = submissions.map((s) => {
  const rows = itemsBySubmission.get(s.id) ?? []
  const storedCents = toCents(Number(s.service_fee ?? 0))
  const name = s.shipping_address_snapshot?.name ?? ''
  const base = {
    id: s.id,
    createdAt: s.created_at.slice(0, 10),
    status: s.payment_status,
    isTest: /\[TEST|test/i.test(name),
    cards: rows.length,
    storedCents,
    payfastCents: payfastPaid?.get(s.id) ?? null,
  }
  try {
    const pricing = computeSubmissionPricing(pricingInputFromRows(s, rows))
    const currentServiceCents = toCents(pricing.serviceFee)
    const preInsuranceServiceCents = currentServiceCents - toCents(pricing.secursusInsuranceTotal)
    const verdict: Verdict =
      storedCents === currentServiceCents
        ? 'matches current price'
        : storedCents === preInsuranceServiceCents
          ? 'matches pre-insurance price'
          : storedCents < currentServiceCents
            ? 'UNDER current price'
            : 'OVERPAID vs current'
    return {
      ...base,
      currentServiceCents,
      preInsuranceServiceCents,
      currentTotalCents: toCents(pricing.total),
      verdict,
      note: '',
    }
  } catch (err) {
    return {
      ...base,
      currentServiceCents: null,
      preInsuranceServiceCents: null,
      currentTotalCents: null,
      verdict: 'cannot price' as Verdict,
      note: err instanceof Error ? err.message : String(err),
    }
  }
})
results.sort((a, b) => a.createdAt.localeCompare(b.createdAt))

console.log(`\nSubmission payment audit -- READ ONLY, ${new Date().toISOString().slice(0, 10)}`)
console.log(`${includeAll ? 'All' : 'Paid/authorized/refunded'} submissions: ${results.length} (${results.filter((r) => r.isTest).length} look like test data)`)
console.log(payfastPaid ? `Payfast export rows matched: ${results.filter((r) => r.payfastCents !== null).length}` : 'No Payfast export given -- comparing stored service_fee only (see header).')

const counts = new Map<Verdict, number>()
for (const r of results) counts.set(r.verdict, (counts.get(r.verdict) ?? 0) + 1)
console.log('\nVerdicts (stored service_fee vs recomputed):')
for (const [verdict, n] of counts) console.log(`  ${verdict.padEnd(30)} ${n}`)

const flagged = results.filter(
  (r) =>
    r.verdict === 'UNDER current price' ||
    r.verdict === 'cannot price' ||
    (r.payfastCents !== null && r.currentTotalCents !== null && r.payfastCents < r.currentTotalCents),
)
console.log(`\nFlagged for review: ${flagged.length}`)
if (flagged.length > 0) {
  console.log(
    `  ${'Date'.padEnd(10)} ${'Submission'.padEnd(10)} ${'Status'.padEnd(9)} ${'Cards'.padStart(5)} ${'Stored fee'.padStart(14)} ${'Now (no ins.)'.padStart(14)} ${'Now'.padStart(14)} ${'Payfast'.padStart(14)}  Verdict`,
  )
  for (const r of flagged) {
    const fmt = (c: number | null) => (c === null ? '-' : rand(c)).padStart(14)
    console.log(
      `  ${r.createdAt} ${r.id.slice(0, 8).toUpperCase().padEnd(10)} ${r.status.padEnd(9)} ${String(r.cards).padStart(5)} ${fmt(r.storedCents)} ${fmt(r.preInsuranceServiceCents)} ${fmt(r.currentServiceCents)} ${fmt(r.payfastCents)}  ${r.verdict}${r.isTest ? ' [test?]' : ''}${r.note ? ` (${r.note})` : ''}`,
    )
  }
}
const gapCents = flagged.reduce((sum, r) => sum + Math.max(0, (r.preInsuranceServiceCents ?? r.storedCents) - r.storedCents), 0)
console.log(`\nLargest possible shortfall on flagged rows vs pre-insurance price: ${rand(gapCents)}`)
console.log('Stored fees are what the browser sent, not what Payfast received -- confirm any flagged row in the Payfast dashboard.\n')
