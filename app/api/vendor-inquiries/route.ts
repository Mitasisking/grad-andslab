import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRouteClient } from '@/lib/supabase-route-client'

interface VendorInquiryBody {
  organizerName: string
  email: string
  eventName: string
  eventDate: string
  location: string
  message: string
  // Hidden field on the form -- real visitors never fill it in, so a
  // non-empty value means a bot filled every field it could find.
  company?: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const LIMITS = {
  organizerName: 200,
  email: 320,
  eventName: 200,
  location: 200,
  message: 5000,
} as const

function trimmedOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as VendorInquiryBody

  // Honeypot: pretend to succeed so the bot doesn't learn to skip this field.
  if (body.company) {
    return NextResponse.json({ ok: true }, { status: 201 })
  }

  const organizerName = trimmedOrNull(body.organizerName)
  const email = trimmedOrNull(body.email)
  const eventName = trimmedOrNull(body.eventName)
  const location = trimmedOrNull(body.location)
  const message = trimmedOrNull(body.message)
  const eventDate = typeof body.eventDate === 'string' ? body.eventDate : ''

  if (!organizerName || !email || !eventName || !eventDate || !location || !message) {
    return NextResponse.json({ error: 'Please fill in every field.' }, { status: 400 })
  }

  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }

  if (Number.isNaN(new Date(eventDate).getTime())) {
    return NextResponse.json({ error: 'Please enter a valid event date.' }, { status: 400 })
  }

  const tooLong =
    organizerName.length > LIMITS.organizerName ||
    email.length > LIMITS.email ||
    eventName.length > LIMITS.eventName ||
    location.length > LIMITS.location ||
    message.length > LIMITS.message

  if (tooLong) {
    return NextResponse.json({ error: 'One of your answers is too long.' }, { status: 400 })
  }

  const supabase = await getSupabaseRouteClient()

  // Deliberately not chaining .select() here: vendor_inquiries' SELECT policy
  // is admin-only (see 0024_add_vendor_inquiries.sql), and asking Postgres to
  // RETURN the inserted row would run it through that same policy -- which a
  // signed-out organizer always fails, turning a successful insert into a
  // reported RLS violation on the read-back rather than the write itself.
  const { error } = await supabase.from('vendor_inquiries').insert({
    organizer_name: organizerName,
    email,
    event_name: eventName,
    event_date: eventDate,
    location,
    message,
  })

  if (error) {
    return NextResponse.json({ error: 'Could not submit your inquiry. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
