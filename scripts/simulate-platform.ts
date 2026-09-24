/**
 * PLATFORM SIMULATION -- 100 clients over a 90-day window, entirely in
 * memory. Nothing here touches Supabase, Payfast, or email: the only
 * database this project has is production (see PROJECT_STATE.md), so this
 * models the platform's operational and financial rules instead of writing
 * to it.
 *
 * What is real vs. modelled:
 *   - Submission pricing is the real thing: every submission is priced by
 *     lib/submission-pricing.ts's computeSubmissionPricing(), the same
 *     function the Review & Pay step and the server-side checkout use, and
 *     every total is then independently re-derived here to prove the two
 *     15% Secursus insurance legs are included.
 *   - Tier prices/turnarounds, label fees, courier and insurance rates, and
 *     VAT rates are imported from lib/, so this breaks loudly if they change.
 *   - Shop checkout mirrors create_order() (supabase/migrations/
 *     0066_server_side_shop_shipping.sql) rule for rule: stock is checked and
 *     decremented per line, an out-of-stock line rejects the whole order,
 *     Raw Cards under R100 are refused, and tax_collected is bookkeeping
 *     (15% of total) rather than an extra charge. The products are a
 *     synthetic catalogue, not the real one.
 *   - Batch state names follow the requested Logged -> Prepped -> Shipped ->
 *     Grading -> Returned -> Dispatched timeline, each mapped to the real
 *     public.shipment_batch_status value (0052_logistics_agent_schema.sql).
 *
 * All money is aggregated in integer cents so the balance checks are exact.
 * Runs are reproducible: the same --seed always produces the same report.
 *
 * Usage:
 *   npm run simulate
 *   npm run simulate -- --seed=7 --clients=100 --days=90
 */
