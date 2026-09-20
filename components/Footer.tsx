import Link from 'next/link'
import { SOCIAL_LINKS } from '../lib/social-links'
import { siteConfig } from '../lib/site-config'
import { FacebookIcon, InstagramIcon, TiktokIcon, WhatsappIcon } from './SocialIcons'

/** Site-wide footer, mounted once in app/layout.tsx (same as Navbar) so every page -- not just the homepage, which used to inline this -- links out to the legal/policy pages and vendor/contact routes. */
export function Footer() {
  return (
    <footer className="bg-slate-900 py-12 border-t border-slate-800">
      <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8 md:gap-4 text-sm text-slate-500">
        <p>© {new Date().getFullYear()} {siteConfig.name}. All rights reserved.</p>
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          <Link href="/vendor" className="hover:text-amber-400 transition">Vendor Inquiries</Link>
          <Link href="/terms" className="hover:text-amber-400 transition">Terms &amp; Conditions</Link>
          <Link href="/privacy" className="hover:text-amber-400 transition">Privacy Policy</Link>
          <Link href="/refund-policy" className="hover:text-amber-400 transition">Refund Policy</Link>
          <Link href="/shipping-policy" className="hover:text-amber-400 transition">Shipping Policy</Link>
          <Link href="/contact" className="hover:text-amber-400 transition">Contact Us</Link>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Follow Us</span>
          <div className="flex items-center gap-4">
            <a
              href={SOCIAL_LINKS.facebook}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${siteConfig.name} on Facebook`}
              className="flex items-center gap-1.5 hover:text-amber-400 transition"
            >
              <FacebookIcon className="w-4 h-4" />
              <span>Facebook</span>
            </a>
            <a
              href={SOCIAL_LINKS.instagram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${siteConfig.name} on Instagram`}
              className="flex items-center gap-1.5 hover:text-amber-400 transition"
            >
              <InstagramIcon className="w-4 h-4" />
              <span>Instagram</span>
            </a>
            <a
              href={SOCIAL_LINKS.tiktok}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${siteConfig.name} on TikTok`}
              className="flex items-center gap-1.5 hover:text-amber-400 transition"
            >
              <TiktokIcon className="w-4 h-4" />
              <span>TikTok</span>
            </a>
            <a
              href={SOCIAL_LINKS.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${siteConfig.name} on WhatsApp`}
              className="flex items-center gap-1.5 hover:text-[#25D366] transition"
            >
              <WhatsappIcon className="w-4 h-4" />
              <span>WhatsApp</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
