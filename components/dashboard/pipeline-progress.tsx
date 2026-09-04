import { STATUS_STAGES } from '@/lib/submission-types'
import type { SubmissionStatus } from '@/lib/submission-types'

/** 5-stage Received -> Inspected -> Shipped -> Graded -> Vault/Return, per app/shop/README.md. */
export function PipelineProgress({ status }: { status: SubmissionStatus }) {
  const currentIndex = STATUS_STAGES.findIndex((s) => s.value === status)

  return (
    <div className="grid" style={{ gridTemplateColumns: `repeat(${STATUS_STAGES.length}, 1fr)` }}>
      {STATUS_STAGES.map((stage, i) => {
        const reached = i <= currentIndex
        return (
          <div key={stage.value} className="flex flex-col items-center relative">
            {i > 0 && (
              <div
                className="absolute h-px top-[5px]"
                style={{
                  right: '50%',
                  width: '100%',
                  background: i <= currentIndex ? 'var(--seal)' : 'var(--line)',
                }}
              />
            )}
            <span
              className="w-3 h-3 rounded-full border-2 relative z-10"
              style={{
                borderColor: reached ? 'var(--seal)' : 'var(--line)',
                background: reached ? 'var(--seal)' : 'var(--background)',
              }}
            />
            <span
              className="text-[11px] mt-2 text-center px-1"
              style={{ color: reached ? 'var(--ink)' : 'var(--ink-muted)' }}
            >
              {stage.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
