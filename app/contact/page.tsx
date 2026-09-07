'use client'

import Link from 'next/link'
import { useState, type FormEvent, type ReactNode } from 'react'

interface ContactForm {
  name: string
  email: string
  subject: string
  message: string
  company: string
}

const EMPTY_FORM: ContactForm = {
  name: '',
  email: '',
  subject: '',
  message: '',
  company: '',
}

const inputClass =
  'w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none'

export default function ContactPage() {
  const [form, setForm] = useState<ContactForm>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function update<K extends keyof ContactForm>(key: K, value: ContactForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setResult(null)

    try {
      const res = await fetch('/api/contact-inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()

      if (!res.ok) {
        setResult({ type: 'error', text: data.error ?? 'Something went wrong. Please try again.' })
      } else {
        setResult({ type: 'success', text: "Thanks for reaching out! We'll get back to you shortly." })
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
      <div className="max-w-5xl mx-auto px-6 py-20 md:py-28">
        <div className="grid md:grid-cols-2 gap-16">
          {/* Left: info */}
          <div>
            <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600 mb-6 tracking-tight">
              Get in Touch
            </h1>
            <p className="text-slate-300 text-lg leading-relaxed mb-10">
              Whether you have a question about a grading submission, a product in our shop, or need help tracking
              an order, the Grade &amp; Slab team is here to help!
            </p>

            <div className="space-y-8">
              <InfoRow icon="✉️" label="Email">
                <a href="mailto:support@gradeandslab.com" className="text-amber-400 hover:text-amber-300 transition">
                  support@gradeandslab.com
                </a>
              </InfoRow>
              <InfoRow icon="📍" label="Location">
                South Africa
              </InfoRow>
              <InfoRow icon="🕘" label="Business Hours">
                Monday – Friday, 9:00 AM to 5:00 PM (SAST)
              </InfoRow>
            </div>

            <p className="text-sm text-slate-400 mt-12 pt-8 border-t border-slate-800 leading-relaxed">
              Looking to book us for an event? Visit our{' '}
              <Link href="/vendor" className="text-amber-400 hover:text-amber-300 transition">
                Vendor Page
              </Link>
              .
            </p>
          </div>

          {/* Right: form */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
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

              <Field label="Name">
                <input
                  required
                  type="text"
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
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

              <Field label="Subject">
                <input
                  required
                  type="text"
                  value={form.subject}
                  onChange={(e) => update('subject', e.target.value)}
                  className={inputClass}
                  placeholder="Question about my submission"
                />
              </Field>

              <Field label="Message">
                <textarea
                  required
                  rows={6}
                  value={form.message}
                  onChange={(e) => update('message', e.target.value)}
                  className={inputClass}
                  placeholder="How can we help?"
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
                {submitting ? 'Sending…' : 'Send Message'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ icon, label, children }: { icon: string; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 shrink-0 bg-amber-500/10 rounded-xl flex items-center justify-center text-lg">
        {icon}
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
        <p className="text-slate-200">{children}</p>
      </div>
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
