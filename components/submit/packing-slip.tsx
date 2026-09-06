'use client'

import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import { formatUSD } from '@/lib/currency'
import type { CardEntry, GradingCompany, ShippingAddress } from '@/lib/submission-types'

interface Props {
  qrToken: string
  gradingCompany: GradingCompany
  tier: string
  cards: CardEntry[]
  address: ShippingAddress | null
  courier: string
  total: number
}

export function PackingSlip({ qrToken, gradingCompany, tier, cards, address, courier, total }: Props) {
  const intakeUrl = `https://app.example.com/admin/intake?token=${qrToken}`

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px]" style={{ color: 'var(--seal)' }}>
            Submission confirmed
          </p>
          <h2 className="text-[24px] mt-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
            Manifest #{qrToken.slice(0, 8).toUpperCase()}
          </h2>
        </div>
        <Button onClick={() => window.print()} variant="outline" className="rounded-[3px] print:hidden shrink-0">
          Print slip
        </Button>
      </div>

      <div
        className="border rounded-[3px] p-6"
        style={{ borderColor: 'var(--line)', background: 'var(--paper-raised)' }}
      >
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="space-y-3 text-[13.5px]" style={{ color: 'var(--ink)' }}>
            <div>
              <p style={{ color: 'var(--ink-muted)' }}>Ship to grader</p>
              <p>
                {gradingCompany} — {tier}
              </p>
            </div>
            <div>
              <p style={{ color: 'var(--ink-muted)' }}>Return address</p>
              {address ? (
                <p>
                  {address.name}
                  <br />
                  {address.line1}
                  {address.line2 ? <>, {address.line2}</> : null}
                  <br />
                  {address.city}, {address.state} {address.postal}
                </p>
              ) : (
                <p>—</p>
              )}
            </div>
            <div>
              <p style={{ color: 'var(--ink-muted)' }}>Courier</p>
              <p>{courier}</p>
            </div>
          </div>
          <div className="shrink-0 p-3 rounded-[3px]" style={{ background: 'white' }}>
            <QRCodeSVG value={intakeUrl} size={112} />
          </div>
        </div>

        <div className="mt-6 pt-6 border-t" style={{ borderColor: 'var(--line)' }}>
          <p className="text-[12.5px]" style={{ color: 'var(--ink-muted)' }}>
            Contents ({cards.length})
          </p>
          <table className="w-full mt-2 text-[13.5px]">
            <tbody>
              {cards.map((card, i) => (
                <tr key={card.id} className="border-t" style={{ borderColor: 'var(--line)' }}>
                  <td
                    className="py-1.5 pr-2"
                    style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink-muted)' }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </td>
                  <td className="py-1.5" style={{ color: 'var(--ink)' }}>
                    {card.cardName} — {card.setName}
                  </td>
                  <td
                    className="py-1.5 text-right"
                    style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}
                  >
                    {formatUSD(card.declaredValue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          className="flex justify-between mt-4 pt-4 border-t text-[14.5px]"
          style={{ borderColor: 'var(--line)' }}
        >
          <span style={{ color: 'var(--ink)' }}>Total paid</span>
          <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>{formatUSD(total)}</span>
        </div>
      </div>

      <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
        Attach this slip to the outside of your package. Intake staff scan the code above to open your
        submission and log photos automatically.
      </p>
    </section>
  )
}
