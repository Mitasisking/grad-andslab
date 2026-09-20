import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SubmissionWizard } from './wizard'
import { getSupabaseRouteClient } from '@/lib/supabase-route-client'
import { getActiveLivePools } from '@/lib/pools/active-pools'

export const metadata: Metadata = {
  title: 'Submit for grading',
  description: 'Send cards to Premier Card Grading (PCG) through our grading pipeline.',
}

// Feature flag: components/grading/LiveBatchTracker.tsx is complete and
// wired up (see app/submit/wizard.tsx), but hidden for now so /submit's
// first screen stays focused on the standard custom submission flow. Flip
// to true to bring it back -- no other code changes needed.
const SHOW_BATCH_TRACKER = false

export default async function SubmitPage() {
  // Skip the Supabase round-trip entirely while the tracker is hidden --
  // nothing renders it, so there's nothing to fetch for.
  const activePools = SHOW_BATCH_TRACKER ? await getActiveLivePools(await getSupabaseRouteClient()) : []

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 lg:py-16">
      <header className="mb-10 lg:mb-14 max-w-xl">
        <p className="text-[13px]" style={{ color: 'var(--ink-muted)' }}>
          Grading intake
        </p>
        <h1
          className="font-[family-name:var(--font-display)] text-[34px] lg:text-[42px] leading-[1.05] mt-2"
          style={{ color: 'var(--ink)' }}
        >
          Send your cards to the grader, without the guesswork.
        </h1>
        <p className="text-[15px] mt-4 leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
          List what you&apos;re sending, choose how it&apos;s handled, and we&apos;ll generate a manifest
          with a scannable code the moment your package reaches intake.
        </p>
      </header>
      <Suspense fallback={null}>
        <SubmissionWizard activePools={activePools} showBatchTracker={SHOW_BATCH_TRACKER} />
      </Suspense>
    </main>
  )
}
