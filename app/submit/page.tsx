import type { Metadata } from 'next'
import { SubmissionWizard } from './wizard'

export const metadata: Metadata = {
  title: 'Submit for grading',
  description: 'Send cards to Premier Card Grading (PCG) through our grading pipeline.',
}

export default function SubmitPage() {
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
      <SubmissionWizard />
    </main>
  )
}