import { computeSubmissionPricing, toCents } from '@/lib/submission-pricing'
import { REGION_TAX_RATE } from '@/lib/shop/product-type'
import { SHOP_SHIPPING_FLAT_RATE_ZAR } from '@/lib/shop/shipping'
import {
  ACE_LABEL_OPTIONS,
  CLEANING_TIER_OPTIONS,
  DOMESTIC_COURIER_LEG_FEE_ZAR,
  SECURSUS_INSURANCE_RATE,
  SLAB_GUARD_FEE_ZAR,
  TIER_OPTIONS_BY_COMPANY,
} from '@/lib/submission-types'
import type { SubmissionPricing, SubmissionPricingCard } from '@/lib/submission-pricing'
import type { AceLabelOption, CleaningTier, IntakeChannel, SubmissionTier, SubmissionType } from '@/lib/submission-types'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function argValue(name: string, fallback: number): number {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`))
  const value = arg ? Number(arg.split('=')[1]) : fallback
  if (!Number.isFinite(value) || value <= 0) throw new Error(`--${name} must be a positive number`)
  return value
}

const SEED = argValue('seed', 20260924)
const CLIENT_COUNT = argValue('clients', 100)
const WINDOW_DAYS = argValue('days', 90)
const DAY_MS = 24 * 60 * 60 * 1000
const NOW = new Date(Date.UTC(2026, 8, 24, 12))
const WINDOW_START = new Date(NOW.getTime() - WINDOW_DAYS * DAY_MS)

// Flat per-order shop shipping -- the same constant create_order() fixes
// server-side (0066_server_side_shop_shipping.sql).
const SHOP_SHIPPING_FLAT_RATE = SHOP_SHIPPING_FLAT_RATE_ZAR
const SHOP_TAX_RATE = REGION_TAX_RATE.sa
const SUBMISSION_TAX_RATE = REGION_TAX_RATE.sa
const PAYMENT_FAILURE_RATE = 0.04

// ---------------------------------------------------------------------------
// Seeded randomness (mulberry32) -- reproducible runs
// ---------------------------------------------------------------------------

let rngState = SEED >>> 0
function random(): number {
  rngState = (rngState + 0x6d2b79f5) >>> 0
  let t = rngState
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const randInt = (min: number, max: number) => min + Math.floor(random() * (max - min + 1))
const chance = (p: number) => random() < p
function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)]
}
function weighted<T>(entries: readonly [T, number][]): T {
  const total = entries.reduce((sum, [, w]) => sum + w, 0)
  let roll = random() * total
  for (const [value, weight] of entries) {
    roll -= weight
    if (roll <= 0) return value
  }
  return entries[entries.length - 1][0]
}
/** Log-normal-ish declared value in ZAR, rounded to R10: most raw cards are modest, a few are grails. */
function declaredValueZAR(): number {
  const normal = Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random())
  const value = Math.exp(6.9 + 1.1 * normal)
  return Math.min(250_000, Math.max(150, Math.round(value / 10) * 10))
}
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS)
const isoDay = (date: Date) => date.toISOString().slice(0, 10)

// ---------------------------------------------------------------------------
// Money formatting (cents in, "R 12 345,67" out -- matches lib/currency's ZAR style)
// ---------------------------------------------------------------------------

function rand(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `${sign}R ${whole},${String(abs % 100).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Invariant tracking
// ---------------------------------------------------------------------------

const failures: string[] = []
let checksRun = 0
function check(condition: boolean, message: string) {
  checksRun++
  if (!condition) failures.push(message)
}

// ---------------------------------------------------------------------------
// 1. Clients
// ---------------------------------------------------------------------------

const FIRST_NAMES = ['Thabo', 'Lerato', 'Pieter', 'Aisha', 'Sipho', 'Megan', 'Johan', 'Naledi', 'Ruan', 'Zanele', 'Kyle', 'Precious', 'Ethan', 'Palesa', 'Liam', 'Nomsa', 'Jason', 'Kayla', 'Tshepo', 'Chloe']
const LAST_NAMES = ['Nkosi', 'van der Merwe', 'Dlamini', 'Botha', 'Mokoena', 'Pillay', 'Smith', 'Naidoo', 'Khumalo', 'Pretorius', 'Mahlangu', 'Jacobs', 'Ndlovu', 'Fourie', 'Govender']

interface Client {
  id: string
  name: string
  email: string
  joinedAt: Date
  /** Relative activity level: collectors vary from one-off senders to weekly regulars. */
  activity: number
  prefersInPerson: boolean
}

const clients: Client[] = Array.from({ length: CLIENT_COUNT }, (_, i) => {
  const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`
  return {
    id: `client-${String(i + 1).padStart(3, '0')}`,
    name,
    email: `sim.client${i + 1}@example.invalid`,
    joinedAt: addDays(WINDOW_START, random() * WINDOW_DAYS * 0.6),
    activity: weighted([
      [1, 45],
      [2, 30],
      [4, 18],
      [7, 7],
    ]),
    prefersInPerson: chance(0.12),
  }
})

// ---------------------------------------------------------------------------
// 2. Submissions
// ---------------------------------------------------------------------------

type PaymentOutcome = 'captured' | 'failed'

interface SimSubmission {
  id: string
  clientId: string
  createdAt: Date
  tier: SubmissionTier
  submissionType: SubmissionType
  intakeChannel: IntakeChannel
  cards: SubmissionPricingCard[]
  pricing: SubmissionPricing
  payment: PaymentOutcome
  batchId: string | null
}

const aceTiers = TIER_OPTIONS_BY_COMPANY.ACE
const submissions: SimSubmission[] = []

for (const client of clients) {
  const count = Math.max(1, Math.round(client.activity * (0.6 + random() * 0.8)))
  const activeDays = (NOW.getTime() - client.joinedAt.getTime()) / DAY_MS
  for (let n = 0; n < count; n++) {
    const createdAt = addDays(client.joinedAt, random() * activeDays)
    const tier = weighted<SubmissionTier>([
      ['ace_basic', 50],
      ['ace_standard', 25],
      ['ace_premier', 14],
      ['ace_ultra', 8],
      ['ace_luxury', 3],
    ])
    const cardCount = weighted([
      [randInt(1, 3), 35],
      [randInt(4, 10), 40],
      [randInt(11, 25), 20],
      [randInt(26, 50), 5],
    ])
    const cards = Array.from({ length: cardCount }, () => ({
      declaredValue: declaredValueZAR(),
      cleaningTier: weighted<CleaningTier>([
        ['none', 70],
        ['half', 20],
        ['full', 10],
      ]),
      requiresSlabGuard: chance(0.2),
      labelOption: weighted<AceLabelOption>([
        ['standard', 60],
        ['colour_match', 25],
        ['ace_label', 15],
      ]),
    }))
    const input = {
      gradingCompany: 'ACE' as const,
      tier,
      region: 'sa' as const,
      submissionType: weighted<SubmissionType>([
        ['batch', 85],
        ['individual', 15],
      ]),
      intakeChannel: (client.prefersInPerson && chance(0.7) ? 'in_person_event' : 'online_shipment') as IntakeChannel,
      legacyCleanAndPolish: false,
      legacySlabGuard: false,
      cards,
    }
    submissions.push({
      id: `sub-${String(submissions.length + 1).padStart(4, '0')}`,
      clientId: client.id,
      createdAt,
      tier,
      submissionType: input.submissionType,
      intakeChannel: input.intakeChannel,
      cards,
      pricing: computeSubmissionPricing(input),
      payment: chance(PAYMENT_FAILURE_RATE) ? 'failed' : 'captured',
      batchId: null,
    })
  }
}
submissions.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

// Independent re-derivation of every submission total, in cents, from first
// principles -- proves computeSubmissionPricing() really includes both 15%
// Secursus legs and nothing else is missing or double-counted.
for (const sub of submissions) {
  const p = sub.pricing
  const declaredCents = sub.cards.reduce((sum, c) => sum + toCents(c.declaredValue), 0)
  const expectedInsuranceCents = Math.round(declaredCents * SECURSUS_INSURANCE_RATE) * 2
  check(
    toCents(p.secursusInsuranceTotal) === expectedInsuranceCents,
    `${sub.id}: insurance ${rand(toCents(p.secursusInsuranceTotal))} != 2 x 15% of ${rand(declaredCents)}`,
  )
  const tierMeta = aceTiers.find((t) => t.value === sub.tier)!
  const components =
    toCents(tierMeta.basePriceZAR) * sub.cards.length +
    sub.cards.reduce(
      (sum, c) =>
        sum +
        toCents(ACE_LABEL_OPTIONS.find((o) => o.value === c.labelOption)!.feeZAR) +
        toCents(CLEANING_TIER_OPTIONS.find((o) => o.value === c.cleaningTier)!.feeZAR) +
        (c.requiresSlabGuard ? toCents(SLAB_GUARD_FEE_ZAR) : 0),
      0,
    ) +
    toCents(p.internationalCourierTotal) +
    expectedInsuranceCents
  check(toCents(p.serviceFee) === components, `${sub.id}: service fee ${rand(toCents(p.serviceFee))} != components ${rand(components)}`)
  check(
    toCents(p.total) === toCents(p.serviceFee) + toCents(p.localCourierTotal),
    `${sub.id}: total != service fee + domestic courier`,
  )
  check(
    toCents(p.localCourierTotal) === toCents(DOMESTIC_COURIER_LEG_FEE_ZAR),
    `${sub.id}: domestic return courier ${rand(toCents(p.localCourierTotal))} != R110 (charged for online and in-person alike)`,
  )
}

// ---------------------------------------------------------------------------
// 3. Outbound batches to the UK
// ---------------------------------------------------------------------------

const BATCH_STAGES = [
  { stage: 'Logged', dbStatus: 'preparing' },
  { stage: 'Prepped', dbStatus: 'preparing' },
  { stage: 'Shipped', dbStatus: 'in_transit' },
  { stage: 'Grading', dbStatus: 'at_grader' },
  { stage: 'Returned', dbStatus: 'returning' },
  { stage: 'Dispatched', dbStatus: 'completed' },
] as const
type BatchStage = (typeof BATCH_STAGES)[number]['stage']

interface SimBatch {
  id: string
  kind: 'weekly' | 'individual'
  cutoff: Date
  submissionIds: string[]
  cardCount: number
  declaredCents: number
  timeline: Record<BatchStage, Date>
  currentStage: BatchStage | 'Open'
}

function turnaroundDays(tier: SubmissionTier): number {
  const text = aceTiers.find((t) => t.value === tier)?.turnaround ?? ''
  const match = text.match(/\d+/)
  return match ? Number(match[0]) : 30
}

function buildTimeline(cutoff: Date, slowestTurnaround: number): Record<BatchStage, Date> {
  const logged = cutoff
  const prepped = addDays(logged, randInt(1, 2))
  const shipped = addDays(prepped, randInt(0, 1))
  const grading = addDays(shipped, randInt(3, 5))
  const returned = addDays(grading, slowestTurnaround + randInt(0, 4))
  const dispatched = addDays(returned, randInt(4, 7))
  return { Logged: logged, Prepped: prepped, Shipped: shipped, Grading: grading, Returned: returned, Dispatched: dispatched }
}

function stageAsOf(timeline: Record<BatchStage, Date>, now: Date): BatchStage | 'Open' {
  let current: BatchStage | 'Open' = 'Open'
  for (const { stage } of BATCH_STAGES) if (timeline[stage] <= now) current = stage
  return current
}

const batches: SimBatch[] = []
const paidSubmissions = submissions.filter((s) => s.payment === 'captured')

// Pooled ("batch") submissions leave in a weekly consolidated shipment every
// Monday; each covers everything paid before that Monday's cutoff.
const firstMonday = new Date(WINDOW_START)
while (firstMonday.getUTCDay() !== 1) firstMonday.setUTCDate(firstMonday.getUTCDate() + 1)
let previousCutoff = WINDOW_START
for (let cutoff = firstMonday; cutoff <= addDays(NOW, 7); cutoff = addDays(cutoff, 7)) {
  const members = paidSubmissions.filter(
    (s) => s.submissionType === 'batch' && s.createdAt > previousCutoff && s.createdAt <= cutoff,
  )
  previousCutoff = cutoff
  if (members.length === 0) continue
  const id = `batch-W${isoDay(cutoff)}`
  const timeline = buildTimeline(cutoff, Math.max(...members.map((m) => turnaroundDays(m.tier))))
  for (const m of members) m.batchId = id
  batches.push({
    id,
    kind: 'weekly',
    cutoff,
    submissionIds: members.map((m) => m.id),
    cardCount: members.reduce((sum, m) => sum + m.cards.length, 0),
    declaredCents: members.reduce((sum, m) => sum + toCents(m.pricing.totalDeclaredValueZAR), 0),
    timeline,
    currentStage: stageAsOf(timeline, NOW),
  })
}

// Individual submissions pay the dedicated-dispatch courier rate and ship on
// their own, 1-2 days after payment.
for (const sub of paidSubmissions.filter((s) => s.submissionType === 'individual')) {
  const cutoff = addDays(sub.createdAt, randInt(1, 2))
  const timeline = buildTimeline(cutoff, turnaroundDays(sub.tier))
  sub.batchId = `solo-${sub.id}`
  batches.push({
    id: sub.batchId,
    kind: 'individual',
    cutoff,
    submissionIds: [sub.id],
    cardCount: sub.cards.length,
    declaredCents: toCents(sub.pricing.totalDeclaredValueZAR),
    timeline,
    currentStage: stageAsOf(timeline, NOW),
  })
}
batches.sort((a, b) => a.cutoff.getTime() - b.cutoff.getTime())

for (const sub of paidSubmissions) check(sub.batchId !== null, `${sub.id}: paid but never assigned to an outbound batch`)
for (const sub of submissions.filter((s) => s.payment === 'failed')) check(sub.batchId === null, `${sub.id}: unpaid but shipped`)
for (const batch of batches) {
  const times = BATCH_STAGES.map(({ stage }) => batch.timeline[stage].getTime())
  check(times.every((t, i) => i === 0 || t >= times[i - 1]), `${batch.id}: stage timestamps go backwards`)
}
check(
  batches.reduce((sum, b) => sum + b.submissionIds.length, 0) === paidSubmissions.length,
  'every paid submission must be in exactly one batch',
)

// ---------------------------------------------------------------------------
// 4. Shop
// ---------------------------------------------------------------------------

interface SimProduct {
  id: string
  title: string
  category: 'sealed' | 'accessories' | 'graded' | 'cards'
  price: number
  initialStock: number
  stock: number
  sold: number
}

const products: SimProduct[] = [
  ['Semi-rigid card savers (50 pack)', 'accessories', 189, 120],
  ['Penny sleeves (100 pack)', 'accessories', 45, 200],
  ['Team bags (100 pack)', 'accessories', 65, 150],
  ['Graded slab case', 'accessories', 349, 40],
  ['Scarlet & Violet 151 Booster Bundle', 'sealed', 1450, 18],
  ['Evolving Skies Booster Box', 'sealed', 7800, 4],
  ['Crown Zenith Elite Trainer Box', 'sealed', 1650, 10],
  ['Mew ex -- ACE 10 Gem Mint', 'graded', 46000, 1],
  ['Charizard ex -- ACE 10 Gem Mint', 'graded', 12500, 2],
  ['Umbreon VMAX -- ACE 9 Mint', 'graded', 9800, 1],
  ['Pikachu Illustrator Promo -- ACE 8', 'graded', 3900, 3],
  ['Gengar ex -- ACE 10 Gem Mint', 'graded', 2250, 3],
  ['Raw Moonbreon (NM)', 'cards', 4200, 2],
  ['Raw Lugia V Alt Art (NM)', 'cards', 1850, 3],
  ['Raw Bulbasaur Illustration Rare', 'cards', 180, 10],
  ['Raw common bulk lot', 'cards', 60, 25],
].map(([title, category, price, stock], i) => ({
  id: `prod-${String(i + 1).padStart(2, '0')}`,
  title: title as string,
  category: category as SimProduct['category'],
  price: price as number,
  initialStock: stock as number,
  stock: stock as number,
  sold: 0,
}))

interface SimOrder {
  id: string
  clientId: string
  createdAt: Date
  lines: { productId: string; title: string; unitPrice: number; quantity: number }[]
  subtotal: number
  shippingCost: number
  total: number
  taxCollected: number
  payment: PaymentOutcome
}

const orders: SimOrder[] = []
const rejectedAttempts: { reason: string; clientId: string; at: Date }[] = []

/** Mirrors create_order(): all-or-nothing, stock checked and decremented under the same rules. */
function createOrder(clientId: string, createdAt: Date, cart: { productId: string; quantity: number }[]): SimOrder | null {
  const reject = (reason: string) => {
    rejectedAttempts.push({ reason, clientId, at: createdAt })
    return null
  }
  if (cart.length === 0) return reject('Cart is empty')
  const lines: SimOrder['lines'] = []
  for (const item of [...cart].sort((a, b) => a.productId.localeCompare(b.productId))) {
    const product = products.find((p) => p.id === item.productId)
    if (!product) return reject('Product no longer available')
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) return reject('Invalid quantity')
    if (product.stock < item.quantity) return reject(`Not enough stock for "${product.title}"`)
    if (product.category === 'cards' && product.price < 100) return reject(`Raw Card under R100: "${product.title}"`)
    lines.push({ productId: product.id, title: product.title, unitPrice: product.price, quantity: item.quantity })
  }
  // Only reached when every line passed -- same as the RPC raising before any write.
  for (const line of lines) {
    const product = products.find((p) => p.id === line.productId)!
    product.stock -= line.quantity
    product.sold += line.quantity
  }
  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)
  const total = subtotal + SHOP_SHIPPING_FLAT_RATE
  return {
    id: `order-${String(orders.length + 1).padStart(4, '0')}`,
    clientId,
    createdAt,
    lines,
    subtotal,
    shippingCost: SHOP_SHIPPING_FLAT_RATE,
    total,
    taxCollected: Math.round(total * SHOP_TAX_RATE * 100) / 100,
    payment: chance(PAYMENT_FAILURE_RATE) ? 'failed' : 'captured',
  }
}

const shopAttempts: { clientId: string; at: Date; cart: { productId: string; quantity: number }[] }[] = []
for (const client of clients) {
  const attempts = weighted([
    [0, 35],
    [1, 35],
    [2, 20],
    [randInt(3, 5), 10],
  ])
  const activeDays = (NOW.getTime() - client.joinedAt.getTime()) / DAY_MS
  for (let n = 0; n < attempts; n++) {
    const lineCount = weighted([
      [1, 60],
      [2, 30],
      [3, 10],
    ])
    const cart = Array.from({ length: lineCount }, () => {
      const product = weighted<SimProduct>(
        products.map((p) => [p, p.category === 'accessories' ? 6 : p.category === 'graded' ? 1.5 : 2] as [SimProduct, number]),
      )
      return { productId: product.id, quantity: product.category === 'accessories' ? randInt(1, 4) : 1 }
    })
    shopAttempts.push({ clientId: client.id, at: addDays(client.joinedAt, random() * activeDays), cart })
  }
}
// Chronological, so scarce items (1-of-1 slabs) sell to whoever checks out first.
shopAttempts.sort((a, b) => a.at.getTime() - b.at.getTime())
for (const attempt of shopAttempts) {
  const order = createOrder(attempt.clientId, attempt.at, attempt.cart)
  if (!order) continue
  orders.push(order)
  // A failed Payfast payment releases its reserved stock (app/api/webhooks/payfast/route.ts).
  if (order.payment === 'failed') {
    for (const line of order.lines) {
      const product = products.find((p) => p.id === line.productId)!
      product.stock += line.quantity
      product.sold -= line.quantity
    }
  }
}

const paidOrders = orders.filter((o) => o.payment === 'captured')
for (const product of products) {
  const soldPaid = paidOrders.reduce(
    (sum, o) => sum + o.lines.filter((l) => l.productId === product.id).reduce((s, l) => s + l.quantity, 0),
    0,
  )
  check(product.stock >= 0, `${product.id}: stock went negative (${product.stock})`)
  check(product.stock === product.initialStock - soldPaid, `${product.id}: stock ${product.stock} != initial ${product.initialStock} - sold ${soldPaid}`)
}
for (const order of orders) {
  const lineCents = order.lines.reduce((sum, l) => sum + toCents(l.unitPrice) * l.quantity, 0)
  check(toCents(order.subtotal) === lineCents, `${order.id}: subtotal != sum of lines`)
  check(toCents(order.total) === lineCents + toCents(order.shippingCost), `${order.id}: total != subtotal + shipping`)
}
const oosRejections = rejectedAttempts.filter((r) => r.reason.startsWith('Not enough stock'))
const soldOut = products.filter((p) => p.stock === 0)
check(
  soldOut.length === 0 || oosRejections.length > 0 || shopAttempts.length === orders.length,
  'sold-out products exist but no later purchase attempt was blocked',
)

// ---------------------------------------------------------------------------
// 5. Financial ledger
// ---------------------------------------------------------------------------

interface Totals {
  submissions: number
  cards: number
  declared: number
  grading: number
  labels: number
  services: number
  slabGuard: number
  intlCourier: number
  domesticCourier: number
  insurance: number
  submissionCash: number
  submissionVat: number
  orders: number
  shopGoods: number
  shopShipping: number
  shopCash: number
  shopVat: number
}

function emptyTotals(): Totals {
  return {
    submissions: 0,
    cards: 0,
    declared: 0,
    grading: 0,
    labels: 0,
    services: 0,
    slabGuard: 0,
    intlCourier: 0,
    domesticCourier: 0,
    insurance: 0,
    submissionCash: 0,
    submissionVat: 0,
    orders: 0,
    shopGoods: 0,
    shopShipping: 0,
    shopCash: 0,
    shopVat: 0,
  }
}

function addSubmission(t: Totals, s: SimSubmission) {
  const p = s.pricing
  t.submissions++
  t.cards += s.cards.length
  t.declared += toCents(p.totalDeclaredValueZAR)
  t.grading += toCents(p.gradingSubtotal)
  t.labels += toCents(p.labelOptionSubtotal)
  t.services += toCents(p.cleaningSubtotal)
  t.slabGuard += toCents(p.slabGuardSubtotal)
  t.intlCourier += toCents(p.internationalCourierTotal)
  t.domesticCourier += toCents(p.localCourierTotal)
  t.insurance += toCents(p.secursusInsuranceTotal)
  t.submissionCash += toCents(p.total)
  // Same bookkeeping as app/api/submissions/route.ts: VAT on the service fee.
  t.submissionVat += toCents(Math.round(p.serviceFee * SUBMISSION_TAX_RATE * 100) / 100)
}

function addOrder(t: Totals, o: SimOrder) {
  t.orders++
  t.shopGoods += toCents(o.subtotal)
  t.shopShipping += toCents(o.shippingCost)
  t.shopCash += toCents(o.total)
  t.shopVat += toCents(o.taxCollected)
}

const grand = emptyTotals()
const byMonth = new Map<string, Totals>()
const monthOf = (d: Date) => d.toISOString().slice(0, 7)
for (const s of paidSubmissions) {
  addSubmission(grand, s)
  if (!byMonth.has(monthOf(s.createdAt))) byMonth.set(monthOf(s.createdAt), emptyTotals())
  addSubmission(byMonth.get(monthOf(s.createdAt))!, s)
}
for (const o of paidOrders) {
  addOrder(grand, o)
  if (!byMonth.has(monthOf(o.createdAt))) byMonth.set(monthOf(o.createdAt), emptyTotals())
  addOrder(byMonth.get(monthOf(o.createdAt))!, o)
}

// Balance checks: every cent of cash collected is attributed to exactly one line.
const submissionLines = grand.grading + grand.labels + grand.services + grand.slabGuard + grand.intlCourier + grand.domesticCourier + grand.insurance
check(submissionLines === grand.submissionCash, `submission lines ${rand(submissionLines)} != cash ${rand(grand.submissionCash)}`)
check(grand.shopGoods + grand.shopShipping === grand.shopCash, 'shop goods + shipping != shop cash')
check(
  Math.abs(grand.insurance - Math.round(grand.declared * SECURSUS_INSURANCE_RATE) * 2) <= paidSubmissions.length,
  'aggregate insurance is not 30% of aggregate declared value (beyond per-submission rounding)',
)
const monthKeys = [...byMonth.keys()].sort()
for (const key of Object.keys(grand) as (keyof Totals)[]) {
  const monthlySum = monthKeys.reduce((sum, m) => sum + byMonth.get(m)![key], 0)
  check(monthlySum === grand[key], `monthly breakdown of "${key}" does not sum to the 90-day total`)
}

// Coverage still on the road right now: declared value of paid submissions
// whose batch has shipped but not yet been dispatched back to the customer.
const inTransitStages: (BatchStage | 'Open')[] = ['Shipped', 'Grading', 'Returned']
const liveExposure = batches.filter((b) => inTransitStages.includes(b.currentStage)).reduce((sum, b) => sum + b.declaredCents, 0)

// ---------------------------------------------------------------------------
// 6. Report
// ---------------------------------------------------------------------------

const line = (label: string, value: string) => console.log(`  ${label.padEnd(50, '.')} ${value.padStart(18)}`)
const rule = () => console.log(`  ${'-'.repeat(69)}`)

console.log(`\nCuppasCards platform simulation -- seed ${SEED}, ${CLIENT_COUNT} clients, ${WINDOW_DAYS} days`)
console.log(`Window ${isoDay(WINDOW_START)} -> ${isoDay(NOW)} (in memory only; no database writes)\n`)

console.log('ACTIVITY')
line('Clients', String(clients.length))
line('Submissions created', String(submissions.length))
line('  paid / payment failed', `${paidSubmissions.length} / ${submissions.length - paidSubmissions.length}`)
line('  cards submitted (paid)', String(grand.cards))
line('  cards with Slab Guard (paid)', String(paidSubmissions.reduce((n, s) => n + s.pricing.slabGuardCount, 0)))
line(
  '  cards cleaned half / full (paid)',
  `${paidSubmissions.reduce((n, s) => n + s.pricing.halfCleanCount, 0)} / ${paidSubmissions.reduce((n, s) => n + s.pricing.fullCleanCount, 0)}`,
)
line('  in-person drop-offs (paid)', String(paidSubmissions.filter((s) => s.intakeChannel === 'in_person_event').length))
const labelCounts = ACE_LABEL_OPTIONS.map((o) => `${o.label} ${paidSubmissions.reduce((n, s) => n + s.pricing.labelCounts[o.value], 0)}`)
line('  cards per label (paid)', labelCounts.join(', '))
line('Shop checkout attempts', String(shopAttempts.length))
line('  orders created / blocked', `${orders.length} / ${rejectedAttempts.length}`)
line('  blocked: out of stock', String(oosRejections.length))
line('  paid / payment failed (stock released)', `${paidOrders.length} / ${orders.length - paidOrders.length}`)
line('  products sold out', soldOut.length ? soldOut.map((p) => p.id).join(', ') : 'none')

console.log('\nUK BATCHES (state as of today)')
const weekly = batches.filter((b) => b.kind === 'weekly')
line('Weekly consolidated batches', String(weekly.length))
line('Individual dispatches', String(batches.length - weekly.length))
line('  Open (still collecting, next cutoff)', String(batches.filter((b) => b.currentStage === 'Open').length))
for (const { stage, dbStatus } of BATCH_STAGES) {
  const n = batches.filter((b) => b.currentStage === stage).length
  line(`  ${stage} ('${dbStatus}')`, String(n))
}
console.log('\n  Recent weekly batches:')
for (const b of weekly.slice(-6)) {
  const trail = BATCH_STAGES.map(({ stage }) => `${stage[0]}:${isoDay(b.timeline[stage]).slice(5)}`).join(' ')
  console.log(`    ${b.id}  ${String(b.submissionIds.length).padStart(3)} subs  ${String(b.cardCount).padStart(4)} cards  ${b.currentStage.padEnd(10)} ${trail}`)
}

console.log('\nFINANCIALS (ZAR, paid only)')
console.log('  Submissions')
line('    Grading fees', rand(grand.grading))
line('    Label options', rand(grand.labels))
line('    Cleaning (per card)', rand(grand.services))
line('    Slab Guard (R110 per card)', rand(grand.slabGuard))
line('    International courier (2 legs)', rand(grand.intlCourier))
line('    Domestic return courier (every submission)', rand(grand.domesticCourier))
line('    Secursus insurance (2 x 15%)', rand(grand.insurance))
rule()
line('    Submission cash collected', rand(grand.submissionCash))
line('    VAT booked on service fees (15%)', rand(grand.submissionVat))
console.log('  Shop')
line('    Goods', rand(grand.shopGoods))
line('    Shipping (flat rate)', rand(grand.shopShipping))
rule()
line('    Shop cash collected', rand(grand.shopCash))
line('    VAT booked on shop orders (15%)', rand(grand.shopVat))
console.log('  Pass-through liabilities (collected, owed onward)')
line('    Owed to Secursus (insurance premiums)', rand(grand.insurance))
line('    Owed to couriers (intl legs + domestic return)', rand(grand.intlCourier + grand.domesticCourier))
line('    Declared value covered, 90 days', rand(grand.declared))
line('    Declared value on the road right now', rand(liveExposure))
console.log('  Totals')
line('    Total cash collected', rand(grand.submissionCash + grand.shopCash))
line('    Less pass-through liabilities', rand(-(grand.insurance + grand.intlCourier + grand.domesticCourier)))
rule()
line('    Retained revenue (before grader costs & COGS)', rand(grand.submissionCash + grand.shopCash - grand.insurance - grand.intlCourier - grand.domesticCourier))

console.log('\n  By month:')
console.log(`    ${'Month'.padEnd(8)} ${'Subs'.padStart(5)} ${'Submission cash'.padStart(18)} ${'Insurance'.padStart(16)} ${'Orders'.padStart(7)} ${'Shop cash'.padStart(16)}`)
for (const m of monthKeys) {
  const t = byMonth.get(m)!
  console.log(
    `    ${m.padEnd(8)} ${String(t.submissions).padStart(5)} ${rand(t.submissionCash).padStart(18)} ${rand(t.insurance).padStart(16)} ${String(t.orders).padStart(7)} ${rand(t.shopCash).padStart(16)}`,
  )
}

console.log(`\nINVARIANTS: ${checksRun - failures.length}/${checksRun} passed`)
if (failures.length > 0) {
  for (const f of failures.slice(0, 25)) console.log(`  FAIL ${f}`)
  if (failures.length > 25) console.log(`  ...and ${failures.length - 25} more`)
  process.exitCode = 1
} else {
  console.log('  Every submission total includes both 15% Secursus legs; stock never went negative and')
  console.log('  out-of-stock purchases were blocked; every cent of cash maps to exactly one ledger line;')
  console.log('  and the monthly breakdown sums to the 90-day totals.')
}
