#!/usr/bin/env node
/**
 * Companion teardown for scripts/simulate-major-test.js — wipes every
 * [TEST-MAJOR] user and everything it created, including the two dedicated
 * throwaway shop products the simulation makes for itself.
 *
 * Same explicit-delete discipline as teardown-minor-test.js (see that
 * file's header): production's profiles table has none of the
 * on-delete-cascade FKs the migration files declare, so every child row
 * (orders, order_items, submissions, submission_items, addresses,
 * ledger_entries) is deleted here explicitly by id/user_id rather than
 * trusted to cascade from deleting the auth user.
 *
 * Unlike the minor test, shop purchases here ran against two [TEST-MAJOR]
 * products this test created for itself (not real catalog items), so there
 * is no real inventory to restore — those products are simply deleted at
 * the end, after every order/order_item referencing them is gone.
 *
 * Precise path: reads scripts/.major-test-manifest.json (written by
 * simulate-major-test.js). Safety-net path: independently pages through
 * Supabase Auth for any user whose email ends in "@testmajor.invalid" that
 * isn't already in the manifest, and a final prefix-scoped sweep for
 * [TEST-MAJOR] products/submissions/addresses that survived some other way.
 * Never a bare wildcard delete of a whole table.
 *
 * Usage:
 *   node scripts/teardown-major.js
 *
 * Requires the same .env.local as simulate-major-test.js.
 */

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const PREFIX = '[TEST-MAJOR]'
const EMAIL_DOMAIN = 'testmajor.invalid'
const MANIFEST_PATH = path.join(__dirname, '.major-test-manifest.json')

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

async function collectOrdersForUser(admin, userId) {
  const { data: orders, error } = await admin.from('orders').select('id').eq('user_id', userId)
  if (error) throw new Error(`could not read orders for ${userId}: ${error.message}`)
  return (orders ?? []).map((o) => o.id)
}

async function deleteOrdersForUser(admin, userId, orderIds) {
  if (orderIds.length === 0) return
  const { error: itemsError } = await admin.from('order_items').delete().in('order_id', orderIds)
  if (itemsError) throw new Error(`could not delete order_items for ${userId}: ${itemsError.message}`)
  const { error: ordersError } = await admin.from('orders').delete().in('id', orderIds)
  if (ordersError) throw new Error(`could not delete orders for ${userId}: ${ordersError.message}`)
}

async function collectSubmissionsForUser(admin, userId) {
  const { data: subs, error } = await admin.from('submissions').select('id').eq('user_id', userId)
  if (error) throw new Error(`could not read submissions for ${userId}: ${error.message}`)
  const submissionIds = (subs ?? []).map((s) => s.id)
  if (submissionIds.length === 0) return { submissionIds, ledgerEntryIds: [] }
  const { data: entries, error: ledgerError } = await admin.from('ledger_entries').select('id').in('submission_id', submissionIds)
  if (ledgerError) throw new Error(`could not read ledger_entries: ${ledgerError.message}`)
  return { submissionIds, ledgerEntryIds: (entries ?? []).map((e) => e.id) }
}

async function deleteSubmissionsForUser(admin, userId, submissionIds) {
  if (submissionIds.length === 0) return
  const { error: itemsError } = await admin.from('submission_items').delete().in('submission_id', submissionIds)
  if (itemsError) throw new Error(`could not delete submission_items for ${userId}: ${itemsError.message}`)
  const { error: subsError } = await admin.from('submissions').delete().in('id', submissionIds)
  if (subsError) throw new Error(`could not delete submissions for ${userId}: ${subsError.message}`)
}

