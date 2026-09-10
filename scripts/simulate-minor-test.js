#!/usr/bin/env node
/**
 * Internal Minor Test — end-to-end simulation of 7 [TEST-MINOR] customer
 * profiles exercising the real grading-submission and shop-checkout code
 * paths, so an admin can eyeball the result in the Admin dashboard before
 * a wider rollout.
 *
 * What this DOES do for real, exactly like a live customer would:
 *   - Creates 7 real (but clearly fake) Supabase Auth users and signs in as
 *     each one with the anon key, so every write below goes through the
 *     same RLS policies a real browser session would.
 *   - Calls the same RPC the shop checkout page calls (public.create_order,
 *     app/api/shop/orders/route.ts) for the shop-purchase profiles, so
 *     stock is really, atomically decremented by the real function —
 *     nothing here reimplements that logic.
 *   - Inserts submissions/submission_items the same shape
 *     app/api/submissions/route.ts inserts, and calls the same
 *     post_submission_ledger_entries RPC it calls.
 *
 * What this deliberately does NOT do: trigger a real Stripe or PayFast
 * charge. This script must never move real money, so instead of driving a
 * card through the payment provider it stamps payment_status directly with
 * the service-role key — standing in for the step the Stripe/PayFast
 * webhook (app/api/webhooks/stripe/route.ts, .../payfast/route.ts) would
 * otherwise perform. Every other part of the flow is real.
 *
 * Scenario naming note: submissions (grading) and orders (shop) are
 * separate tables with separate checkout endpoints — there is no schema
 * support for one combined order mixing a grading fee and a shop line item.
 * "Mixed path" below is simulated as one customer completing both flows,
 * back to back, in the same run — the closest honest match to the request,
 * not a single merged order.
 *
 * Usage:
 *   node scripts/simulate-minor-test.js
 *
 * Requires .env.local at the repo root with NEXT_PUBLIC_SUPABASE_URL,
 * NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY (same file
 * scripts/seed-sports-cards.js already reads).
 *
 * Writes scripts/.minor-test-manifest.json listing exactly what it created
 * (user ids, submission/order ids, ledger entry ids, product stock deltas).
 * Companion teardown script:
 *   node scripts/teardown-minor-test.js
 * Run it when you're done — it restores any shop stock this script
 * decremented and explicitly deletes every [TEST-MINOR] user's orders,
 * submissions, and addresses before deleting the user itself (production's
 * profiles table is missing the on-delete-cascade FKs the migration files
 * declare, so deleting the user alone silently leaves those rows behind —
 * see teardown-minor-test.js's header for how this was found).
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { createClient } = require('@supabase/supabase-js')

const PREFIX = '[TEST-MINOR]'
const EMAIL_DOMAIN = 'testminor.invalid' // RFC 2606 reserved TLD — guaranteed non-deliverable, unambiguously fake
const MANIFEST_PATH = path.join(__dirname, '.minor-test-manifest.json')
const SHIPPING_FLAT_RATE = 6.5 // mirrors app/shop/checkout/page.tsx's SHIPPING_FLAT_RATE

// Mirrors lib/submission-types.ts's TIER_OPTIONS_BY_COMPANY (basePriceGBP /
// basePriceZAR). Duplicated here by hand rather than imported, since this is
// a plain Node script and that file is TS behind the @/ path alias — same
// "kept in sync by hand" tradeoff 0034_accounting_foundations.sql's own
// tax-rate comment already accepts for this codebase's constants.
const TIER_PRICES = {
  PCG: {
    authentication: { label: 'Authentication', gbp: 11, zar: 260 },
    bulk: { label: 'Bulk', gbp: 8, zar: 185 },
    standard: { label: 'Standard', gbp: 13, zar: 315 },
    express: { label: 'Express', gbp: 28, zar: 650 },
  },
  ACE: {
    ace_value: { label: 'Value', gbp: 16, zar: 370 },
    ace_basic: { label: 'Basic', gbp: 19, zar: 445 },
    ace_standard: { label: 'Standard', gbp: 27, zar: 630 },
  },
}

const SA_TAX_RATE = 0.15 // REGION_TAX_RATE.sa (lib/shop/product-type.ts)
const SA_EXCHANGE_RATE_TO_ZAR = 1 // REGION_EXCHANGE_RATE_TO_ZAR.sa

const PROFILES = [
  { n: 1, label: 'User 1', scenario: 'grading', company: 'PCG', tier: 'standard' },
  { n: 2, label: 'User 2', scenario: 'grading', company: 'PCG', tier: 'authentication' },
  { n: 3, label: 'User 3', scenario: 'grading', company: 'ACE', tier: 'ace_basic' },
  { n: 4, label: 'User 4', scenario: 'grading', company: 'ACE', tier: 'ace_value' },
  { n: 5, label: 'User 5', scenario: 'shop' },
  { n: 6, label: 'User 6', scenario: 'shop' },
  { n: 7, label: 'User 7', scenario: 'mixed', company: 'PCG', tier: 'express' },
]

function loadEnv(envPath) {
  const text = fs.readFileSync(envPath, 'utf8')
  return Object.fromEntries(
    text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !line.startsWith('#'))
      .map((line) => {
        const idx = line.indexOf('=')
        return [line.slice(0, idx), line.slice(idx + 1)]
      }),
  )
}

async function createTestUser(admin, profile) {
  const email = `test-minor-${profile.n}@${EMAIL_DOMAIN}`
  const password = crypto.randomBytes(18).toString('hex')
  const fullName = `${PREFIX} ${profile.label}`

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // no confirmation email is sent either way — admin.createUser never dispatches auth email
    user_metadata: { full_name: fullName },
  })
  if (error) throw new Error(`createUser(${email}) failed: ${error.message}`)

  return { id: data.user.id, email, password, fullName }
}

function signInAsUser(url, anonKey, email, password) {
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  return client.auth.signInWithPassword({ email, password }).then(({ error }) => {
    if (error) throw new Error(`signIn(${email}) failed: ${error.message}`)
    return client
  })
}

async function createAddress(userClient, userId, profile) {
  const { data, error } = await userClient
    .from('addresses')
    .insert({
      user_id: userId,
      label: `${PREFIX} Shipping`,
      full_name: `${PREFIX} ${profile.label}`,
      line1: '1 Test Street',
      city: 'Cape Town',
      state: 'Western Cape',
      postal: '8001',
      country: 'ZA',
      is_default: true,
    })
    .select('*')
    .single()
  if (error) throw new Error(`create address failed: ${error.message}`)
  return data
}

/**
 * Mirrors app/api/submissions/route.ts's insert shape and its call to
 * post_submission_ledger_entries. Charges in ZAR (region 'sa', the only
 * country-of-origin option currently shown in the wizard) — service_fee is
 * the real per-card grading fee for the given company/tier; the GBP anchor
 * price (dual Pound/Rand pricing from components/submit/step-grader-tier.tsx)
 * is recorded in `notes` since submissions has no dedicated GBP column.
 */
