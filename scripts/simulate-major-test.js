#!/usr/bin/env node
/**
 * MAJOR SYSTEMS TEST — a heavier-load, edge-case-driven sibling to
 * scripts/simulate-minor-test.js. 15 [TEST-MAJOR] profiles exercising the
 * real grading-submission and shop-checkout code paths, deliberately
 * including cases meant to break something:
 *   - draining a limited-stock product to 0 via sequential real purchases,
 *     then proving the next purchase is genuinely rejected by create_order()
 *     rather than silently overselling;
 *   - a submission that sets both the bulk "Clean and Polish" add-on and a
 *     per-card "pre-grading preparation" flag at once — client-side
 *     (components/submit/step-addons.tsx) these are mutually exclusive, but
 *     there is no CHECK constraint or server-side validation enforcing
 *     that (confirmed by reading app/api/submissions/route.ts), so this is
 *     expected to succeed and is recorded as a real finding, not a bug in
 *     this script;
 *   - a Sports Card submission with no catalog match — card_type
 *     'sports_card', a real sport, externalCardId/externalSource left null
 *     — the manual-fallback path a customer hits when the search comes up
 *     empty (see card-shipment-row.tsx's own "not in our catalog" UI).
 *
 * Shop purchases in this test run against two DEDICATED, throwaway
 * [TEST-MAJOR]-prefixed products this script creates itself (see
 * createTestProducts), not the real catalog — every real product's
 * cost_basis is null right now (confirmed by querying it directly), so
 * buying real products would make a truthful margin report impossible, and
 * draining a real product to 0 would be visible to real customers even if
 * only briefly. These test products, and the real cost_basis this script
 * gives them, are what scripts/report-major-test.js's financial report is
 * computed from.
 *
 * Like simulate-minor-test.js: every write goes through a real signed-in
 * test user's own RLS-scoped session (real create_order()/submissions
 * inserts), but no real Stripe/PayFast charge is ever triggered — payment
 * capture is stamped directly with the service-role key.
 *
 * Usage:
 *   node scripts/simulate-major-test.js
 *
 * Requires the same .env.local as simulate-minor-test.js. Writes
 * scripts/.major-test-manifest.json (users, products, submissions, orders,
 * ledger entries, stock deltas, and the two explicit test findings) for
 * scripts/report-major-test.js and scripts/teardown-major.js to consume.
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { createClient } = require('@supabase/supabase-js')
const { loadEnv, signInAsUser, createAddress, TIER_PRICES, SA_TAX_RATE, SA_EXCHANGE_RATE_TO_ZAR } = require('./simulate-minor-test')

const PREFIX = '[TEST-MAJOR]'
const EMAIL_DOMAIN = 'testmajor.invalid'
const MANIFEST_PATH = path.join(__dirname, '.major-test-manifest.json')
const SHIPPING_FLAT_RATE = 6.5

const TEST_PRODUCT_DEFS = {
  drain: {
    title: `${PREFIX} Drain Target — Limited Stock Test Item`,
    price: 150,
    cost_basis: 60, // real, explicit cost so the margin report has a genuine number instead of null
    stock: 3, // exactly enough for 3 successful buys; a 4th must be rejected
  },
  bulk: {
    title: `${PREFIX} Heavy Load Test Item`,
    price: 220,
    cost_basis: 90,
    stock: 50,
  },
}

// 3 PCG + 3 ACE normal grading, 1 PCG add-on-conflict, 1 ACE manual-fallback
// sports card, 4 sequential drain-product purchases (last expected to
// fail), 1 plain bulk-product purchase, 2 mixed (grading + bulk-product
// shop) profiles -- 15 total, every required scenario covered at least once.
const PROFILES = [
  { n: 1, label: 'User 1', scenario: 'grading', company: 'PCG', tier: 'standard' },
  { n: 2, label: 'User 2', scenario: 'grading', company: 'PCG', tier: 'authentication' },
  { n: 3, label: 'User 3', scenario: 'grading', company: 'PCG', tier: 'express' },
  { n: 4, label: 'User 4', scenario: 'grading', company: 'ACE', tier: 'ace_basic' },
  { n: 5, label: 'User 5', scenario: 'grading', company: 'ACE', tier: 'ace_standard' },
  { n: 6, label: 'User 6', scenario: 'grading', company: 'ACE', tier: 'ace_value' },
  { n: 7, label: 'User 7', scenario: 'addon-conflict', company: 'PCG', tier: 'standard' },
  { n: 8, label: 'User 8', scenario: 'manual-fallback-sports', company: 'ACE', tier: 'ace_basic', sport: 'nba' },
  { n: 9, label: 'User 9', scenario: 'shop-drain', productKey: 'drain', quantity: 1 },
  { n: 10, label: 'User 10', scenario: 'shop-drain', productKey: 'drain', quantity: 1 },
  { n: 11, label: 'User 11', scenario: 'shop-drain', productKey: 'drain', quantity: 1 },
  { n: 12, label: 'User 12', scenario: 'shop-drain-expect-fail', productKey: 'drain', quantity: 1 },
  { n: 13, label: 'User 13', scenario: 'shop', productKey: 'bulk', quantity: 2 },
  { n: 14, label: 'User 14', scenario: 'mixed', company: 'PCG', tier: 'authentication', productKey: 'bulk', quantity: 1 },
  { n: 15, label: 'User 15', scenario: 'mixed', company: 'ACE', tier: 'ace_value', productKey: 'bulk', quantity: 3 },
]

async function createTestUser(admin, profile) {
  const email = `test-major-${profile.n}@${EMAIL_DOMAIN}`
  const password = crypto.randomBytes(18).toString('hex')
  const fullName = `${PREFIX} ${profile.label}`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (error) throw new Error(`createUser(${email}) failed: ${error.message}`)
  return { id: data.user.id, email, password, fullName }
}

async function createTestProducts(admin) {
  const products = {}
  for (const [key, def] of Object.entries(TEST_PRODUCT_DEFS)) {
    const { data, error } = await admin
      .from('products')
      .insert({
        title: def.title,
        description: `${PREFIX} throwaway product created by scripts/simulate-major-test.js — safe to delete any time.`,
        category: 'accessories',
        price: def.price,
        cost_basis: def.cost_basis,
        stock: def.stock,
        region: 'sa',
        is_active: true,
      })
      .select('id, title, price, cost_basis, stock')
      .single()
    if (error) throw new Error(`could not create test product "${def.title}": ${error.message}`)
    products[key] = data
    console.log(`Created test product [${key}] "${data.title}" (${data.id}) — stock ${data.stock}, cost R${def.cost_basis}, price R${def.price}`)
  }
  return products
}

/**
 * Generalizes simulate-minor-test.js's runGradingSubmission with two extra,
 * deliberately edge-case knobs: conflictAddOns (sets needs_clean_and_polish
 * AND the item's pre_check_opt_in at once, to prove the backend doesn't
 * reject that combination) and sportsFallback (a card_type 'sports_card'
 * item with no external catalog match at all).
 */
