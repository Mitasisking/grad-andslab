'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Navbar() {
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
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
            .select('is_admin')
            .eq('id', session.user.id)
            .maybeSingle()
          
          if (!error && data) {
            setIsAdmin(!!data.is_admin)
          } else {
            setIsAdmin(false)
          }
        } else {
          setIsAdmin(false)
        }
      } catch (err) {
        console.error('Error checking user session:', err)
        setIsAdmin(false)
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
            .select('is_admin')
            .eq('id', session.user.id)
            .maybeSingle()
            
          if (!error && data) {
            setIsAdmin(!!data.is_admin)
          } else {
            setIsAdmin(false)
          }
        } catch (err) {
          setIsAdmin(false)
        }
      } else {
        setIsAdmin(false)
      }
    })

    return () => {
      authListener?.unsubscribe()
    }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Hide the navbar on the login/signup screens for a cleaner look
  if (pathname === '/login' || pathname === '/signup') return null

  return (
    <nav className="bg-slate-950 border-b border-slate-800 text-white sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
        
        {/* Left Side: Logo & Main Links */}
        <div className="flex items-center gap-8">
          <Link href="/" className="text-2xl font-black text-amber-500 tracking-tighter hover:text-amber-400 transition">
            GRADE & SLAB
          </Link>
          
          <div className="hidden md:flex gap-6 text-sm font-medium text-slate-300">
            <Link href="/dashboard" className={`hover:text-amber-400 transition ${pathname === '/dashboard' ? 'text-amber-400' : ''}`}>
              Submit Cards
            </Link>
            <Link href="/shop" className={`hover:text-amber-400 transition ${pathname === '/shop' ? 'text-amber-400' : ''}`}>
              Shop
            </Link>
            <Link href="/auctions" className={`hover:text-amber-400 transition ${pathname === '/auctions' ? 'text-amber-400' : ''}`}>
              Live Auctions
            </Link>
          </div>
        </div>

        {/* Right Side: Auth & Admin Controls */}
        <div className="flex items-center gap-4">
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