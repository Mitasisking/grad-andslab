import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { runMarketTrendsSweep } from '@/lib/market-trends/run-sweep'

/**
 * "Run Agent Sweep" button on /admin/trends. Same pipeline as the
 * twice-daily cron (app/api/cron/market-trends/route.ts), just triggered on
 * demand -- gated by requireAdmin (session + profiles.role check) rather
 * than CRON_SECRET, since an admin's own login is the credential here, not
 * a header only server-to-server callers should hold.
 *
 * The actual insert inside runMarketTrendsSweep still runs through the
 * service-role client, not this route's session client -- market_trends has
 * no insert policy for any session role at all (0050_market_trends.sql),
 * by design, so a manual trigger is a second privileged *path in*, not a
 * relaxation of that RLS boundary.
 */
export async function POST() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const result = await runMarketTrendsSweep()
  if ('error' in result) return NextResponse.json(result, { status: 500 })
  return NextResponse.json(result)
}
