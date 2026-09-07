import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRouteClient } from '@/lib/supabase-route-client'

interface ContactInquiryBody {
  name: string
  email: string
  subject: string
  message: string
  // Hidden field on the form -- real visitors never fill it in, so a
  // non-empty value means a bot filled every field it could find.
  company?: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const LIMITS = {
  name: 200,
  email: 320,
  subject: 200,
  message: 5000,
} as const

function trimmedOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as ContactInquiryBody

  // Honeypot: pretend to succeed so the bot doesn't learn to skip this field.
  if (body.company) {
    return NextResponse.json({ ok: true }, { status: 201 })
  }

  const name = trimmedOrNull(body.name)
  const email = trimmedOrNull(body.email)
  const subject = trimmedOrNull(body.subject)
  const message = trimmedOrNull(body.message)

  if (!name || !email || !subject || !message) {
    return NextResponse.json({ error: 'Please fill in every field.' }, { status: 400 })
  }

  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }

  const tooLong =
    name.length > LIMITS.name ||
    email.length > LIMITS.email ||
    subject.length > LIMITS.subject ||
    message.length > LIMITS.message

  if (tooLong) {
    return NextResponse.json({ error: 'One of your answers is too long.' }, { status: 400 })
  }

  const supabase = await getSupabaseRouteClient()

  // Deliberately not chaining .select() here: contact_inquiries' SELECT
  // policy is admin-only (see 0030_add_contact_inquiries.sql), and asking
  // Postgres to RETURN the inserted row would run it through that same
  // policy -- which a signed-out visitor always fails, turning a successful
  // insert into a reported RLS violation on the read-back rather than the
  // write itself.
  const { error } = await supabase.from('contact_inquiries').insert({
    name,
    email,
    subject,
    message,
  })

  if (error) {
    return NextResponse.json({ error: 'Could not send your message. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