async function runGradingSubmission(userClient, adminClient, { userId, address, profile }) {
  const tierInfo = TIER_PRICES[profile.company][profile.tier]
  const serviceFee = tierInfo.zar
  const taxCollected = Math.round(serviceFee * SA_TAX_RATE * 100) / 100
  const conflictAddOns = profile.scenario === 'addon-conflict'
  const sportsFallback = profile.scenario === 'manual-fallback-sports'

  const { data: submission, error: submissionError } = await userClient
    .from('submissions')
    .insert({
      user_id: userId,
      grading_company: profile.company,
      tier: profile.tier,
      region: 'sa',
      status: 'received',
      courier: 'Test Courier (Major Systems Test)',
      address_id: address.id,
      shipping_address_snapshot: address,
      total_declared_value: 75,
      service_fee: serviceFee,
      payment_status: 'pending',
      tax_rate: SA_TAX_RATE,
      tax_collected: taxCollected,
      exchange_rate_to_zar: SA_EXCHANGE_RATE_TO_ZAR,
      needs_clean_and_polish: conflictAddOns, // see header: no backend check stops this pairing with the item-level flag below
      needs_semi_rigids: false,
      interested_in_consignment: false,
      notes: `${PREFIX} Major systems test — ${profile.company} ${tierInfo.label} tier priced at £${tierInfo.gbp.toFixed(2)}/card (Est. conversion: R ${tierInfo.zar.toFixed(2)}).${conflictAddOns ? ' [ADD-ON CONFLICT TEST: needs_clean_and_polish=true AND item.pre_check_opt_in=true]' : ''}${sportsFallback ? ' [MANUAL FALLBACK TEST: no external catalog match]' : ''}`,
    })
    .select('id, qr_code_token')
    .single()
  if (submissionError) throw new Error(`insert submission failed: ${submissionError.message}`)

  const itemPayload = sportsFallback
    ? {
        submission_id: submission.id,
        card_type: 'sports_card',
        sport: profile.sport,
        card_name: `${PREFIX} Unlisted Player`,
        set_name: 'Not specified', // mirrors card-shipment-row.tsx's UNSPECIFIED_SET fallback -- no set field left to type into, no catalog match either
        card_number: null,
        declared_value: 75,
        pre_check_opt_in: false,
      }
    : {
        submission_id: submission.id,
        card_type: 'pokemon',
        card_name: `${PREFIX} Charizard`,
        set_name: 'Base Set (1999)',
        card_number: '4/102',
        declared_value: 75,
        pre_check_opt_in: conflictAddOns,
      }

  const { error: itemError } = await userClient.from('submission_items').insert(itemPayload)
  if (itemError) throw new Error(`insert submission_items failed: ${itemError.message}`)

  let addOnConflictPersisted = null
  if (conflictAddOns) {
    // Read back with the service-role client to prove (or disprove) that
    // the conflicting pair actually persisted, rather than just asserting
    // what we inserted.
    const [{ data: subRow }, { data: itemRow }] = await Promise.all([
      adminClient.from('submissions').select('needs_clean_and_polish').eq('id', submission.id).single(),
      adminClient.from('submission_items').select('pre_check_opt_in').eq('submission_id', submission.id).single(),
    ])
    addOnConflictPersisted = Boolean(subRow?.needs_clean_and_polish) && Boolean(itemRow?.pre_check_opt_in)
  }

  const { error: ledgerError } = await userClient.rpc('post_submission_ledger_entries', {
    p_submission_id: submission.id,
    p_grading_company: profile.company,
    p_tier: profile.tier,
    p_fee_zar: serviceFee * SA_EXCHANGE_RATE_TO_ZAR,
    p_tax_collected_zar: taxCollected * SA_EXCHANGE_RATE_TO_ZAR,
  })
  if (ledgerError) console.warn(`  [warn] ledger posting failed for submission ${submission.id}: ${ledgerError.message}`)

  const { data: ledgerRows } = await adminClient.from('ledger_entries').select('id').eq('submission_id', submission.id)

  const { error: captureError } = await adminClient
    .from('submissions')
    .update({ payment_status: 'captured' })
    .eq('id', submission.id)
  if (captureError) console.warn(`  [warn] could not stamp payment_status captured: ${captureError.message}`)

  return {
    submissionId: submission.id,
    serviceFeeZar: serviceFee,
    ledgerEntryIds: (ledgerRows ?? []).map((r) => r.id),
    addOnConflictPersisted,
  }
}

