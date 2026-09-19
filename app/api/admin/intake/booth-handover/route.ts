import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { getContact } from '@/lib/email/send-order-confirmation'
import { sendGradingUpdate } from '@/lib/email/send-grading-update'
import type { GradingCompany, ProductRegion, SubmissionTier } from '@/lib/submission-types'

interface Body {
  pin: string
}

const PIN_PATTERN = /^\d{4}$/

/**
 * The "Booth Handover" step of in-person event drop-off
 * (0062_add_in_person_event_intake.sql): an admin enters the 4-digit PIN
 * shown on the customer's confirmation screen (or the QR code, via the
 * existing /api/admin/intake/lookup?token= path -- this route only handles
 * the PIN case). Scoped to intake_channel = 'in_person_event' and
 * intake_verified_at is null, rather than a bare PIN match, since a raw
 * 4-digit PIN alone isn't unique across all submissions ever created --
 * only currently-awaiting-handover ones are real candidates.
 *
 * The update itself re-applies that same `is('intake_verified_at', null)`
 * guard as an atomic UPDATE ... WHERE (not a separate read-then-write), so
 * two admins racing the same PIN can't both "win" and double-send the
 * RECEIVED_HQ email.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const { supabase, user } = auth

  const body = (await request.json()) as Body
  const pin = body.pin?.trim()
  if (!pin || !PIN_PATTERN.test(pin)) {
    return NextResponse.json({ error: 'Enter the 4-digit handover PIN' }, { status: 400 })
  }

  const { data: updated, error: updateError } = await supabase
    .from('submissions')
    .update({ intake_verified_at: new Date().toISOString() })
    .eq('handover_pin', pin)
    .eq('intake_channel', 'in_person_event')
    .is('intake_verified_at', null)
    .select('id, qr_code_token, user_id, grading_company, tier, region, event_slug')
    .single()

  if (updateError || !updated) {
    return NextResponse.json({ error: 'No submission awaiting handover matches that PIN' }, { status: 404 })
  }

  // Best-effort from here -- a failed email must never undo a handover that
  // already physically happened (same contract as every other send-*
  // function in lib/email/, e.g. app/api/webhooks/payfast/route.ts's
  // sendSubmissionConfirmationEmail calls).
  try {
    const { data: items } = await supabase
      .from('submission_items')
      .select('card_name, set_name, card_number')
      .eq('submission_id', updated.id)

    const { fullName, email } = await getContact(supabase, updated.user_id)
    if (email) {
      await sendGradingUpdate({
        stage: 'RECEIVED_HQ',
        customer: { name: fullName || email, email },
        submissionId: updated.id,
        submissionLabel: `Grading Submission #${updated.id.slice(0, 8).toUpperCase()}`,
        gradingCompany: updated.grading_company as GradingCompany,
        tier: updated.tier as SubmissionTier,
        region: updated.region as ProductRegion,
        cards: (items ?? []).map((item) => ({
          cardName: item.card_name,
          setName: item.set_name,
          cardNumber: item.card_number,
        })),
        // No dual-surface photos yet at the moment of handover -- those
        // come from a later, separate intake-photo step
        // (app/api/admin/intake/photo). See received-hq.ts's header
        // comment for how the template handles this being empty.
        inspectionPhotos: [],
      })
    } else {
      console.error('booth-handover: no contact email for submission', updated.id)
    }
  } catch (err) {
    console.error('booth-handover: RECEIVED_HQ email failed for submission', updated.id, err)
  }

  console.log('Booth handover verified by admin', user.id, 'for submission', updated.id)

  return NextResponse.json({ submissionId: updated.id, qrCodeToken: updated.qr_code_token })
}
