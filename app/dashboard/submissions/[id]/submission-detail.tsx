'use client'

import Link from 'next/link'
import { useRealtimeSubmission } from '@/lib/hooks/use-realtime-submission'
import { PipelineProgress } from '@/components/dashboard/pipeline-progress'
import { PhotoModal } from '@/components/dashboard/photo-modal'
import type { SubmissionRow, SubmissionItemRow } from '@/lib/submission-types'

interface Props {
  initialSubmission: SubmissionRow
  initialItems: SubmissionItemRow[]
}

export function SubmissionDetail({ initialSubmission, initialItems }: Props) {
  const { submission, items } = useRealtimeSubmission(initialSubmission, initialItems)

  return (
    <div>
      <Link
        href="/dashboard/submissions"
        className="text-[13px] underline underline-offset-2"
        style={{ color: 'var(--ink-muted)' }}
      >
        ← My submissions
      </Link>

      <p className="text-[13px] mt-4" style={{ color: 'var(--ink-muted)' }}>
        Manifest #{submission.qr_code_token.slice(0, 8).toUpperCase()}
      </p>
      <h1 className="text-[26px] mt-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
        {submission.grading_company} — {items.length} {items.length === 1 ? 'card' : 'cards'}
      </h1>

      <div className="mt-10">
        <PipelineProgress status={submission.status} />
      </div>

      <div className="mt-12 space-y-3">
        {items.map((item, i) => {
          // Grade-to-Auction pipeline (app/auctions/README.md): the link
          // appears once the card has both a recorded grade and the
          // submission has reached 'graded' — app/auctions/new/page.tsx
          // re-verifies both server-side rather than trusting this.
          const eligibleForAuction = submission.status === 'graded' && item.grade_result !== null

          return (
            <div key={item.id} className="border rounded-[3px] p-4 flex gap-4" style={{ borderColor: 'var(--line)' }}>
              <div
                className="w-16 h-16 shrink-0 rounded-[3px] overflow-hidden border"
                style={{ borderColor: 'var(--line)' }}
              >
                {item.hi_res_photo_url && <PhotoModal url={item.hi_res_photo_url} alt={item.card_name} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px]" style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink-muted)' }}>
                  {String(i + 1).padStart(2, '0')}
                </p>
                <p className="text-[15px] mt-0.5" style={{ color: 'var(--ink)' }}>
                  {item.card_name} <span style={{ color: 'var(--ink-muted)' }}>— {item.set_name}</span>
                </p>
                <p className="text-[12.5px] mt-1" style={{ color: 'var(--ink-muted)' }}>
                  {item.grade_result !== null ? (
                    <>
                      Graded <span style={{ color: 'var(--ink)' }}>{item.grade_result}</span>
                      {item.grade_cert_number ? ` · Cert #${item.grade_cert_number}` : ''}
                    </>
                  ) : (
                    'Awaiting grade'
                  )}
                </p>
                {eligibleForAuction && (
                  <Link
                    href={`/auctions/new?itemId=${item.id}`}
                    className="text-[12.5px] mt-2 inline-block underline underline-offset-2"
                    style={{ color: 'var(--seal)' }}
                  >
                    List on auction
                  </Link>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
