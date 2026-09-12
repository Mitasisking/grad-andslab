import { NextRequest, NextResponse } from 'next/server'
import { runMarketTrendsSweep } from '@/lib/market-trends/run-sweep'

/**
 * Twice-daily entry point for the market-trend pipeline (see
 * lib/market-trends/run-sweep.ts for what it actually does and why it can
 * refuse to write anything). Same CRON_SECRET-bearer pattern as every other
 * scheduled route in this app. The admin-triggered manual "Run Agent Sweep"
 * button on /admin/trends calls the same shared function through a
 * separate, session-gated route (app/api/admin/trends/sweep/route.ts)
 * instead of this one, since an admin's own login session is a different
 * kind of credential than a server-to-server cron secret.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runMarketTrendsSweep()
  if ('error' in result) return NextResponse.json(result, { status: 500 })
  return NextResponse.json(result)
}
