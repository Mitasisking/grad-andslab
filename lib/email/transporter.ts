import nodemailer, { type Transporter } from 'nodemailer'

let transporter: Transporter | null = null

/**
 * Server-only, pooled Nodemailer transporter over Google SMTP, constructed
 * lazily on first use -- building it at module scope would run
 * `nodemailer.createTransport` (and validate the auth shape) at import
 * time, which fires during Next's build-time page-data collection for
 * every route in the file even though none of them had actually sent an
 * email yet. Same lazy-singleton reasoning the old Resend client used.
 *
 * Pooled (`pool: true`) since transactional sends happen in bursts around
 * checkout/webhook events, not one-offs -- reusing a small set of SMTP
 * connections avoids a fresh TLS handshake with Gmail per email.
 */
export function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      pool: true,
      host: process.env.EMAIL_SERVER_HOST,
      port: Number(process.env.EMAIL_SERVER_PORT) || 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_SERVER_USER,
        pass: process.env.EMAIL_SERVER_PASSWORD,
      },
    })
  }
  return transporter
}

/**
 * Health check for the SMTP connection/credentials -- confirms Gmail
 * accepts the configured auth without sending a real email. Intended for
 * an admin diagnostics route or a startup check, not the hot send path.
 */
export async function verifyConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    await getTransporter().verify()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
