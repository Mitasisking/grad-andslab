import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { sendEmail } from '@/lib/email/send-email'
import { renderOrderConfirmedEmail } from '@/lib/email/templates/order-confirmed'
import type { OrderConfirmedPayload } from '@/types/notifications'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Admin-only diagnostic route for the Google SMTP/Nodemailer mail pipeline
 * (lib/email/transporter.ts, lib/email/send-email.ts) -- sends a real
 * ORDER_CONFIRMED email with representative sample data to a target address
 * so the SMTP credentials, template rendering, and delivery can all be
 * confirmed end-to-end from one call. Gated behind requireAdmin() rather
 * than left open: this triggers a real send from the business's mail
 * account to an arbitrary address, same risk class as any other outbound
 * side effect in this codebase (all similarly admin-only).
 */
function buildSamplePayload(targetEmail: string): OrderConfirmedPayload {
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://website-three-iota-83.vercel.app'
  return {
    stage: 'ORDER_CONFIRMED',
    customer: { name: 'Test Customer', email: targetEmail },
    submissionId: '00000000-0000-0000-0000-000000000000',
    submissionLabel: 'Grading Submission #TESTSEND',
    gradingCompany: 'PCG',
    tier: 'standard',
    region: 'sa',
    cards: [
      { cardName: 'Charizard ex', setName: 'Obsidian Flames', cardNumber: '125', declaredValue: 1500 },
      { cardName: 'Pikachu VMAX', setName: 'Vivid Voltage', cardNumber: '044', declaredValue: 850 },
    ],
    totalPaid: 340,
    packingSlipUrl: `${appBaseUrl}/dashboard/submissions/00000000-0000-0000-0000-000000000000`,
    qrCodeToken: '00000000-0000-0000-0000-000000000000',
  }
}

async function sendTestEmail(targetEmail: string) {
  if (!EMAIL_PATTERN.test(targetEmail)) {
    return NextResponse.json({ success: false, error: 'Please provide a valid email address.' }, { status: 400 })
  }

  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://website-three-iota-83.vercel.app'
  const { subject, html } = renderOrderConfirmedEmail(buildSamplePayload(targetEmail), appBaseUrl)

  const result = await sendEmail({ to: targetEmail, subject: `[TEST] ${subject}`, html })

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error ?? 'Send failed' }, { status: 502 })
  }
  return NextResponse.json({ success: true, messageId: result.messageId })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  let targetEmail: unknown
  try {
    const body = await request.json()
    targetEmail = body?.targetEmail
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  if (typeof targetEmail !== 'string' || !targetEmail.trim()) {
    return NextResponse.json({ success: false, error: '"targetEmail" is required' }, { status: 400 })
  }

  return sendTestEmail(targetEmail.trim())
}

/**
 * GET fallback purely for a quick local browser check, e.g.
 * /api/test-email?targetEmail=you@example.com — still admin-gated, since it
 * triggers the same real send as the POST path.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const targetEmail = request.nextUrl.searchParams.get('targetEmail')
  if (!targetEmail?.trim()) {
    return NextResponse.json({ success: false, error: 'Pass ?targetEmail=you@example.com' }, { status: 400 })
  }

  return sendTestEmail(targetEmail.trim())
}