async function runGradingSubmission(userClient, adminClient, { userId, address, profile }) {
  const tierInfo = TIER_PRICES[profile.company][profile.tier]
  const serviceFee = tierInfo.zar
  const taxCollected = Math.round(serviceFee * SA_TAX_RATE * 100) / 100

  const { data: submission, error: submissionError } = await userClient
    .from('submissions')
    .insert({
      user_id: userId,
      grading_company: profile.company,
      tier: profile.tier,
      region: 'sa',
      status: 'received',
      courier: 'Test Courier (Internal Minor Test)',
      address_id: address.id,
      shipping_address_snapshot: address,
      total_declared_value: 75,
      service_fee: serviceFee,
      payment_status: 'pending',
      tax_rate: SA_TAX_RATE,
      tax_collected: taxCollected,
      exchange_rate_to_zar: SA_EXCHANGE_RATE_TO_ZAR,
      needs_clean_and_polish: false,
      needs_semi_rigids: false,
      interested_in_consignment: false,
      notes: `${PREFIX} Internal Minor Test simulation — ${profile.company} ${tierInfo.label} tier priced at £${tierInfo.gbp.toFixed(2)}/card (Est. conversion: R ${tierInfo.zar.toFixed(2)}).`,
    })
    .select('id, qr_code_token')
    .single()
  if (submissionError) throw new Error(`insert submission failed: ${submissionError.message}`)

  const { error: itemError } = await userClient.from('submission_items').insert({
    submission_id: submission.id,
    card_type: 'pokemon',
    card_name: `${PREFIX} Charizard`,
    set_name: 'Base Set (1999)',
    card_number: '4/102',
    declared_value: 75,
    pre_check_opt_in: false,
  })
  if (itemError) throw new Error(`insert submission_items failed: ${itemError.message}`)

  // Best-effort, same as the real route — a bookkeeping failure shouldn't
  // fail the submission itself.
  const { error: ledgerError } = await userClient.rpc('post_submission_ledger_entries', {
    p_submission_id: submission.id,
    p_grading_company: profile.company,
    p_tier: profile.tier,
    p_fee_zar: serviceFee * SA_EXCHANGE_RATE_TO_ZAR,
    p_tax_collected_zar: taxCollected * SA_EXCHANGE_RATE_TO_ZAR,
  })
  if (ledgerError) console.warn(`  [warn] ledger posting failed for submission ${submission.id}: ${ledgerError.message}`)

  // ledger_entries is admin-only RLS — read back with the service-role
  // client so teardown can delete these exact rows later (they don't carry
  // a [TEST-MINOR] marker of their own, and submission_id is nulled, not
  // cascaded, once the submission is deleted).
  const { data: ledgerRows } = await adminClient.from('ledger_entries').select('id').eq('submission_id', submission.id)

  // Stands in for the Stripe/PayFast webhook capturing payment — this
  // script never drives a real charge, so the service-role client stamps
  // the result directly instead.
  const { error: captureError } = await adminClient
    .from('submissions')
    .update({ payment_status: 'captured' })
    .eq('id', submission.id)
  if (captureError) console.warn(`  [warn] could not stamp payment_status captured: ${captureError.message}`)

  return { submissionId: submission.id, qrCodeToken: submission.qr_code_token, ledgerEntryIds: (ledgerRows ?? []).map((r) => r.id) }
}

