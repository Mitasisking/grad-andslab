#!/usr/bin/env node
/**
 * Companion teardown for scripts/simulate-minor-test.js — wipes every
 * [TEST-MINOR] Internal Minor Test profile and everything it created.
 *
 * Precise path: reads scripts/.minor-test-manifest.json (written by the
 * simulation script) for the exact user ids, ledger_entries ids, and
 * product stock deltas to restore.
 *
 * Safety-net path: independently pages through Supabase Auth for any user
 * whose email ends in "@testminor.invalid" that isn't already in the
 * manifest (e.g. the manifest file was deleted, or a previous run only
 * partially completed), and looks up their orders/submissions live to
 * compute the same stock/ledger cleanup for them too.
 *
 * Deleting a [TEST-MINOR] auth user cascades at the database level to their
 * profile, submissions, submission_items, addresses, orders, and
 * order_items (all `on delete cascade` back to profiles/auth.users — see
 * supabase/migrations/0001_init_schema.sql, 0002_addresses.sql,
 * 0005_marketplace.sql). ledger_entries.submission_id is `on delete set
 * null` instead (0034_accounting_foundations.sql), so those rows are
 * deleted explicitly here before the cascade, using the ids captured above.
 *
 * Shop-order stock is restored (stock + quantity) before the cascade
 * removes the order/order_items — otherwise the real product's stock count
 * would stay permanently short by whatever this test bought. Every other
 * delete below is scoped strictly to rows carrying the [TEST-MINOR] marker
 * or belonging to a matched test user; nothing here touches an unrelated
 * table wholesale.
 *
 * Usage:
 *   node scripts/teardown-minor-test.js
 *
 * Requires the same .env.local as the simulation script.
 */

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const PREFIX = '[TEST-MINOR]'
const EMAIL_DOMAIN = 'testminor.invalid'
const MANIFEST_PATH = path.join(__dirname, '.minor-test-manifest.json')

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

async function collectStockDeltasForUser(admin, userId) {
  const { data: orders, error } = await admin.from('orders').select('id, order_items(product_id, quantity)').eq('user_id', userId)
  if (error) throw new Error(`could not read orders for ${userId}: ${error.message}`)
  const deltas = []
  for (const order of orders ?? []) {
    for (const item of order.order_items ?? []) {
      if (item.product_id) deltas.push({ productId: item.product_id, quantity: item.quantity })
    }
  }
  return deltas
}

