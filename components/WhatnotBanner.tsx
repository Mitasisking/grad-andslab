import Link from 'next/link'
import { WHATNOT_LINKS } from '../lib/social-links'

// No verified official Whatnot logo mark is available here, so this is a
// generic "live broadcast" glyph (a play triangle in a signal ring) rather
// than a claimed brand icon -- swap for a real Whatnot asset if the brand
// ever provides one.
function BroadcastIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9.25" />
      <path d="M10.3 8.6v6.8l5.6-3.4-5.6-3.4z" fill="currentColor" stroke="none" />
    </svg>
  )
}

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/30">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
      </span>
      <span className="text-[10.5px] font-bold text-red-400 uppercase tracking-wide">Live</span>
    </span>
  )
}

interface StreamCardProps {
  label: string
  href: string
}

function StreamCard({ label, href }: StreamCardProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group w-full sm:w-auto sm:min-w-[300px] flex items-center justify-between gap-5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/50 rounded-xl px-6 py-4 transition"
    >
      <span className="flex items-center gap-3">
        <BroadcastIcon className="w-6 h-6 text-amber-400 shrink-0" />
        <span className="text-left">
          <span className="block text-white font-bold text-[15px]">{label}</span>
          <span className="block text-slate-400 text-[12px] group-hover:text-slate-300 transition">
            Watch on Whatnot
          </span>
        </span>
      </span>
      <LiveBadge />
    </a>
  )
}

/** Prominent homepage callout for Whatnot live streaming, a core part of the USA/UK operations. */
export function WhatnotBanner() {
  return (
    <section className="relative py-14 md:py-16 bg-neutral-950 border-y border-slate-800 overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-red-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

      <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
        <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
          <span className="text-[11px] font-bold text-red-400 uppercase tracking-wide">Live Now on Whatnot</span>
        </div>

        <h2 className="text-3xl md:text-4xl font-black text-white mb-3 tracking-tight">
          Catch Us Live on Whatnot!
        </h2>
        <p className="text-slate-400 text-base md:text-lg max-w-xl mx-auto mb-8 leading-relaxed">
          Join our daily live streams for exclusive box breaks, singles auctions, and giveaways.
        </p>

        <div className="flex justify-center">
          <StreamCard label="USA Stream" href={WHATNOT_LINKS.usa} />
        </div>

        <p className="text-slate-500 text-[12.5px] mt-6">
          Live auctions and giveaways are subject to our{' '}
          <Link href="/terms" className="underline underline-offset-2 hover:text-slate-300 transition">
            Terms of Service
          </Link>
          .
        </p>
      </div>
    </section>
  )
}