/**
 * Calls the real create_order() RPC (supabase/migrations/0034_accounting_
 * foundations.sql) exactly as app/api/shop/orders/route.ts does — price,
 * stock check, and the atomic decrement all happen inside that function,
 * for real, under this test user's own session.
 */
async function runShopPurchase(userClient, adminClient, { address, product }) {
  const { data: order, error: orderError } = await userClient.rpc('create_order', {
    p_address_id: address.id,
    p_shipping_cost: SHIPPING_FLAT_RATE,
    p_items: [{ product_id: product.id, quantity: 1 }],
  })
  if (orderError) throw new Error(`create_order failed for product "${product.title}": ${orderError.message}`)

  // Stands in for the Stripe/PayFast webhook — see runGradingSubmission's
  // comment above.
  const { error: captureError } = await adminClient
    .from('orders')
    .update({ status: 'paid', payment_status: 'captured' })
    .eq('id', order.id)
  if (captureError) console.warn(`  [warn] could not stamp order paid: ${captureError.message}`)

  return { orderId: order.id, total: order.total, productId: product.id, productTitle: product.title, quantity: 1 }
}

async function main() {
  const envPath = path.join(__dirname, '..', '.env.local')
  const env = loadEnv(envPath)
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are all required in .env.local')
  }

  const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Candidate SA-region shop products for the 2 shop-only + 1 mixed
  // profile's purchases (3 real orders of quantity 1 each).
  const { data: products, error: productsError } = await adminClient
    .from('products')
    .select('id, title, stock')
    .eq('region', 'sa')
    .eq('is_active', true)
    .gt('stock', 0)
    .order('stock', { ascending: false })
    .limit(5)
  if (productsError) throw new Error(`could not load candidate products: ${productsError.message}`)
  if (!products || products.length === 0) {
    throw new Error('No active, in-stock SA-region products found — add at least one before running the shop scenarios.')
  }
  const pickProduct = (i) => products[i % products.length]

  const manifest = { createdAt: new Date().toISOString(), users: [] }
  const results = []
  let shopPurchaseIndex = 0

  for (const profile of PROFILES) {
    console.log(`\n--- ${profile.label} (${profile.scenario}) ---`)
    const userRecord = { n: profile.n, label: profile.label, scenario: profile.scenario, stockDeltas: [], ledgerEntryIds: [] }
    try {
      const user = await createTestUser(adminClient, profile)
      userRecord.id = user.id
      userRecord.email = user.email
      console.log(`  created auth user ${user.email} (${user.id})`)

      const userClient = await signInAsUser(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, user.email, user.password)
      const address = await createAddress(userClient, user.id, profile)
      console.log(`  created address ${address.id}`)

      if (profile.scenario === 'grading' || profile.scenario === 'mixed') {
        const grading = await runGradingSubmission(userClient, adminClient, { userId: user.id, address, profile })
        userRecord.submissionId = grading.submissionId
        userRecord.ledgerEntryIds = grading.ledgerEntryIds
        console.log(`  submission ${grading.submissionId} (${profile.company} ${profile.tier}) — payment_status captured`)
      }

      if (profile.scenario === 'shop' || profile.scenario === 'mixed') {
        const product = pickProduct(shopPurchaseIndex)
        shopPurchaseIndex += 1
        const purchase = await runShopPurchase(userClient, adminClient, { address, product })
        userRecord.orderId = purchase.orderId
        userRecord.stockDeltas.push({ productId: purchase.productId, quantity: purchase.quantity })
        console.log(`  order ${purchase.orderId} — "${purchase.productTitle}" × 1 (stock decremented for real) — status paid`)
      }

      results.push({ ...userRecord, ok: true })
    } catch (err) {
      console.error(`  [FAILED] ${err.message}`)
      results.push({ ...userRecord, ok: false, error: err.message })
    }
    manifest.users.push(userRecord)
  }

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2))

  const succeeded = results.filter((r) => r.ok).length
  console.log(`\n=== Summary: ${succeeded}/${PROFILES.length} profiles completed ===`)
  for (const r of results) {
    const status = r.ok ? 'OK' : `FAILED (${r.error})`
    const ref = r.submissionId ? `submission ${r.submissionId}` : r.orderId ? `order ${r.orderId}` : '—'
    console.log(`  ${r.label.padEnd(8)} ${r.scenario.padEnd(9)} ${status.padEnd(40)} ${ref}`)
  }

  console.log(`\nManifest written to ${MANIFEST_PATH}`)
  console.log('When you\'re done reviewing this in the Admin dashboard, run:')
  console.log('  node scripts/teardown-minor-test.js')

  if (succeeded < PROFILES.length) process.exitCode = 1
}

module.exports = {
  PREFIX,
  EMAIL_DOMAIN,
  MANIFEST_PATH,
  SHIPPING_FLAT_RATE,
  TIER_PRICES,
  SA_TAX_RATE,
  SA_EXCHANGE_RATE_TO_ZAR,
  PROFILES,
  loadEnv,
  signInAsUser,
  createAddress,
  runGradingSubmission,
  runShopPurchase,
}

// scripts/resume-minor-test.js requires the helpers above without wanting
// this file's own 7-profile run to fire.
if (require.main === module) {
  main().catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
}