async function main() {
  const envPath = path.join(__dirname, '..', '.env.local')
  const env = loadEnv(envPath)
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env.local')
  }

  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let manifest = null
  if (fs.existsSync(MANIFEST_PATH)) {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
    console.log(`Loaded manifest from ${MANIFEST_PATH} (${manifest.users.length} profile(s), ${manifest.products?.length ?? 0} test product(s)).`)
  } else {
    console.log('No manifest file found — falling back to a live sweep for [TEST-MAJOR] users/products only.')
  }

  const targets = new Map()
  for (const u of manifest?.users ?? []) {
    if (!u.id) continue
    targets.set(u.id, { email: u.email, fromManifest: true })
  }

  let page = 1
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(`listUsers failed: ${error.message}`)
    for (const u of data.users) {
      if (u.email && u.email.endsWith(`@${EMAIL_DOMAIN}`) && !targets.has(u.id)) {
        targets.set(u.id, { email: u.email, fromManifest: false })
      }
    }
    if (data.users.length < 200) break
    page += 1
  }

  if (targets.size === 0) {
    console.log('No [TEST-MAJOR] users found. Nothing to tear down.')
  }

  let ledgerDeleted = 0
  let ordersDeleted = 0
  let submissionsDeleted = 0
  let usersDeleted = 0
  let usersFailed = 0

  for (const [userId, info] of targets) {
    console.log(`\nTearing down ${info.email ?? userId}${info.fromManifest ? '' : ' [safety-net match]'}...`)
    try {
      const orderIds = await collectOrdersForUser(admin, userId)
      const { submissionIds, ledgerEntryIds } = await collectSubmissionsForUser(admin, userId)

      if (ledgerEntryIds.length > 0) {
        const { error: ledgerError } = await admin.from('ledger_entries').delete().in('id', ledgerEntryIds)
        if (ledgerError) console.warn(`  [warn] could not delete ledger_entries: ${ledgerError.message}`)
        else {
          ledgerDeleted += ledgerEntryIds.length
          console.log(`  deleted ${ledgerEntryIds.length} ledger_entries row(s)`)
        }
      }

      await deleteOrdersForUser(admin, userId, orderIds)
      if (orderIds.length > 0) {
        ordersDeleted += orderIds.length
        console.log(`  deleted ${orderIds.length} order(s) and their order_items`)
      }

      await deleteSubmissionsForUser(admin, userId, submissionIds)
      if (submissionIds.length > 0) {
        submissionsDeleted += submissionIds.length
        console.log(`  deleted ${submissionIds.length} submission(s) and their submission_items`)
      }

      const { error: addressError } = await admin.from('addresses').delete().eq('user_id', userId)
      if (addressError) console.warn(`  [warn] could not delete addresses: ${addressError.message}`)

      const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
      if (deleteError) throw new Error(`deleteUser failed: ${deleteError.message}`)
      console.log('  deleted auth user + profile')
      usersDeleted += 1
    } catch (err) {
      console.error(`  [FAILED] ${err.message}`)
      usersFailed += 1
    }
  }

  // Delete the dedicated test products themselves — safe now that every
  // order/order_item referencing them is gone. Prefix-matched on title as a
  // belt-and-suspenders check even when sourced from the manifest.
  let productsDeleted = 0
  const manifestProductIds = (manifest?.products ?? []).map((p) => p.id).filter(Boolean)
  const { data: matchingProducts } = await admin.from('products').select('id').ilike('title', `${PREFIX}%`)
  const productIds = new Set([...manifestProductIds, ...((matchingProducts ?? []).map((p) => p.id))])
  if (productIds.size > 0) {
    const { error: productError, data: deleted } = await admin.from('products').delete().in('id', [...productIds]).select('id')
    if (productError) console.warn(`  [warn] could not delete test products: ${productError.message}`)
    else productsDeleted = deleted?.length ?? 0
  }

  // Strict, prefix-scoped safety sweep for anything carrying the
  // [TEST-MAJOR] marker but not tied to a user handled above.
  const { data: orphanSubs } = await admin.from('submissions').select('id').ilike('notes', `${PREFIX}%`)
  if (orphanSubs?.length) {
    const orphanIds = orphanSubs.map((s) => s.id)
    await admin.from('submission_items').delete().in('submission_id', orphanIds)
    await admin.from('submissions').delete().in('id', orphanIds)
    submissionsDeleted += orphanSubs.length
    console.log(`\nRemoved ${orphanSubs.length} orphaned [TEST-MAJOR] submission(s).`)
  }
  const { data: orphanAddresses } = await admin.from('addresses').select('id').ilike('full_name', `${PREFIX}%`)
  if (orphanAddresses?.length) {
    await admin.from('addresses').delete().in('id', orphanAddresses.map((a) => a.id))
    console.log(`Removed ${orphanAddresses.length} orphaned [TEST-MAJOR] address(es).`)
  }

  if (fs.existsSync(MANIFEST_PATH)) fs.unlinkSync(MANIFEST_PATH)

  console.log('\n=== Teardown complete ===')
  console.log(`  Users deleted: ${usersDeleted}`)
  if (usersFailed > 0) console.log(`  Users FAILED to delete: ${usersFailed} — check the [FAILED] lines above`)
  console.log(`  Orders deleted: ${ordersDeleted}`)
  console.log(`  Submissions deleted: ${submissionsDeleted}`)
  console.log(`  Ledger entries removed: ${ledgerDeleted}`)
  console.log(`  Test products deleted: ${productsDeleted}`)

  if (usersFailed > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
