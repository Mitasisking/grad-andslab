import Link from 'next/link'
import { LivePools } from '../../components/LivePools'
import { getSupabaseRouteClient } from '../../lib/supabase-route-client'
import { getActiveLivePools } from '../../lib/pools/active-pools'

/**
 * Standalone home for the Live Batch Tracker, previously embedded directly
 * on the homepage (app/page.tsx) between the hero and the featured-products
 * carousel. Reuses components/LivePools.tsx as-is rather than duplicating
 * its markup -- same one-shot server-rendered snapshot (lib/pools/active-pools.ts)
 * the homepage already used, same "Join Batch" deep link into
 * /submit?company=...&tier=..., which app/submit/wizard.tsx already reads
 * on mount.
 */
export default async function BatchesPage() {
  const supabase = await getSupabaseRouteClient()
  const activePools = await getActiveLivePools(supabase)

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {activePools.length === 0 ? (
        <div className="max-w-2xl mx-auto px-6 py-28 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">Live Batch Tracker</h1>
          <p className="text-slate-400 text-lg mb-10">
            No batches are currently filling. Start a submission and we&apos;ll open a new one for your
            grading company and tier.
          </p>
          <Link
            href="/submit"
            className="inline-block bg-[#a67c00] hover:bg-[#997100] text-black font-bold text-lg px-8 py-4 rounded-xl border-2 border-black transition"
          >
            Start a Submission
          </Link>
        </div>
      ) : (
        <div className="pt-8">
          <LivePools pools={activePools} />
        </div>
      )}
    </div>
  )
}
