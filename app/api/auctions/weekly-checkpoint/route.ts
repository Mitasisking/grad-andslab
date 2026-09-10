import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'

/**
 * Fired every Friday at 17:00 UTC (19:00 SAST) by pg_cron -- see this
 * migration's SQL in the deploy notes for scheduling it. Protected by
 * CRON_SECRET, same shape as app/api/auctions/close/route.ts.
 *
 * Deliberately does NOT close the ending auction or "publish" the next
 * one -- neither needs a weekly trigger:
 *   - Closing already happens every minute, for every auction regardless
 *     of program, via the existing auctions-close cron
 *     (0011_pg_cron_sweeps.sql) checking ends_at <= now(). A once-a-week
 *     close would just be a strictly worse version of something that
 *     already runs 10,080 times more often.
 *   - "Publishing" isn't a real action either: auctions_select_public
 *     (0046_staggered_weekly_auctions.sql) already hides any auction
 *     before its own starts_at, so a queued weekly-feature auction simply
 *     becomes visible the instant its starts_at arrives, with nothing to
 *     flip and nothing to get out of sync if this route's own cron is
 *     ever late or misses a run.
 *
 * What's actually useful on a weekly cadence: confirming the pipeline
 * hasn't run dry. There's no way to auto-generate a new auction's content
 * (a real graded card, a real consignor) -- someone has to queue the next
 * one via POST /api/admin/auctions/schedule-weekly. This just reports
 * whether that's still true, so a gap is noticed within a week instead of
 * silently, the first time a customer notices no new auction appeared.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServerClient()

  const { data: pipeline, error } = await supabase
    .from('auctions')
    .select('id, title, starts_at, ends_at')
    .eq('is_weekly_feature', true)
    .in('status', ['active', 'extended'])
    .order('ends_at', { ascending: true })

  if (error) {
    console.error('[weekly-checkpoint] Could not read the weekly-feature pipeline:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const upcoming = pipeline ?? []
  const pipelineHealthy = upcoming.length > 0

  if (!pipelineHealthy) {
    console.error(
      '[weekly-checkpoint] No weekly-feature auctions are queued -- the pipeline has run dry. Schedule the next one via POST /api/admin/auctions/schedule-weekly.',
    )
  } else {
    console.log(
      `[weekly-checkpoint] ${upcoming.length} weekly-feature auction(s) in the pipeline; next ends ${upcoming[0].ends_at} (${upcoming[0].title}).`,
    )
  }

  return NextResponse.json({ ok: true, activeCount: upcoming.length, pipelineHealthy })
}