async function collectLedgerEntryIdsForUser(admin, userId) {
  const { data: subs, error } = await admin.from('submissions').select('id').eq('user_id', userId)
  if (error) throw new Error(`could not read submissions for ${userId}: ${error.message}`)
  const submissionIds = (subs ?? []).map((s) => s.id)
  if (submissionIds.length === 0) return []
  const { data: entries, error: ledgerError } = await admin.from('ledger_entries').select('id').in('submission_id', submissionIds)
  if (ledgerError) throw new Error(`could not read ledger_entries: ${ledgerError.message}`)
  return (entries ?? []).map((e) => e.id)
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
    console.log(`Loaded manifest from ${MANIFEST_PATH} (${manifest.users.length} profile(s)).`)
  } else {
    console.log('No manifest file found — falling back to a live sweep for [TEST-MINOR] users only.')
  }

  // userId -> { email, stockDeltas, ledgerEntryIds, fromManifest }
  const targets = new Map()
  for (const u of manifest?.users ?? []) {
    if (!u.id) continue // this profile failed before the auth user was created
    targets.set(u.id, { email: u.email, stockDeltas: u.stockDeltas ?? [], ledgerEntryIds: u.ledgerEntryIds ?? [], fromManifest: true })
  }

  // Safety-net sweep: page through every auth user, add anyone matching our
  // test email pattern that the manifest didn't already cover.
  let page = 1
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(`listUsers failed: ${error.message}`)
    for (const u of data.users) {
      if (u.email && u.email.endsWith(`@${EMAIL_DOMAIN}`) && !targets.has(u.id)) {
        targets.set(u.id, { email: u.email, stockDeltas: null, ledgerEntryIds: null, fromManifest: false })
      }
    }
    if (data.users.length < 200) break
    page += 1
  }

  if (targets.size === 0) {
    console.log('No [TEST-MINOR] users found. Nothing to tear down.')
  }

  const stockRestored = new Map()
  let ledgerDeleted = 0
  let usersDeleted = 0
  let usersFailed = 0

  for (const [userId, info] of targets) {
    console.log(`\nTearing down ${info.email ?? userId}${info.fromManifest ? '' : ' [safety-net match]'}...`)

    try {
      const stockDeltas = info.stockDeltas ?? (await collectStockDeltasForUser(admin, userId))
      const ledgerEntryIds = info.ledgerEntryIds ?? (await collectLedgerEntryIdsForUser(admin, userId))

      for (const { productId, quantity } of stockDeltas) {
        const { data: product, error: fetchError } = await admin.from('products').select('stock').eq('id', productId).single()
        if (fetchError || !product) {
          console.warn(`  [warn] could not read product ${productId} to restore stock: ${fetchError?.message ?? 'not found'}`)
          continue
        }
        const { error: restoreError } = await admin.from('products').update({ stock: product.stock + quantity }).eq('id', productId)
        if (restoreError) {
          console.warn(`  [warn] could not restore stock for ${productId}: ${restoreError.message}`)
          continue
        }
        stockRestored.set(productId, (stockRestored.get(productId) ?? 0) + quantity)
        console.log(`  restored stock +${quantity} on product ${productId}`)
      }

      if (ledgerEntryIds.length > 0) {
        const { error: ledgerError } = await admin.from('ledger_entries').delete().in('id', ledgerEntryIds)
        if (ledgerError) {
          console.warn(`  [warn] could not delete ledger_entries: ${ledgerError.message}`)
        } else {
          ledgerDeleted += ledgerEntryIds.length
          console.log(`  deleted ${ledgerEntryIds.length} ledger_entries row(s)`)
        }
      }

      const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
      if (deleteError) throw new Error(`deleteUser failed: ${deleteError.message}`)
      console.log('  deleted auth user (cascades profile/submissions/orders/addresses)')
      usersDeleted += 1
    } catch (err) {
      console.error(`  [FAILED] ${err.message}`)
      usersFailed += 1
    }
  }

  // Strict, prefix-scoped safety sweep for anything that carries the
  // [TEST-MINOR] marker but wasn't tied to a user handled above (e.g. a
  // submission whose owning user had already been deleted some other way).
  // Never a bare wildcard delete of a whole table.
  const { data: orphanSubs } = await admin.from('submissions').select('id').ilike('notes', `${PREFIX}%`)
  if (orphanSubs?.length) {
    await admin.from('submissions').delete().in('id', orphanSubs.map((s) => s.id))
    console.log(`\nRemoved ${orphanSubs.length} orphaned [TEST-MINOR] submission(s).`)
  }
  const { data: orphanAddresses } = await admin.from('addresses').select('id').ilike('full_name', `${PREFIX}%`)
  if (orphanAddresses?.length) {
    await admin.from('addresses').delete().in('id', orphanAddresses.map((a) => a.id))
    console.log(`Removed ${orphanAddresses.length} orphaned [TEST-MINOR] address(es).`)
  }

  if (fs.existsSync(MANIFEST_PATH)) fs.unlinkSync(MANIFEST_PATH)

  console.log('\n=== Teardown complete ===')
  console.log(`  Users deleted: ${usersDeleted}`)
  if (usersFailed > 0) console.log(`  Users FAILED to delete: ${usersFailed} — check the [FAILED] lines above`)
  console.log(`  Ledger entries removed: ${ledgerDeleted}`)
  if (stockRestored.size > 0) {
    console.log('  Stock restored:')
    for (const [productId, qty] of stockRestored) console.log(`    ${productId}: +${qty}`)
  } else {
    console.log('  Stock restored: none')
  }

  if (usersFailed > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
