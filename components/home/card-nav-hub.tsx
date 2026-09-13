'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { Canvas } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { NavCardMesh } from './nav-card-mesh'

interface NavCard {
  title: string
  subheading: string
  href: string
  image: string
}

const NAV_CARDS: NavCard[] = [
  {
    title: 'Submit Cards',
    subheading: 'Official PCG & ACE Grading Submissions',
    href: '/submit',
    image: '/images/home-cards/submit-cards.png',
  },
  {
    title: 'Shop & Live Auctions',
    subheading: 'Browse Graded Slabs, Sealed Boxes & Raw Cards',
    href: '/shop',
    image: '/images/home-cards/shop-live-auctions.png',
  },
  {
    title: 'Vendor Portal',
    subheading: 'Sell & Consign Your High-Tier Collection',
    href: '/vendor',
    image: '/images/home-cards/vendor-portal.png',
  },
  {
    title: 'Contact Us',
    subheading: "Get In Touch With Cuppa's Cards",
    href: '/contact',
    image: '/images/home-cards/contact-us.png',
  },
]

function NavCardTexture({ image }: { image: string }) {
  const texture = useTexture(image)
  texture.colorSpace = THREE.SRGBColorSpace
  return <NavCardMesh texture={texture} />
}

/**
 * One nav card = a real WebGL 3D mesh (tilt/hover physics happen in the
 * canvas) wrapped by a genuine Next.js `<Link>` at the DOM level -- clicking
 * anywhere in the card, including on the canvas, bubbles up to this anchor
 * exactly like any other link (no manual router.push, no click-catching
 * overlay). Title/subheading render as normal DOM text over the canvas so
 * they stay crisp and legible regardless of the 3D scene, and the gold glow
 * is a plain CSS box-shadow on hover -- simpler and pixel-crisper than
 * faking bloom inside WebGL for what is fundamentally a UI affordance.
 */
function NavCard({ card }: { card: NavCard }) {
  return (
    <Link
      href={card.href}
      aria-label={`${card.title} -- ${card.subheading}`}
      className="relative block aspect-[63/88] w-full overflow-hidden rounded-2xl border-2 border-slate-700 bg-slate-900 shadow-lg transition-[border-color,box-shadow] duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 hover:border-amber-400 hover:shadow-[0_0_28px_-4px_rgba(245,180,50,0.55)]"
    >
      <Canvas
        className="absolute inset-0"
        dpr={[1, 1.8]}
        camera={{ position: [0, 0, 2.6], fov: 32 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[2, 3, 4]} intensity={1} color="#fff3d6" />
        <pointLight position={[-2, -1, 2]} intensity={0.4} color="#e8b84b" />
        <Suspense fallback={null}>
          <NavCardTexture image={card.image} />
        </Suspense>
      </Canvas>

      {/* Legibility scrim + copy, sits above the canvas, non-interactive so clicks pass straight through to the surrounding <Link>. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-slate-950/95 via-slate-950/60 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 sm:p-5">
        <p className="text-base sm:text-lg font-bold text-white drop-shadow-sm">{card.title}</p>
        <p className="mt-1 text-xs sm:text-sm text-amber-300/90 leading-snug">{card.subheading}</p>
      </div>
    </Link>
  )
}

/** Homepage navigation hub -- four real 3D card meshes (tilt + lift on hover), each wrapped in a Next.js Link to its section. */
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
            <NavCard key={card.href} card={card} />
          ))}
        </div>
      </div>
    </section>
  )
}
