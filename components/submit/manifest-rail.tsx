'use client'

import { motion } from 'framer-motion'

interface ManifestStep {
  index: number
  label: string
  description: string
}

const STEPS: ManifestStep[] = [
  { index: 0, label: 'Grader & tier', description: 'Choose a service and list your cards' },
  { index: 1, label: 'Add-ons', description: 'Pre-grading inspection and return rules' },
  { index: 2, label: 'Review & pay', description: 'Address, courier, and payment' },
]

export function ManifestRail({ currentStep }: { currentStep: number }) {
  return (
    <nav aria-label="Submission steps" className="lg:sticky lg:top-10">
      <div className="flex lg:flex-col overflow-x-auto lg:overflow-visible -mx-1 lg:mx-0 px-1 lg:px-0">
        {STEPS.map((step) => {
          const isComplete = currentStep > step.index
          const isActive = currentStep === step.index
          const activeOrComplete = isActive || isComplete

          return (
            <div key={step.index} className="shrink-0">
              <div
                className="flex items-start gap-3 py-4 lg:py-5 pr-8 lg:pr-0 lg:border-l lg:pl-5 -ml-px"
                style={{ borderColor: activeOrComplete ? 'var(--seal)' : 'var(--line)' }}
              >
                <span
                  className="text-[13px] mt-0.5 w-6 shrink-0 text-right"
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontVariantNumeric: 'tabular-nums',
                    color: isActive ? 'var(--seal)' : isComplete ? 'var(--vault)' : 'var(--line)',
                  }}
                >
                  {String(step.index + 1).padStart(2, '0')}
                </span>
                <div className="min-w-[9rem]">
                  <p
                    className="text-[17px] leading-tight"
                    style={{
                      fontFamily: 'var(--font-display)',
                      color: activeOrComplete ? 'var(--ink)' : 'var(--line)',
                    }}
                  >
                    {step.label}
                  </p>
                  <p className="hidden lg:block text-[13px] mt-1 leading-snug" style={{ color: 'var(--ink-muted)' }}>
                    {step.description}
                  </p>
                </div>
                {isComplete && (
                  <motion.span
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    className="ml-auto lg:ml-0 lg:mt-0.5 text-[13px]"
                    style={{ color: 'var(--seal)' }}
                    aria-label="Complete"
                  >
                    ✓
                  </motion.span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </nav>
  )
}
