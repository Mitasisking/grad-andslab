import Link from 'next/link'
import { SOCIAL_LINKS } from '../lib/social-links'
import { FacebookIcon, InstagramIcon, TiktokIcon, WhatsappIcon } from '../components/SocialIcons'
import { WhatnotBanner } from '../components/WhatnotBanner'
import { FeaturedCarousel } from '../components/FeaturedCarousel'
import { getSupabaseRouteClient } from '../lib/supabase-route-client'
import { getFeaturedProducts } from '../lib/shop/featured-products'
import { REGION_OPTIONS, type ProductRegion } from '../lib/shop/product-type'

const VALID_REGIONS = new Set(REGION_OPTIONS.map((r) => r.value))

interface HomePageProps {
  searchParams: Promise<{ region?: string }>
}

export default async function HomePage({ searchParams }: HomePageProps) {
  // No site-wide "active region" concept exists yet (RegionToggle on /shop
  // is purely a per-request URL param, not a persisted preference) -- 'sa'
  // is the default every other region-aware surface in this app already
  // falls back to, and ?region= lets a link (e.g. from /shop) opt into a
  // different one for this carousel specifically.
  const { region } = await searchParams
  const activeRegion: ProductRegion = region && VALID_REGIONS.has(region as ProductRegion) ? (region as ProductRegion) : 'sa'

  const supabase = await getSupabaseRouteClient()
  const featuredProducts = await getFeaturedProducts(supabase, activeRegion)

  return (
    <div className="min-h-screen bg-slate-900 text-white selection:bg-amber-500 selection:text-slate-900">
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-block mb-4 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-semibold text-emerald-400 tracking-wide uppercase">
            Official PCG and ACE Middleman
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-[#D4AF37] mb-6 tracking-tight [-webkit-text-stroke:1.5px_black]">
            Cuppa Cards
          </h1>
          <p className="text-xl md:text-2xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            South Africa's premier middleman service. Making it easy to grade your cards.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="w-full sm:w-auto bg-[#D4AF37] hover:bg-[#c4a02f] text-black font-bold text-lg px-8 py-4 rounded-xl border-2 border-black transition shadow-[0_0_20px_rgba(212,175,55,0.25)] hover:shadow-[0_0_25px_rgba(212,175,55,0.45)]"
            >
              Start a Submission
            </Link>
            <Link 
              href="/shop" 
              className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-white font-bold text-lg px-8 py-4 rounded-xl border border-slate-700 transition"
            >
              Browse the Shop
            </Link>
          </div>
        </div>
        
        {/* Background decorative glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-amber-500/5 rounded-full blur-3xl -z-10 pointer-events-none"></div>
      </section>

      <WhatnotBanner />

      <FeaturedCarousel products={featuredProducts} />

      {/* How It Works Section */}
      <section className="py-24 bg-slate-950 border-y border-slate-800">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">The Easiest Way to Grade</h2>
            <p className="text-slate-400 max-w-xl mx-auto text-lg">
              Skip the international shipping headaches and customs paperwork. We manage the entire pipeline from South Africa to the world and back.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl hover:border-amber-500/50 transition duration-300 group">
              <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center text-xl font-black mb-6 group-hover:scale-110 transition duration-300">1</div>
              <h3 className="text-xl font-bold text-slate-100 mb-3">Submit Online</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Use our integrated TCGdex database to quickly search and add your cards to your digital queue. Choose your turnaround tier starting from just $19.95 per card.
              </p>
            </div>
            
            {/* Step 2 */}
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl hover:border-amber-500/50 transition duration-300 group">
              <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center text-xl font-black mb-6 group-hover:scale-110 transition duration-300">2</div>
              <h3 className="text-xl font-bold text-slate-100 mb-3">Secure Logistics</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Send your cards to our local hub. We meticulously prep, pack, and express ship your submissions via DHL with full fine-art insurance included.
              </p>
            </div>
            
            {/* Step 3 */}
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl hover:border-amber-500/50 transition duration-300 group">
              <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center text-xl font-black mb-6 group-hover:scale-110 transition duration-300">3</div>
              <h3 className="text-xl font-bold text-slate-100 mb-3">Slabs to Your Door</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Track your order's progress live on your dashboard. Once graded, we handle all import customs and deliver the pristine slabs right back to your address.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* WhatsApp Community CTA */}
      <section className="py-20 md:py-24">
        <div className="max-w-4xl mx-auto px-6">
          <div className="relative overflow-hidden rounded-3xl border border-[#25D366]/20 bg-gradient-to-br from-slate-800 to-slate-900 px-8 py-14 md:py-16 text-center">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#25D366]/10 rounded-full blur-3xl -z-10 pointer-events-none" />
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Join the Cuppa Cards Community</h2>
            <p className="text-slate-300 text-lg leading-relaxed mb-8 max-w-xl mx-auto">
              Join our exclusive WhatsApp group to be the first to know about new product pre-orders, flash sales,
              and upcoming grading submission deadlines!
            </p>
            <a
              href={SOCIAL_LINKS.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 bg-[#25D366] hover:bg-[#20bd5c] text-slate-950 font-bold text-lg px-8 py-4 rounded-xl transition shadow-[0_0_20px_rgba(37,211,102,0.25)] hover:shadow-[0_0_25px_rgba(37,211,102,0.4)]"
            >
              <WhatsappIcon className="w-5 h-5" />
              Join the WhatsApp Group
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 py-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8 md:gap-4 text-sm text-slate-500">
          <p>© {new Date().getFullYear()} Cuppa Cards. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/vendor" className="hover:text-amber-400 transition">Vendor Inquiries</Link>
            <Link href="/terms" className="hover:text-amber-400 transition">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-amber-400 transition">Privacy Policy</Link>
            <Link href="/contact" className="hover:text-amber-400 transition">Contact Us</Link>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Follow Us</span>
            <div className="flex items-center gap-4">
              <a
                href={SOCIAL_LINKS.facebook}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Cuppa Cards on Facebook"
                className="flex items-center gap-1.5 hover:text-amber-400 transition"
              >
                <FacebookIcon className="w-4 h-4" />
                <span>Facebook</span>
              </a>
              <a
                href={SOCIAL_LINKS.instagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Cuppa Cards on Instagram"
                className="flex items-center gap-1.5 hover:text-amber-400 transition"
              >
                <InstagramIcon className="w-4 h-4" />
                <span>Instagram</span>
              </a>
              <a
                href={SOCIAL_LINKS.tiktok}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Cuppa Cards on TikTok"
                className="flex items-center gap-1.5 hover:text-amber-400 transition"
              >
                <TiktokIcon className="w-4 h-4" />
                <span>TikTok</span>
              </a>
              <a
                href={SOCIAL_LINKS.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Cuppa Cards on WhatsApp"
                className="flex items-center gap-1.5 hover:text-[#25D366] transition"
              >
                <WhatsappIcon className="w-4 h-4" />
                <span>WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}