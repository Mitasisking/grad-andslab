const DO_ITEMS = [
  'Include packing slip',
  'Use clear loose penny sleeves',
  'Use clean semi-rigids',
  'Pack in packing slip order',
  'Check declared values (especially for PSA)',
  'Use tracked courier',
]

const DONT_ITEMS = [
  'Use Sellotape/packing tape',
  'Send in hard toploaders',
  'Use colored/ETB or perfect-fit sleeves',
  'Use tight rubber bands',
  'Use standard paper envelopes',
  'Send untracked mail',
]

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}

/** Premium "Do / Don't" packaging guide for the /prepare page, below the numbered step-by-step instructions. */
export function PackagingGuidelines() {
  return (
    <section className="py-16 md:py-20">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-10">
          <p className="text-[#D4AF37] text-xs font-bold uppercase tracking-widest mb-2">Quick Reference</p>
          <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">Do&apos;s and Don&apos;ts</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Do */}
          <div
            className="rounded-2xl bg-slate-900 border border-slate-800 border-t-4 p-6 md:p-8"
            style={{ borderTopColor: '#D4AF37' }}
          >
            <h3 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
              <span className="text-[#D4AF37]">Do</span>
            </h3>
            <ul className="space-y-3.5">
              {DO_ITEMS.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-[#D4AF37]/10 text-[#D4AF37] flex items-center justify-center mt-0.5">
                    <CheckIcon className="w-3 h-3" />
                  </span>
                  <span className="text-slate-200 leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Don't */}
          <div className="rounded-2xl bg-neutral-950 border border-slate-800 border-t-4 border-t-red-500 p-6 md:p-8">
            <h3 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
              <span className="text-red-500">Don&apos;t</span>
            </h3>
            <ul className="space-y-3.5">
              {DONT_ITEMS.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mt-0.5">
                    <XIcon className="w-3 h-3" />
                  </span>
                  <span className="text-slate-200 leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
