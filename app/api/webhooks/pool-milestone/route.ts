import { NextRequest, NextResponse } from 'next/server'
import { TIER_OPTIONS_BY_COMPANY, type GradingCompany, type SubmissionTier } from '@/lib/submission-types'
import { formatZAR } from '@/lib/currency'

/**
 * Fired by supabase/migrations/0043_pool_milestone_webhook.sql's
 * trg_pools_notify_milestone trigger the moment a pool crosses 25/50/75/100%
 * capacity. No user session reaches this route -- it's a database trigger
 * calling out via pg_net, same shape as app/api/auctions/close/route.ts and
 * app/api/shop/orders/release-stale/route.ts, so it's protected by a shared
 * secret (POOL_MILESTONE_WEBHOOK_SECRET) rather than requireAdmin(). That
 * value must exactly match the 'pool_milestone_webhook_secret' Vault secret
 * the migration's own header comment tells you to create.
 */
interface PoolMilestonePayload {
  pool_id: string
  grading_company: string
  tier: string
  label: string
  capacity: number
  current_count: number
  milestone_pct: number
  status: string
}

function isValidPayload(body: unknown): body is PoolMilestonePayload {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  return (
    typeof b.pool_id === 'string' &&
    typeof b.grading_company === 'string' &&
    typeof b.tier === 'string' &&
    typeof b.label === 'string' &&
    typeof b.capacity === 'number' &&
    typeof b.current_count === 'number' &&
    typeof b.milestone_pct === 'number' &&
    typeof b.status === 'string'
  )
}

function tierLabel(payload: PoolMilestonePayload): string {
  const options = TIER_OPTIONS_BY_COMPANY[payload.grading_company as GradingCompany]
  const match = options?.find((t) => t.value === (payload.tier as SubmissionTier))
  return match?.label ?? payload.tier
}

/**
 * Generates the FOMO-driven social copy for one milestone event.
 *
 * STUB: this is a deterministic template, not an LLM call. .claude/agents/
 * marketing-agent.md documents the exact voice/rules a real copy-generation
 * call should follow (FOMO-driven tone, worked examples, and the hard
 * requirement that any price/fee mentioned is ZAR-formatted via
 * lib/currency.ts's formatZAR -- never a bare number or another currency).
 * Wire this up to a real model call (e.g. the Anthropic Messages API, using
 * that file's rules as the system prompt) once the business wants fully
 * automated copy instead of this placeholder -- the rest of the pipeline
 * (auth, payload validation, the posting stub below) is real today and
 * doesn't need to change when that happens.
 */
function generateMarketingCopy(payload: PoolMilestonePayload): string {
  const label = `${payload.grading_company} ${tierLabel(payload)}`
  const fee = TIER_OPTIONS_BY_COMPANY[payload.grading_company as GradingCompany]?.find(
    (t) => t.value === (payload.tier as SubmissionTier),
  )?.basePriceZAR

  if (payload.milestone_pct >= 100) {
    return `${label} just hit capacity (${payload.current_count}/${payload.capacity})! This batch is locked in and shipping to the grader soon -- the next ${label} batch starts filling now.`
  }

  const feeLine = fee ? ` from ${formatZAR(fee)}/card` : ''
  return `Our ${label} pool is ${payload.milestone_pct}% full (${payload.current_count}/${payload.capacity} cards)${feeLine} -- don't miss this batch's ship date. Join now before it locks in!`
}

interface ZernioPlatformEntry {
  platform: string
  accountId: string
}

interface ZernioSuccessResponse {
  message: string
  post: {
    _id: string
    status: string
    scheduledFor: string
    platforms: { platform: string; status: string }[]
  }
}

interface ZernioErrorResponse {
  error: string
  details?: unknown
}

