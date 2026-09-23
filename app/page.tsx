import Image from 'next/image'
import Link from 'next/link'
import { AnimatedSection } from '../components/AnimatedSection'
import { SOCIAL_LINKS } from '../lib/social-links'
import { siteConfig } from '../lib/site-config'
import { WhatsappIcon } from '../components/SocialIcons'
// Whatnot Live is shelved for now (launch is focused purely on grading
// submissions and shop inventory) -- component and import kept, just
// commented out, so re-enabling later is a two-line uncomment.
// import { WhatnotBanner } from '../components/WhatnotBanner'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white selection:bg-amber-500 selection:text-slate-900">
      
      {/* Hero Section */}
      <section className="relative min-h-[80vh] flex items-center overflow-hidden">
        {/* Background layer: the brand logo as a bold, high-opacity feature
            element (raised from an earlier subtle opacity-10 watermark on
            explicit request, since the gold/green colors were too dull to
            read as branding at that level). object-contain (not
            object-cover) keeps the whole crown+wordmark mark visible rather
            than cropping it at different breakpoints -- this is a decorative
            background pattern, not content, so alt is deliberately empty
            (the Navbar's logo already carries the real alt={siteConfig.name}
            text for assistive tech). pointer-events-none plus z-0 (below the
            z-10 content layer) guarantee it never intercepts clicks meant
            for the buttons below. */}
        <Image
          src="/images/cuppascards-logo.png"
          alt=""
          fill
          sizes="100vw"
          priority
          className="absolute inset-0 z-0 object-contain opacity-80 pointer-events-none select-none"
        />

        {/* Foreground layer: just the two CTAs now -- no text content sits
            over the logo any more (the pill badge and "Making Grading Easy"
            subheadline are both gone on explicit request). On desktop the
            wide max-w-7xl + justify-between frame the logo by pushing the
            buttons to opposite edges; the section's own `flex items-center`
            centers this row vertically, so it lines up with the logo's own
            center for free without any extra positioning math. Below `sm`
            the row collapses to a centered stack so the buttons never
            crowd the logo mark on narrow screens. */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 md:px-12 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-4">
            <Link
              href="/dashboard"
              className="w-full sm:w-auto bg-brand-gold hover:bg-[#d9a000] text-black font-bold text-lg px-8 py-4 rounded-xl border-2 border-black transition-all duration-200 ease-fluid active:scale-[0.97] shadow-[0_0_20px_rgba(253,200,47,0.25)] hover:shadow-[0_0_25px_rgba(253,200,47,0.45)]"
            >
              Start a Submission
            </Link>
            <Link
              href="/shop"
              className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-white font-bold text-lg px-8 py-4 rounded-xl border border-slate-700 transition-all duration-200 ease-fluid active:scale-[0.97]"
            >
              Browse the Shop
            </Link>
          </div>
        </div>

        {/* Ambient decorative glow, unchanged from before -- sits behind both
            the watermark and the content since it's the most-negative z-index
            in this stack. */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-amber-500/5 rounded-full blur-3xl -z-10 pointer-events-none"></div>
      </section>

      {/* <WhatnotBanner /> */}

      {/* How It Works Section */}
      <section className="py-28 md:py-32 bg-slate-950 border-y border-slate-800/70">
        <div className="max-w-6xl mx-auto px-6">
          <AnimatedSection className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              The Easiest Way to Grade
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto text-lg">
              Skip the international shipping headaches and customs paperwork. We manage the entire pipeline from South Africa to the world and back.
            </p>
          </AnimatedSection>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <AnimatedSection
              delay={0}
              className="bg-slate-900 border border-slate-800/70 p-8 rounded-2xl transition-all duration-300 ease-fluid hover:border-amber-500/50 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 group"
            >
              <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center text-xl font-black mb-6 transition-transform duration-300 ease-fluid group-hover:scale-110">1</div>
              <h3 className="text-xl font-bold text-slate-100 mb-3">Submit Online</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Use our integrated TCGdex database to quickly search and add your cards to your digital queue.
              </p>
            </AnimatedSection>

            {/* Step 2 */}
            <AnimatedSection
              delay={0.1}
              className="bg-slate-900 border border-slate-800/70 p-8 rounded-2xl transition-all duration-300 ease-fluid hover:border-amber-500/50 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 group"
            >
              <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center text-xl font-black mb-6 transition-transform duration-300 ease-fluid group-hover:scale-110">2</div>
              <h3 className="text-xl font-bold text-slate-100 mb-3">Secure Logistics</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Send your cards to our local hub. We meticulously prep, pack, and express ship your submissions.
              </p>
            </AnimatedSection>

            {/* Step 3 */}
            <AnimatedSection
              delay={0.2}
              className="bg-slate-900 border border-slate-800/70 p-8 rounded-2xl transition-all duration-300 ease-fluid hover:border-amber-500/50 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 group"
            >
              <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center text-xl font-black mb-6 transition-transform duration-300 ease-fluid group-hover:scale-110">3</div>
              <h3 className="text-xl font-bold text-slate-100 mb-3">Slabs to Your Door</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Track your order's progress live on your dashboard. We handle all import customs and deliver the pristine slabs right back to you.
              </p>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* WhatsApp Community CTA */}
      <section className="py-24 md:py-28">
        <div className="max-w-4xl mx-auto px-6">
          <AnimatedSection className="relative overflow-hidden rounded-3xl border border-[#25D366]/20 bg-gradient-to-br from-slate-800 to-slate-900 px-8 py-14 md:py-16 text-center">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#25D366]/10 rounded-full blur-3xl -z-10 pointer-events-none" />
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              Join the {siteConfig.name} Community
            </h2>
            <p className="text-slate-300 text-lg leading-relaxed mb-8 max-w-xl mx-auto">
              Join our exclusive WhatsApp group to be the first to know about new product pre-orders, flash sales,
              and upcoming grading submission deadlines!
            </p>
            <a
              href={SOCIAL_LINKS.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 bg-[#25D366] hover:bg-[#20bd5c] text-slate-950 font-bold text-lg px-8 py-4 rounded-xl transition-all duration-200 ease-fluid active:scale-[0.97] shadow-[0_0_20px_rgba(37,211,102,0.25)] hover:shadow-[0_0_25px_rgba(37,211,102,0.4)]"
            >
              <WhatsappIcon className="w-5 h-5" />
              Join the WhatsApp Group
            </a>
          </AnimatedSection>
        </div>
      </section>
    </div>
  )
}