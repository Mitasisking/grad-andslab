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

/**
 * STUB: plug in a unified social posting API here (e.g. Ayrshare, Zernio)
 * once the business has picked one and has an API key. Left unimplemented
 * on purpose -- inventing a real integration against a provider nobody has
 * an account with yet would just be code that can't actually be tested.
 */
async function postToSocialChannels(copy: string): Promise<{ posted: boolean; reason: string }> {
  // Example shape once a provider is chosen (Ayrshare's REST API, for instance):
  //
  // const res = await fetch('https://app.ayrshare.com/api/post', {
  //   method: 'POST',
  //   headers: {
  //     Authorization: `Bearer ${process.env.AYRSHARE_API_KEY}`,
  //     'Content-Type': 'application/json',
  //   },
  //   body: JSON.stringify({ post: copy, platforms: ['instagram', 'facebook', 'tiktok'] }),
  // })
  // if (!res.ok) return { posted: false, reason: `Posting API returned ${res.status}` }
  // return { posted: true, reason: 'Posted' }

  void copy
  return { posted: false, reason: 'No social posting API configured yet (see stub in app/api/webhooks/pool-milestone/route.ts).' }
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
