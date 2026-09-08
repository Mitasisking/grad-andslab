'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { TurnstileWidget } from '@/components/auth/turnstile-widget'

const inputStyle = { borderColor: 'var(--line)', color: 'var(--ink)' }
const labelClass = 'text-[12.5px] block mb-1'
const labelStyle = { color: 'var(--ink-muted)' }

function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetMessage, setResetMessage] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // rememberMe is captured here but not yet wired to session lifetime --
    // the shared client (lib/supabase.ts) always persists via a cookie set
    // by @supabase/ssr's createBrowserClient, which every server-side auth
    // check in this app (getSupabaseRouteClient, requireAdmin, etc.) reads.
    // Making "unchecked" mean a session-only cookie requires customizing
    // that cookie's Max-Age at the client-creation level, which risks
    // breaking those shared checks if done carelessly -- left as a real,
    // explicitly flagged gap rather than a silently-incorrect toggle.
    void rememberMe

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: captchaToken ? { captchaToken } : undefined,
    })

    setLoading(false)
    if (signInError) {
      setError(signInError.message)
      return
    }
    router.push('/dashboard')
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      setError('Enter your email above first, then click "Lost your password?" again.')
      return
    }
    setError(null)
    setResetMessage(null)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/my-account/reset-password`,
    })
    setResetMessage(resetError ? resetError.message : `If an account exists for ${email}, a reset link is on its way.`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label className={labelClass} style={labelStyle}>
          Email
        </Label>
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
          placeholder="you@example.com"
        />
      </div>
      <div>
        <Label className={labelClass} style={labelStyle}>
          Password
        </Label>
        <Input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
          placeholder="••••••••"
        />
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--ink)' }}>
          <Checkbox checked={rememberMe} onCheckedChange={(c) => setRememberMe(c === true)} />
          Remember me
        </label>
        <button
          type="button"
          onClick={handleForgotPassword}
          className="text-[12.5px] underline underline-offset-2"
          style={{ color: 'var(--ink-muted)' }}
        >
          Lost your password?
        </button>
      </div>

      {resetMessage && (
        <p className="text-[12.5px]" style={{ color: 'var(--ink-muted)' }}>
          {resetMessage}
        </p>
      )}

      <TurnstileWidget onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />

      {error && (
        <p className="text-[13px]" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={loading || !captchaToken}
        className="w-full rounded-[3px]"
        style={{ background: 'var(--vault)', color: 'var(--vault-ink)' }}
      >
        {loading ? 'Logging in…' : !captchaToken ? 'Verifying…' : 'Log in'}
      </Button>
    </form>
  )
}

function RegisterForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newsletterOptIn, setNewsletterOptIn] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { newsletter_opt_in: newsletterOptIn },
        ...(captchaToken ? { captchaToken } : {}),
      },
    })

    setLoading(false)
    if (signUpError) {
      setError(signUpError.message)
      return
    }

    // With email confirmation required (the project's default), signUp
    // returns a user but no session -- nothing to redirect into yet.
    if (!data.session) {
      setConfirmMessage('Check your email to confirm your account before logging in.')
      return
    }
    router.push('/dashboard')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label className={labelClass} style={labelStyle}>
          Email
        </Label>
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
          placeholder="you@example.com"
        />
      </div>
      <div>
        <Label className={labelClass} style={labelStyle}>
          Password
        </Label>
        <Input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
          placeholder="••••••••"
        />
      </div>

      <label className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--ink)' }}>
        <Checkbox checked={newsletterOptIn} onCheckedChange={(c) => setNewsletterOptIn(c === true)} />
        Subscribe to our newsletter
      </label>

      <TurnstileWidget onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />

      {error && (
        <p className="text-[13px]" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}
      {confirmMessage && (
        <p className="text-[13px]" style={{ color: 'var(--seal)' }}>
          {confirmMessage}
        </p>
      )}

      <Button
        type="submit"
        disabled={loading || !captchaToken}
        className="w-full rounded-[3px]"
        style={{ background: 'var(--vault)', color: 'var(--vault-ink)' }}
      >
        {loading ? 'Creating account…' : !captchaToken ? 'Verifying…' : 'Register'}
      </Button>
    </form>
  )
}

export default function MyAccountPage() {
  return (
    <div style={{ background: 'var(--paper)', color: 'var(--ink)', minHeight: '100vh' }}>
      <div className="mx-auto max-w-4xl px-6 py-12 lg:py-16">
        <p className="text-[13px]" style={{ color: 'var(--ink-muted)' }}>
          Cuppa Cards
        </p>
        <h1 className="text-[28px] mt-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
          My Account
        </h1>
        <p className="text-[13.5px] mt-2 max-w-lg" style={{ color: 'var(--ink-muted)' }}>
          Log in to manage your submissions and bids, or register a new account.
        </p>

        <div className="grid md:grid-cols-2 gap-10 md:gap-0 mt-10">
          <div className="md:pr-10">
            <h2 className="text-[19px]" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
              Login
            </h2>
            <div className="mt-5">
              <LoginForm />
            </div>
          </div>

          <div className="md:pl-10 md:border-l pt-10 md:pt-0 border-t md:border-t-0" style={{ borderColor: 'var(--line)' }}>
            <h2 className="text-[19px]" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
              Register
            </h2>
            <div className="mt-5">
              <RegisterForm />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
