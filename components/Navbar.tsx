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
  const pathname = usePathname()
  const router = useRouter()

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
    <nav className="print:hidden bg-slate-950 border-b border-slate-800 text-white sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
        
        {/* Left Side: Logo & Main Links */}
        <div className="flex items-center gap-8">
          {/* Horizontal lockup on the brand's Black swatch -- the closest of
              the four background variants in the brand guide to this navbar's
              own bg-slate-950. There's no light-background navbar anywhere on
              this site to switch to, so this is a fixed choice rather than a
              dynamic light/dark swap. */}
          <Link href="/" className="shrink-0 opacity-100 hover:opacity-80 transition">
            <Image
              src="/images/brand/logo-horizontal-black.png"
              alt={siteConfig.name}
              width={356}
              height={132}
              className="h-9 sm:h-10 w-auto"
              priority
            />
          </Link>
          
          <div className="hidden md:flex gap-6 text-sm font-medium text-slate-300">
            <Link href="/submit" className={`hover:text-amber-400 transition ${pathname === '/submit' ? 'text-amber-400' : ''}`}>
              Submit
            </Link>
            <Link href="/dashboard" className={`hover:text-amber-400 transition ${pathname === '/dashboard' ? 'text-amber-400' : ''}`}>
              {submissionsLabel}
            </Link>
            <Link href="/shop" className={`hover:text-amber-400 transition ${pathname === '/shop' ? 'text-amber-400' : ''}`}>
              Shop
            </Link>
            <Link href="/vendor" className={`hover:text-amber-400 transition ${pathname === '/vendor' ? 'text-amber-400' : ''}`}>
              Vendor
            </Link>
            <Link href="/contact" className={`hover:text-amber-400 transition ${pathname === '/contact' ? 'text-amber-400' : ''}`}>
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
              className="text-slate-500 hover:text-amber-400 transition"
            >
              <FacebookIcon className="w-4 h-4" />
            </a>
            <a
              href={SOCIAL_LINKS.instagram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${siteConfig.name} on Instagram`}
              className="text-slate-500 hover:text-amber-400 transition"
            >
              <InstagramIcon className="w-4 h-4" />
            </a>
            <a
              href={SOCIAL_LINKS.tiktok}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${siteConfig.name} on TikTok`}
              className="text-slate-500 hover:text-amber-400 transition"
            >
              <TiktokIcon className="w-4 h-4" />
            </a>
          </div>

          {isAdmin && (
            <Link 
              href="/admin" 
              className={`text-xs font-bold px-3 py-1.5 rounded-full border transition ${pathname === '/admin' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'text-slate-400 border-slate-700 hover:text-emerald-400 hover:border-emerald-500/50'}`}
            >
              Admin Portal
            </Link>
          )}
          
          {user ? (
            <button 
              onClick={handleLogout}
              className="text-sm font-medium text-slate-400 hover:text-white transition"
            >
              Log Out
            </button>
          ) : (
            <div className="flex gap-4">
              <Link href="/login" className="text-sm font-medium text-slate-300 hover:text-white transition">
                Log In
              </Link>
              <Link href="/signup" className="text-sm font-medium bg-amber-500 text-slate-950 px-4 py-2 rounded-lg hover:bg-amber-400 transition">
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}