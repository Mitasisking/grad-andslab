'use client'

import { useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'

interface NavCard {
  title: string
  subheading: string
  href: string
  image: string
  /** Provenance only, not rendered -- the card art used to illustrate each destination. */
  certLabel: string
}

const NAV_CARDS: NavCard[] = [
  {
    title: 'Submit Cards',
    subheading: 'Official PCG & ACE Grading Submissions',
    href: '/submit',
    image: '/images/home-cards/submit-cards.png',
    certLabel: 'Cert 1203192',
  },
  {
    title: 'Shop & Live Auctions',
    subheading: 'Browse Graded Slabs, Sealed Boxes & Raw Cards',
    href: '/shop',
    image: '/images/home-cards/shop-live-auctions.png',
    certLabel: 'Cert 692742',
  },
  {
    title: 'Vendor Portal',
    subheading: 'Sell & Consign Your High-Tier Collection',
    href: '/vendor',
    image: '/images/home-cards/vendor-portal.png',
    certLabel: 'Cert #000063386',
  },
  {
    title: 'Contact Us',
    subheading: "Get In Touch With Cuppa's Cards",
    href: '/contact',
    image: '/images/home-cards/contact-us.png',
    certLabel: 'Cert #000130644',
  },
]

// Only devices with a real mouse (hover + precise pointer) get the tilt --
// touch has no persistent cursor position to tilt toward, and there's no
// reliable "leave" event to spring the card back afterward.
const supportsTilt = () =>
  typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches

const MAX_TILT_DEG = 10

function TiltCard({ card }: { card: NavCard }) {
  const cardRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!supportsTilt() || !cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    // Direct style writes (not React state) so a fast mousemove stream never
    // triggers a re-render -- the same perf reasoning as the /experience
    // page's R3F refs, applied here to plain DOM transforms instead.
    cardRef.current.style.transform = `perspective(900px) rotateX(${(-py * MAX_TILT_DEG).toFixed(2)}deg) rotateY(${(px * MAX_TILT_DEG).toFixed(2)}deg) scale3d(1.03, 1.03, 1.03)`
  }

  const handleMouseLeave = () => {
    if (!cardRef.current) return
    cardRef.current.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)'
  }

  return (
    <Link href={card.href} className="group block [perspective:900px]" aria-label={`${card.title} -- ${card.subheading}`}>
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative aspect-[63/88] w-full overflow-hidden rounded-2xl border-2 border-slate-700 bg-slate-900 shadow-lg transition-[border-color,box-shadow] duration-300 ease-out will-change-transform group-hover:border-amber-400 group-hover:shadow-[0_0_28px_-4px_rgba(245,180,50,0.55)]"
        style={{ transform: 'perspective(900px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)', transition: 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)' }}
      >
        <Image
          src={card.image}
          alt={card.title}
          fill
          sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 22vw"
          className="object-cover"
          priority={false}
        />

        {/* Legibility scrim behind the title/subheading. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-slate-950/95 via-slate-950/60 to-transparent" />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 sm:p-5">
          <p className="text-base sm:text-lg font-bold text-white drop-shadow-sm">{card.title}</p>
          <p className="mt-1 text-xs sm:text-sm text-amber-300/90 leading-snug">{card.subheading}</p>
        </div>
      </div>
    </Link>
  )
}

/** Homepage navigation hub -- four tilt-on-hover cards routing to the site's main sections. */
export function CardNavHub() {
  return (
    <section className="py-16 md:py-20">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-10 md:mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Where To Next?</h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            Everything Cuppa&apos;s Cards offers, one tap away.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {NAV_CARDS.map((card) => (
            <TiltCard key={card.href} card={card} />
          ))}
        </div>
      </div>
    </section>
  )
}