/**
 * Posts via Zernio (https://zernio.com) -- switched from Ayrshare per the
 * business's own cost call at current volume. Endpoint/payload shape below
 * is sourced directly from https://docs.zernio.com/ (POST /v1/posts) as of
 * 2026-09 -- re-check that page if this ever starts erroring, since a
 * third-party API can change its own contract without this codebase
 * knowing.
 *
 * Zernio hosts the OAuth tokens for each connected social account itself --
 * this call never touches a platform's own API directly, only Zernio's. It
 * needs to know WHICH of your Zernio-connected accounts to post to, via
 * each platform's real Zernio accountId (visible in your Zernio dashboard
 * once an account is connected there) -- there is no way for this code to
 * guess those ids, so they're read from ZERNIO_ACCOUNT_IDS as a JSON object,
 * e.g. {"instagram":"acc_123","facebook":"acc_456"}. Posting is skipped
 * with a clear reason (never thrown) if either env var is missing, or if
 * ZERNIO_ACCOUNT_IDS is empty/malformed.
 */
async function postToSocialChannels(copy: string): Promise<{ posted: boolean; reason: string }> {
  const apiKey = process.env.ZERNIO_API_KEY
  if (!apiKey) {
    return { posted: false, reason: 'ZERNIO_API_KEY is not set.' }
  }

  let accountsByPlatform: Record<string, string>
  try {
    accountsByPlatform = JSON.parse(process.env.ZERNIO_ACCOUNT_IDS ?? '{}')
  } catch (err) {
    console.error('[pool-milestone] ZERNIO_ACCOUNT_IDS is not valid JSON:', err)
    return { posted: false, reason: 'ZERNIO_ACCOUNT_IDS is not valid JSON.' }
  }

  const platforms: ZernioPlatformEntry[] = Object.entries(accountsByPlatform).map(([platform, accountId]) => ({
    platform,
    accountId,
  }))

  if (platforms.length === 0) {
    return { posted: false, reason: 'No Zernio accounts configured (ZERNIO_ACCOUNT_IDS is empty).' }
  }

  try {
    const res = await fetch('https://zernio.com/api/v1/posts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: copy,
        publishNow: true,
        // Zernio's schema lists scheduledFor/timezone as required regardless
        // of publishNow -- 'now' in UTC satisfies that without actually
        // delaying the post.
        scheduledFor: new Date().toISOString(),
        timezone: 'UTC',
        platforms,
      }),
    })

    const responseBody = await res.json().catch(() => null)

    if (!res.ok) {
      // Zernio-specific error envelope ({ error, details }) -- logged in
      // full server-side (visible in Vercel's function logs) so a failed
      // post is debuggable, never just a silent { posted: false }.
      const errorBody = responseBody as ZernioErrorResponse | null
      console.error(
        `[pool-milestone] Zernio post failed (status ${res.status}): ${errorBody?.error ?? res.statusText}`,
        errorBody?.details ?? '',
      )
      return { posted: false, reason: `Zernio API error ${res.status}: ${errorBody?.error ?? res.statusText}` }
    }

    const success = responseBody as ZernioSuccessResponse
    return {
      posted: true,
      reason: `Zernio post ${success.post?.status ?? 'scheduled'} (id ${success.post?._id ?? 'unknown'})`,
    }
  } catch (err) {
    console.error('[pool-milestone] Zernio request threw:', err)
    return { posted: false, reason: `Zernio request failed: ${err instanceof Error ? err.message : String(err)}` }
  }
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.POOL_MILESTONE_WEBHOOK_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!isValidPayload(body)) {
    return NextResponse.json({ error: 'Malformed pool-milestone payload' }, { status: 400 })
  }

  const copy = generateMarketingCopy(body)
  const postResult = await postToSocialChannels(copy)

  console.log(
    `[pool-milestone] ${body.grading_company} ${body.tier} hit ${body.milestone_pct}% (${body.current_count}/${body.capacity}) -- posted=${postResult.posted}`,
  )

  return NextResponse.json({ ok: true, copy, posted: postResult.posted, reason: postResult.reason })
}
