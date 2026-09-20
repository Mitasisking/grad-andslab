import { getTransporter } from '@/lib/email/transporter'

export interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Default "from" for every transactional email so there's one sender
 * identity across the app, unless EMAIL_FROM overrides it. Replaces the old
 * Resend-based getEmailFrom() (lib/email/resend-client.ts, removed) now
 * that sends go over Google SMTP/Nodemailer instead.
 */
function getEmailFrom(): string {
  return process.env.EMAIL_FROM ?? 'CuppasCards <noreply@cuppascards.com>'
}

/**
 * Single entry point for every outbound transactional email in the app --
 * lib/email/send-grading-update.ts and lib/email/send-order-confirmation.ts
 * both call this instead of touching the transporter directly, so the mail
 * provider (currently Google SMTP via Nodemailer) stays swappable behind
 * one function. Does not throw: callers that already treat email as
 * best-effort (never allowed to fail the pipeline event that triggered it)
 * can check `.success` instead of wrapping every call in try/catch.
 */
export async function sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<SendEmailResult> {
  try {
    const info = await getTransporter().sendMail({
      from: getEmailFrom(),
      to,
      subject,
      html,
      text,
    })
    return { success: true, messageId: info.messageId }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('sendEmail failed:', message)
    return { success: false, error: message }
  }
}
