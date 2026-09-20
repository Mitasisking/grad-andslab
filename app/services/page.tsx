import Link from 'next/link'
import { siteConfig } from '@/lib/site-config'

interface PrepStep {
  label: string
}

const PREP_STEPS: PrepStep[] = [
  { label: 'Careful surface evaluation under high-lumen lighting.' },
  { label: 'Gentle removal of surface dust and oily fingerprints.' },
  {
    label:
      'Application of premium, non-abrasive card care polishes to reduce the appearance of light surface scratches on holographic foils.',
  },
  { label: 'Final wipe-down with ultra-soft microfiber.' },
  { label: 'Secure transfer into a fresh penny sleeve and protective semi-rigid holder for grading transit.' },
]

export const metadata = {
  title: `Card Prep Services | ${siteConfig.name}`,
  description: 'Professional cleaning and preparation for your cards before grading submission.',
}

export default function ServicesPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Hero */}
      <section className="relative pt-28 pb-16 md:pt-36 md:pb-20 overflow-hidden">
        <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
          <div className="inline-block mb-4 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-semibold text-emerald-400 tracking-wide">
            CARD PREP SERVICES
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600 mb-6 tracking-tight">
            Card Cleaning &amp; Preparation Services
          </h1>
          <p className="text-lg md:text-xl text-slate-300 leading-relaxed">
            Before your cards ever reach PCG or ACE, our team gives each one a careful clean and polish pass —
            so nothing but the card itself stands between it and a perfect grade.
          </p>
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-amber-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />
      </section>

      {/* Process */}
      <section className="py-16 md:py-20 bg-slate-950 border-y border-slate-800">
        <div className="max-w-3xl mx-auto px-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-8">The Process</h2>
            <ol className="space-y-5">
              {PREP_STEPS.map((step, i) => (
                <li key={step.label} className="flex items-start gap-4">
                  <div className="w-8 h-8 shrink-0 bg-amber-500/10 text-amber-500 rounded-lg flex items-center justify-center text-sm font-black">
                    {i + 1}
                  </div>
                  <p className="text-slate-300 leading-relaxed pt-1">{step.label}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 md:py-20">
        <div className="max-w-md mx-auto px-6 text-center">
          <div className="bg-slate-800/50 border border-amber-500/30 rounded-2xl p-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Pricing</p>
            <p
              className="text-5xl font-black text-amber-400 mb-2"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              R 500,00
            </p>
            <p className="text-slate-400 text-sm">per card</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-24">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Ready to send your cards in?</h2>
          <p className="text-slate-300 text-lg leading-relaxed mb-8">
            Add prep services to your submission when you check out, or start fresh below.
          </p>
          <Link
            href="/submit"
            className="inline-block bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-lg px-8 py-4 rounded-xl transition shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:shadow-[0_0_25px_rgba(245,158,11,0.4)]"
          >
            Start Your Submission
          </Link>
        </div>
      </section>
    </div>
  )
}
