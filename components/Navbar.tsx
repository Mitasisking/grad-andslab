'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { SOCIAL_LINKS } from '../lib/social-links'
import { siteConfig } from '../lib/site-config'
import { FacebookIcon, InstagramIcon, TiktokIcon } from './SocialIcons'

/** "Mitchell" -> "Mitchell's", "James" -> "James'" (standard English possessive rule for a name already ending in s). */
function possessive(firstName: string): string {
  return /s$/i.test(firstName) ? `${firstName}'` : `${firstName}'s`
}

export default function Navbar() {
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  // First name pulled from profiles.full_name (synced from auth signup metadata
  // by the handle_new_user trigger, supabase/migrations/0040) -- same source
  // app/dashboard/page.tsx's "Welcome back, {full_name}" already reads.
  // Starts null on both the server render and this component's first client
  // render (no session is resolvable during either), so there is nothing to
  // reconcile once the effect below resolves it -- same pattern `user`/
  // `isAdmin` already rely on, not a new hydration risk.
  const [firstName, setFirstName] = useState<string | null>(null)
  // Drives a subtle shadow/border fade-in once the page scrolls past the
  // very top -- a soft depth cue for this sticky header (2026-09-24 UX
  // polish pass), not present at rest so the homepage hero reads clean.
  const [isScrolled, setIsScrolled] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 8)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setUser(session?.user || null)

        if (session?.user?.id) {
          // Use maybeSingle() instead of single() to prevent 406/400 errors if profile row is missing
          const { data, error } = await supabase
            .from('profiles')
            .select('role, full_name')
            .eq('id', session.user.id)
            .maybeSingle()

          if (!error && data) {
            setIsAdmin(data.role === 'admin')
            setFirstName(data.full_name?.trim().split(/\s+/)[0] || null)
          } else {
            setIsAdmin(false)
            setFirstName(null)
          }
        } else {
          setIsAdmin(false)
          setFirstName(null)
        }
      } catch (err) {
        console.error('Error checking user session:', err)
        setIsAdmin(false)
        setFirstName(null)
      }
    }

    checkUser()

    // Listen for logins and logouts in real-time
    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user || null)

      if (session?.user?.id) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('role, full_name')
            .eq('id', session.user.id)
            .maybeSingle()

          if (!error && data) {
            setIsAdmin(data.role === 'admin')
            setFirstName(data.full_name?.trim().split(/\s+/)[0] || null)
          } else {
            setIsAdmin(false)
            setFirstName(null)
          }
        } catch (err) {
          setIsAdmin(false)
          setFirstName(null)
        }
      } else {
        setIsAdmin(false)
        setFirstName(null)
      }
    })

    return () => {
      authListener?.unsubscribe()
    }
  }, [])

  const submissionsLabel = firstName ? `${possessive(firstName)} Submissions` : 'My Submissions'

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Hide the navbar on the login/signup screens for a cleaner look
  if (pathname === '/login' || pathname === '/signup') return null

  return (
    <nav
      className={`print:hidden bg-slate-950 text-white sticky top-0 z-50 border-b transition-all duration-300 ease-fluid ${
        isScrolled ? 'border-slate-800 shadow-lg shadow-black/30' : 'border-transparent shadow-none'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 py-3 flex justify-between items-center">

        {/* Left Side: Logo & Main Links */}
        <div className="flex items-center gap-10">
          {/* Real transparent-background brand PNG. The file originally
              supplied for this task had the checkerboard baked into its
              opaque RGB pixels (PNG colorType 2, no alpha channel) rather
              than real transparency; it was re-processed with a sharp-based
              chroma-key script (keys out low-chroma/near-grey pixels,
              preserves the high-chroma gold/green brand colors) into a true
              RGBA PNG (colorType 6) before being used here -- see
              PROJECT_STATE.md for the full detail. No more "logo card" seam
              against this navbar's bg-slate-950.
              Sized up from h-8/h-10 to h-14/h-20 on explicit request for a
              more prominent brand presence -- the underlying file is the
              same 2400x1524 master used everywhere else on the site (not a
              pre-cropped small asset), so Next's image optimizer regenerates
              a sharp version at this larger render size with no quality
              loss; nothing needed re-sourcing at higher resolution. The
              outer row's own items-center keeps it vertically centered
              against the nav links regardless of height, and the row gap
              was widened (gap-8 -> gap-10) so the bigger mark doesn't crowd
              them. */}
          <Link href="/" className="shrink-0 opacity-100 hover:opacity-80 transition ease-fluid">
            <Image
              src="/images/cuppascards-logo.png"
              alt={siteConfig.name}
              width={257}
              height={163}
              className="h-14 sm:h-20 w-auto object-contain"
              priority
            />
          </Link>

          <div className="hidden md:flex gap-6 text-sm font-medium text-slate-300">
            <Link href="/submit" className={`hover:text-amber-400 transition ease-fluid ${pathname === '/submit' ? 'text-amber-400' : ''}`}>
              Submit
            </Link>
            <Link href="/dashboard" className={`hover:text-amber-400 transition ease-fluid ${pathname === '/dashboard' ? 'text-amber-400' : ''}`}>
              {submissionsLabel}
            </Link>
            <Link href="/shop" className={`hover:text-amber-400 transition ease-fluid ${pathname === '/shop' ? 'text-amber-400' : ''}`}>
              Shop
            </Link>
            <Link href="/vendor" className={`hover:text-amber-400 transition ease-fluid ${pathname === '/vendor' ? 'text-amber-400' : ''}`}>
              Vendor
            </Link>
            <Link href="/contact" className={`hover:text-amber-400 transition ease-fluid ${pathname === '/contact' ? 'text-amber-400' : ''}`}>
              Contact
            </Link>
          </div>
        </div>

        {/* Right Side: Auth & Admin Controls */}
        <div className="flex items-center gap-4">
          <div className="hidden lg:flex items-center gap-3 pr-1 border-r border-slate-800 mr-1">
            <a
              href={SOCIAL_LINKS.facebook}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${siteConfig.name} on Facebook`}
              className="text-slate-500 hover:text-amber-400 transition ease-fluid"
            >
              <FacebookIcon className="w-4 h-4" />
            </a>
            <a
              href={SOCIAL_LINKS.instagram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${siteConfig.name} on Instagram`}
              className="text-slate-500 hover:text-amber-400 transition ease-fluid"
            >
              <InstagramIcon className="w-4 h-4" />
            </a>
            <a
              href={SOCIAL_LINKS.tiktok}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${siteConfig.name} on TikTok`}
              className="text-slate-500 hover:text-amber-400 transition ease-fluid"
            >
              <TiktokIcon className="w-4 h-4" />
            </a>
          </div>

          {isAdmin && (
            <Link 
              href="/admin" 
              className={`text-xs font-bold px-3 py-1.5 rounded-full border transition ease-fluid ${pathname === '/admin' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'text-slate-400 border-slate-700 hover:text-emerald-400 hover:border-emerald-500/50'}`}
            >
              Admin Portal
            </Link>
          )}
          
          {user ? (
            <button 
              onClick={handleLogout}
              className="text-sm font-medium text-slate-400 hover:text-white transition ease-fluid"
            >
              Log Out
            </button>
          ) : (
            <div className="flex gap-4">
              <Link href="/login" className="text-sm font-medium text-slate-300 hover:text-white transition ease-fluid">
                Log In
              </Link>
              <Link href="/signup" className="text-sm font-medium bg-amber-500 text-slate-950 px-4 py-2 rounded-lg hover:bg-amber-400 transition ease-fluid">
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}