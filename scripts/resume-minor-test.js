#!/usr/bin/env node
/**
 * Resumes a partial scripts/simulate-minor-test.js run using the existing
 * manifest (scripts/.minor-test-manifest.json) — for exactly the situation
 * this test hit once already: some [TEST-MINOR] profiles' auth user +
 * address already exist for real, but their submission and/or order never
 * got created because something failed partway through (here: the
 * assign_submission_pool() type-drift bug, since fixed by
 * supabase/migrations/0041_fix_assign_submission_pool_grading_company_type_
 * drift.sql).
 *
 * Does NOT re-run scripts/simulate-minor-test.js from scratch — that would
 * fail re-creating the 5 already-existing auth users, and would wrongly
 * double-purchase (and double-decrement real stock) for any profile whose
 * shop order already succeeded. Instead, per profile in the manifest, this
 * only does whichever of {grading submission, shop order} that profile's
 * scenario needs and doesn't already have.
 *
 * Since the original random password was never written to the manifest (it
 * only lives in memory during simulate-minor-test.js's own run, by design —
 * not something worth persisting to disk), this resets each resumed user's
 * password via the admin API before signing back in as them.
 *
 * Usage:
 *   node scripts/resume-minor-test.js
 *
 * Requires the same .env.local as simulate-minor-test.js, and an existing
 * scripts/.minor-test-manifest.json from a prior (partial) run.
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { createClient } = require('@supabase/supabase-js')
const {
  MANIFEST_PATH,
  PROFILES,
  loadEnv,
  signInAsUser,
  runGradingSubmission,
  runShopPurchase,
} = require('./simulate-minor-test')

function needsGrading(profile, entry) {
  return (profile.scenario === 'grading' || profile.scenario === 'mixed') && !entry.submissionId
}

function needsShop(profile, entry) {
  return (profile.scenario === 'shop' || profile.scenario === 'mixed') && !entry.orderId
}

async function main() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error(`No manifest found at ${MANIFEST_PATH} — nothing to resume. Run scripts/simulate-minor-test.js first.`)
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))

  const envPath = path.join(__dirname, '..', '.env.local')
  const env = loadEnv(envPath)
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are all required in .env.local')
  }
  const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const pending = PROFILES.map((profile) => {
    const entry = manifest.users.find((u) => u.n === profile.n)
    return { profile, entry }
  }).filter(({ profile, entry }) => entry?.id && (needsGrading(profile, entry) || needsShop(profile, entry)))

  if (pending.length === 0) {
    console.log('Nothing to resume — every profile in the manifest already has what its scenario needs.')
    return
  }

  // Candidate SA-region shop products for whichever pending profiles still
  // need a shop purchase — same query simulate-minor-test.js's main() uses.
  let products = null
  const loadProducts = async () => {
    if (products) return products
    const { data, error } = await adminClient
      .from('products')
      .select('id, title, stock')
      .eq('region', 'sa')
      .eq('is_active', true)
      .gt('stock', 0)
      .order('stock', { ascending: false })
      .limit(5)
    if (error) throw new Error(`could not load candidate products: ${error.message}`)
    if (!data || data.length === 0) throw new Error('No active, in-stock SA-region products found.')
    products = data
    return products
  }
  let shopPurchaseIndex = 0

  const results = []

  for (const { profile, entry } of pending) {
    console.log(`\n--- Resuming ${profile.label} (${profile.scenario}) ---`)
    try {
      const newPassword = crypto.randomBytes(18).toString('hex')
      const { error: pwError } = await adminClient.auth.admin.updateUserById(entry.id, { password: newPassword })
      if (pwError) throw new Error(`could not reset password for ${entry.email}: ${pwError.message}`)

      const userClient = await signInAsUser(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, entry.email, newPassword)

      const { data: address, error: addressError } = await userClient.from('addresses').select('*').eq('user_id', entry.id).single()
      if (addressError || !address) throw new Error(`could not load existing address for ${entry.email}: ${addressError?.message ?? 'not found'}`)

      if (needsGrading(profile, entry)) {
        const grading = await runGradingSubmission(userClient, adminClient, { userId: entry.id, address, profile })
        entry.submissionId = grading.submissionId
        entry.ledgerEntryIds = grading.ledgerEntryIds
        console.log(`  submission ${grading.submissionId} (${profile.company} ${profile.tier}) — payment_status captured`)
      }

      if (needsShop(profile, entry)) {
        const list = await loadProducts()
        const product = list[shopPurchaseIndex % list.length]
        shopPurchaseIndex += 1
        const purchase = await runShopPurchase(userClient, adminClient, { address, product })
        entry.orderId = purchase.orderId
        entry.stockDeltas = [...(entry.stockDeltas ?? []), { productId: purchase.productId, quantity: purchase.quantity }]
        console.log(`  order ${purchase.orderId} — "${purchase.productTitle}" × 1 (stock decremented for real) — status paid`)
      }

      results.push({ label: profile.label, ok: true })
    } catch (err) {
      console.error(`  [FAILED] ${err.message}`)
      results.push({ label: profile.label, ok: false, error: err.message })
    }

    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2))
  }

  const succeeded = results.filter((r) => r.ok).length
  console.log(`\n=== Resume summary: ${succeeded}/${results.length} pending profile(s) completed ===`)
  for (const r of results) {
    console.log(`  ${r.label.padEnd(8)} ${r.ok ? 'OK' : `FAILED (${r.error})`}`)
  }
  console.log(`\nManifest updated at ${MANIFEST_PATH}`)

  if (succeeded < results.length) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
