'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppleIcon, GoogleIcon } from '@/components/SocialIcons'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Where to send the user after a successful login -- set by
  // app/admin/layout.tsx (?next=/admin) when it redirects an unauthenticated
  // visitor here, defaulting to /dashboard for a normal direct visit to
  // /login (unchanged from this page's prior hardcoded behavior).
  const next = searchParams.get('next') || '/dashboard'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'google' | 'apple' | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setErrorMsg(error.message)
      setLoading(false)
    } else {
      router.push(next)
    }
  }

  // Supabase itself redirects the browser to the provider and back to
  // app/auth/callback/route.ts, which exchanges the code for a session and
  // sends the user on to ?next= (or /dashboard if absent) -- forwarding
  // `next` through here is what lets a booted-to-/login admin visitor land
  // back on /admin after finishing Google/Apple sign-in too, not just the
  // password form below.
  async function handleOAuth(provider: 'google' | 'apple') {
    setOauthLoading(provider)
    setErrorMsg('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    })
    if (error) {
      setErrorMsg(error.message)
      setOauthLoading(null)
    }
  }

  return (
    <div className="max-w-md mx-auto my-12 p-6 border border-slate-800 bg-slate-900 rounded-xl space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Welcome Back</h1>
        <p className="text-xs text-slate-400">Log in to manage your submissions and bids.</p>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-950/50 border border-red-800 rounded-lg text-red-300 text-xs text-center">
          {errorMsg}
        </div>
      )}

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => handleOAuth('google')}
          disabled={oauthLoading !== null}
          className="w-full flex items-center justify-center gap-3 py-3 rounded-lg bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-900 font-semibold transition text-sm"
        >
          <GoogleIcon className="w-4 h-4" />
          {oauthLoading === 'google' ? 'Redirecting…' : 'Continue with Google'}
        </button>
        <button
          type="button"
          onClick={() => handleOAuth('apple')}
          disabled={oauthLoading !== null}
          className="w-full flex items-center justify-center gap-3 py-3 rounded-lg bg-black hover:bg-slate-900 border border-slate-700 disabled:opacity-50 text-white font-semibold transition text-sm"
        >
          <AppleIcon className="w-4 h-4" />
          {oauthLoading === 'apple' ? 'Redirecting…' : 'Continue with Apple'}
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-800" />
        <span className="text-[11px] uppercase tracking-wide text-slate-500">Or</span>
        <div className="h-px flex-1 bg-slate-800" />
      </div>

      <form onSubmit={handleLogin} className="space-y-4 text-sm">
        <div>
          <label className="block text-slate-300 mb-1 font-medium">Email Address</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:border-amber-400 outline-none"
          />
        </div>

        <div>
          <label className="block text-slate-300 mb-1 font-medium">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:border-amber-400 outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold transition"
        >
          {loading ? 'Logging In...' : 'Log In'}
        </button>
      </form>

      <p className="text-xs text-slate-400 text-center">
        Don't have an account?{' '}
        <Link href="/signup" className="text-amber-400 hover:underline">
          Sign Up
        </Link>
      </p>
    </div>
  )
}
