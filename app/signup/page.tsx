'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName }
        }
      })

      if (error) {
        setErrorMsg(error.message)
        setLoading(false)
      } else {
        router.push('/dashboard')
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Connection failed.')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto my-12 p-6 border border-slate-800 bg-slate-900 rounded-xl space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Create an Account</h1>
        <p className="text-xs text-slate-400">Join SLAB&GRADE for middleman submissions and live bidding.</p>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-950/50 border border-red-800 rounded-lg text-red-300 text-xs text-center">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSignup} className="space-y-4 text-sm">
        <div>
          <label className="block text-slate-300 mb-1 font-medium">Full Name</label>
          <input 
            type="text" 
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Mitchell Taljaard"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:border-amber-400 outline-none"
          />
        </div>

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
            minLength={6}
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
          {loading ? 'Creating Account...' : 'Sign Up'}
        </button>
      </form>

      <p className="text-xs text-slate-400 text-center">
        Already have an account?{' '}
        <Link href="/login" className="text-amber-400 hover:underline">
          Log In
        </Link>
      </p>
    </div>
  )
}