async function runShopPurchase(userClient, adminClient, { address, product, quantity }) {
  const { data: order, error: orderError } = await userClient.rpc('create_order', {
    p_address_id: address.id,
    p_shipping_cost: SHIPPING_FLAT_RATE,
    p_items: [{ product_id: product.id, quantity }],
  })
  if (orderError) throw new Error(orderError.message) // caller decides whether this is expected

  const { error: captureError } = await adminClient
    .from('orders')
    .update({ status: 'paid', payment_status: 'captured' })
    .eq('id', order.id)
  if (captureError) console.warn(`  [warn] could not stamp order paid: ${captureError.message}`)

  return { orderId: order.id, total: order.total, productId: product.id, productTitle: product.title, quantity }
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

  console.log('=== Creating dedicated [TEST-MAJOR] shop products ===')
  const products = await createTestProducts(adminClient)

  const manifest = {
    createdAt: new Date().toISOString(),
    products: Object.entries(products).map(([key, p]) => ({ key, ...p })),
    users: [],
    findings: {},
  }
  const results = []

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

      if (['grading', 'addon-conflict', 'manual-fallback-sports', 'mixed'].includes(profile.scenario)) {
        const grading = await runGradingSubmission(userClient, adminClient, { userId: user.id, address, profile })
        userRecord.submissionId = grading.submissionId
        userRecord.serviceFeeZar = grading.serviceFeeZar
        userRecord.ledgerEntryIds = grading.ledgerEntryIds
        console.log(`  submission ${grading.submissionId} (${profile.company} ${profile.tier}) — payment_status captured`)
        if (profile.scenario === 'addon-conflict') {
          manifest.findings.addOnConflictPersisted = grading.addOnConflictPersisted
          console.log(
            `  [FINDING] both needs_clean_and_polish and item.pre_check_opt_in persisted as true simultaneously: ${grading.addOnConflictPersisted}`,
          )
        }
        if (profile.scenario === 'manual-fallback-sports') {
          console.log('  [FINDING] manual-fallback sports card item inserted with externalCardId/externalSource left null')
        }
      }

      if (['shop-drain', 'shop-drain-expect-fail', 'shop', 'mixed'].includes(profile.scenario)) {
        const product = products[profile.productKey]
        try {
          const purchase = await runShopPurchase(userClient, adminClient, { address, product, quantity: profile.quantity })
          userRecord.orderId = purchase.orderId
          userRecord.stockDeltas.push({ productId: purchase.productId, quantity: purchase.quantity })
          console.log(`  order ${purchase.orderId} — "${purchase.productTitle}" × ${purchase.quantity} — status paid`)
          if (profile.scenario === 'shop-drain-expect-fail') {
            manifest.findings.stockRejectionWorked = false
            console.warn('  [FINDING] expected this purchase to be REJECTED for insufficient stock, but it SUCCEEDED — possible overselling bug')
          }
        } catch (purchaseErr) {
          if (profile.scenario === 'shop-drain-expect-fail') {
            manifest.findings.stockRejectionWorked = true
            manifest.findings.stockRejectionMessage = purchaseErr.message
            console.log(`  [FINDING] purchase correctly rejected once stock hit 0: "${purchaseErr.message}"`)
          } else {
            throw purchaseErr
          }
        }
      }

      results.push({ ...userRecord, ok: true })
    } catch (err) {
      console.error(`  [FAILED] ${err.message}`)
      results.push({ ...userRecord, ok: false, error: err.message })
    }
    manifest.users.push(userRecord)
  }

  // Confirm the drain product actually reached 0, independent of the
  // per-purchase accounting above.
  const { data: drainProduct } = await adminClient.from('products').select('stock').eq('id', products.drain.id).single()
  manifest.findings.drainProductFinalStock = drainProduct?.stock ?? null
  console.log(`\n[FINDING] drain product final stock: ${manifest.findings.drainProductFinalStock} (expected 0)`)

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2))

  const succeeded = results.filter((r) => r.ok).length
  console.log(`\n=== Summary: ${succeeded}/${PROFILES.length} profiles completed ===`)
  for (const r of results) {
    const status = r.ok ? 'OK' : `FAILED (${r.error})`
    const ref = r.submissionId ? `submission ${r.submissionId}` : r.orderId ? `order ${r.orderId}` : '—'
    console.log(`  ${r.label.padEnd(9)} ${r.scenario.padEnd(24)} ${status.padEnd(50)} ${ref}`)
  }

  console.log('\n=== Findings ===')
  console.log(JSON.stringify(manifest.findings, null, 2))

  console.log(`\nManifest written to ${MANIFEST_PATH}`)
  console.log("When you're done, run: node scripts/teardown-major.js")

  if (succeeded < PROFILES.length) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
