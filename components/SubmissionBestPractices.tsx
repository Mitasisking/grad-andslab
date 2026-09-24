'use client'

import { usePathname } from 'next/navigation'

type Practice = { lead: string; detail: string }

const DO_ITEMS: Practice[] = [
  { lead: 'Include your order number:', detail: 'Always place a note with your order number inside your parcel.' },
  {
    lead: 'Use fresh protection:',
    detail: 'Place cards into clear, loose-fit penny sleeves and clean semi-rigid card savers.',
  },
  {
    lead: 'Maintain your sequence:',
    detail: 'Pack your cards in the exact order they appear on your digital submission queue.',
  },
  {
    lead: 'Check your details:',
    detail: 'Ensure your return shipping address is perfectly up to date on your account dashboard.',
  },
]

const DONT_ITEMS: Practice[] = [
  { lead: 'Use Sellotape:', detail: 'Never use sticky tape to seal the tops of semi-rigid card savers.' },
  {
    lead: 'Use untracked shipping:',
    detail: 'Avoid the standard post office. Always use secure, tracked local options like Pudo or The Courier Guy.',
  },
  {
    lead: 'Use tight or coloured sleeves:',
    detail: 'Do not use tight-fit inner sleeves, ETB sleeves, or sleeves with coloured backs. Clear is required.',
  },
  {
    lead: 'Use rubber bands:',
    detail: 'Do not wrap your submission tightly in elastic bands, as this can permanently dent card edges.',
  },
]

// /prepare already renders the longer PackagingGuidelines Do's/Don'ts, so a
// second list there would just repeat it; /admin is internal-only.
const HIDDEN_PREFIXES = ['/prepare', '/admin']

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}

function PracticeList({ items, tone }: { items: Practice[]; tone: 'do' | 'dont' }) {
  const Icon = tone === 'do' ? CheckIcon : XIcon
  return (
    <ul className="space-y-4">
      {items.map((item) => (
        <li key={item.lead} className="flex items-start gap-3">
          <span
            className={`shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center ${
              tone === 'do' ? 'bg-brand-green/15 text-brand-green-light' : 'bg-[color:var(--danger)]/12 text-[color:var(--danger)]'
            }`}
          >
            <Icon className="w-3 h-3" />
          </span>
          <p className="text-[14.5px] leading-relaxed text-slate-300">
            <span className="font-semibold text-slate-100">{item.lead}</span> {item.detail}
          </p>
        </li>
      ))}
    </ul>
  )
}

/** Site-wide "Submission Best Practices" Do's/Don'ts, mounted in app/layout.tsx directly above the Footer. */
export function SubmissionBestPractices() {
  const pathname = usePathname()
  if (HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return null

  return (
    <section aria-labelledby="best-practices-heading" className="print:hidden bg-slate-900 border-t border-slate-800 py-14 md:py-16">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-8 md:mb-10">
          <p className="text-brand-gold text-xs font-bold uppercase tracking-widest mb-2">Before You Ship</p>
          <h2
            id="best-practices-heading"
            className="text-2xl md:text-3xl font-black text-white tracking-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Submission Best Practices
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
          <div className="rounded-2xl border border-[color:var(--card-border)] border-t-2 border-t-brand-green bg-slate-950/60 p-6 md:p-7">
            <h3 className="text-lg font-bold text-brand-green-light mb-5">Do</h3>
            <PracticeList items={DO_ITEMS} tone="do" />
          </div>

          <div className="rounded-2xl border border-[color:var(--card-border)] border-t-2 border-t-[color:var(--danger)] bg-slate-950/60 p-6 md:p-7">
            <h3 className="text-lg font-bold text-[color:var(--danger)] mb-5">Don&apos;t</h3>
            <PracticeList items={DONT_ITEMS} tone="dont" />
          </div>
        </div>
      </div>
    </section>
  )
}
