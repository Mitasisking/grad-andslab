'use client'

import { useState, type FormEvent, type ReactNode } from 'react'

const PAST_EVENTS = [
  { name: 'V&A Waterfront TCG Expo', location: 'Cape Town, South Africa', period: 'March 2025' },
  { name: 'Cape Town Collectibles Convention', location: 'Cape Town, South Africa', period: 'July 2025' },
  { name: 'Johannesburg TCG Showdown', location: 'Johannesburg, South Africa', period: 'October 2025' },
  { name: 'Durban Trading Card Meetup', location: 'Durban, South Africa', period: 'January 2026' },
]

const NAV_SECTIONS = [
  { id: 'in-person', label: 'In-Person Submissions' },
  { id: 'history', label: 'Where We’ve Been' },
  { id: 'book-us', label: 'Book Us' },
]

interface VendorForm {
  organizerName: string
  email: string
  eventName: string
  eventDate: string
  location: string
  message: string
  company: string
}

const EMPTY_FORM: VendorForm = {
  organizerName: '',
  email: '',
  eventName: '',
  eventDate: '',
  location: '',
  message: '',
  company: '',
}

const inputClass =
  'w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none'

export default function VendorPage() {
  const [form, setForm] = useState<VendorForm>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function update<K extends keyof VendorForm>(key: K, value: VendorForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setResult(null)

    try {
      const res = await fetch('/api/vendor-inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()

      if (!res.ok) {
        setResult({ type: 'error', text: data.error ?? 'Something went wrong. Please try again.' })
      } else {
        setResult({ type: 'success', text: "Thanks! We'll be in touch shortly about your event." })
        setForm(EMPTY_FORM)
      }
    } catch {
      setResult({ type: 'error', text: 'Network error. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Hero */}
      <section className="relative pt-28 pb-16 md:pt-36 md:pb-20 overflow-hidden">
        <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
          <div className="inline-block mb-4 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-semibold text-emerald-400 tracking-wide">
            FOR EVENT ORGANIZERS
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600 mb-6 tracking-tight">
            Bring Grade &amp; Slab to Your Event
          </h1>
          <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            We vend at TCG expos and collector conventions across South Africa, giving attendees a way to
            submit cards for grading in person — no shipping, no customs, no waiting.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {NAV_SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="px-5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm font-semibold text-slate-200 hover:border-amber-500/50 hover:text-amber-400 transition"
              >
                {s.label}
              </a>
            ))}
          </div>
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-amber-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />
      </section>

      {/* In-Person Submissions */}
      <section id="in-person" className="py-20 md:py-24 bg-slate-950 border-y border-slate-800 scroll-mt-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">In-Person Submissions</h2>
            <p className="text-slate-400 text-lg leading-relaxed">
              Skip the shipping logistics entirely. When we&apos;re vending at your event, attendees can hand
              their raw cards straight to our booth and walk away with a manifest — the same submission
              they&apos;d otherwise mail to us, done on the spot.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard
              number="1"
              title="No Shipping or Customs"
              body="Cards never leave the venue in the mail. We handle intake, photos, and the manifest right at the table."
            />
            <FeatureCard
              number="2"
              title="Every Grading Tier, On-Site"
              body="Attendees choose between PCG, PSA, and ACE Grading tiers the same way they would online, with live USD pricing."
            />
            <FeatureCard
              number="3"
              title="Instant Confirmation"
              body="A scannable manifest code is generated on the spot, so attendees can track their submission from their phone before they've left the floor."
            />
          </div>
        </div>
      </section>

      {/* Where We've Been */}
      <section id="history" className="py-20 md:py-24 scroll-mt-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Where We&apos;ve Been</h2>
            <p className="text-slate-400 text-lg leading-relaxed">
              A look at the shows we&apos;ve set up a booth at.{' '}
              <span className="text-slate-500">(Placeholder events shown below.)</span>
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {PAST_EVENTS.map((event) => (
              <div
                key={event.name}
                className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden flex hover:border-amber-500/50 transition"
              >
                <div className="w-28 shrink-0 bg-slate-900 flex items-center justify-center text-3xl">🎪</div>
                <div className="p-5">
                  <h3 className="text-lg font-bold text-slate-100">{event.name}</h3>
                  <p className="text-sm text-slate-400 mt-1">{event.location}</p>
                  <p className="text-xs text-amber-400 mt-2 font-semibold uppercase tracking-wide">
                    {event.period}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Book Us */}
      <section id="book-us" className="py-20 md:py-24 bg-slate-950 border-t border-slate-800 scroll-mt-16">
        <div className="max-w-2xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Book Us for Your Event</h2>
            <p className="text-slate-400 text-lg leading-relaxed">
              Running a TCG expo or collectibles show? Tell us about it and we&apos;ll get back to you about
              vending.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="bg-slate-800 border border-slate-700 rounded-2xl p-6 md:p-8 space-y-5">
            {/* Honeypot -- invisible to real visitors, catches simple bots that fill every field */}
            <input
              type="text"
              name="company"
              value={form.company}
              onChange={(e) => update('company', e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              className="hidden"
              aria-hidden="true"
            />

            <div className="grid sm:grid-cols-2 gap-5">
              <Field label="Organizer Name">
                <input
                  required
                  type="text"
                  value={form.organizerName}
                  onChange={(e) => update('organizerName', e.target.value)}
                  className={inputClass}
                  placeholder="Jane Smith"
                />
              </Field>
              <Field label="Email">
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  className={inputClass}
                  placeholder="jane@example.com"
                />
              </Field>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <Field label="Event Name">
                <input
                  required
                  type="text"
                  value={form.eventName}
                  onChange={(e) => update('eventName', e.target.value)}
                  className={inputClass}
                  placeholder="Cape Town Collectibles Convention"
                />
              </Field>
              <Field label="Event Date">
                <input
                  required
                  type="date"
                  value={form.eventDate}
                  onChange={(e) => update('eventDate', e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label="Location">
              <input
                required
                type="text"
                value={form.location}
                onChange={(e) => update('location', e.target.value)}
                className={inputClass}
                placeholder="V&A Waterfront, Cape Town"
              />
            </Field>

            <Field label="Event Details / Message">
              <textarea
                required
                rows={5}
                value={form.message}
                onChange={(e) => update('message', e.target.value)}
                className={inputClass}
                placeholder="Tell us about expected attendance, booth requirements, dates, and anything else that would help us plan."
              />
            </Field>

            {result && (
              <p className={`text-sm ${result.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>
                {result.text}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-base px-6 py-3.5 rounded-xl transition disabled:opacity-50"
            >
              {submitting ? 'Sending…' : 'Send Inquiry'}
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}

function FeatureCard({ number, title, body }: { number: string; title: string; body: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl hover:border-amber-500/50 transition duration-300 group">
      <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center text-xl font-black mb-6 group-hover:scale-110 transition duration-300">
        {number}
      </div>
      <h3 className="text-xl font-bold text-slate-100 mb-3">{title}</h3>
      <p className="text-slate-400 text-sm leading-relaxed">{body}</p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">{label}</span>
      {children}
    </label>
  )
}
