import type { ReactNode } from 'react'

/** Shared shell for the four legal/policy pages (terms, privacy, refund-policy, shipping-policy) -- same dark/amber styling as the rest of the marketing site (app/page.tsx, app/prepare/page.tsx), just laid out for long-form reading: a narrow measure, generous line-height, and numbered sections. */
export function LegalPageLayout({
  title,
  lastUpdated,
  intro,
  children,
}: {
  title: string
  lastUpdated: string
  intro?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="max-w-3xl mx-auto px-6 py-20 md:py-28">
        <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600 mb-3 tracking-tight">
          {title}
        </h1>
        <p className="text-sm text-slate-500 mb-12">Last Updated: {lastUpdated}</p>
        {intro && <p className="text-slate-300 leading-relaxed mb-12">{intro}</p>}
        <div className="space-y-12">{children}</div>
      </div>
    </div>
  )
}

export function Section({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
        <span className="text-amber-400">{number}.</span> {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

export function P({ children }: { children: ReactNode }) {
  return <p className="text-slate-300 leading-relaxed">{children}</p>
}

export function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="text-slate-300 leading-relaxed">
      <span className="font-semibold text-slate-100">{label}:</span> {children}
    </p>
  )
}

export function Bullets({ children }: { children: ReactNode }) {
  return <ul className="list-disc pl-5 space-y-2 text-slate-300 leading-relaxed">{children}</ul>
}
