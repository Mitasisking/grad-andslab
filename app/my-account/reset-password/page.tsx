'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

/**
 * Landing page for the "Lost your password?" email link
 * (app/my-account/page.tsx's handleForgotPassword). Supabase's recovery
 * link redirects here already carrying a session (it signs the browser in
 * with a short-lived recovery token as part of the redirect), so this page
 * just needs to collect a new password and call updateUser -- no token
 * parsing of its own required.
 */
export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: updateError } = await supabase.auth.updateUser({ password })

    setLoading(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setDone(true)
  }

  return (
    <div style={{ background: 'var(--paper)', color: 'var(--ink)', minHeight: '100vh' }}>
      <div className="mx-auto max-w-md px-6 py-16">
        <p className="text-[13px]" style={{ color: 'var(--ink-muted)' }}>
          Cuppa Cards
        </p>
        <h1 className="text-[26px] mt-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
          Set a new password
        </h1>

        {done ? (
          <div className="mt-6">
            <p className="text-[13.5px]" style={{ color: 'var(--seal)' }}>
              Your password has been updated.
            </p>
            <Button
              onClick={() => router.push('/my-account')}
              className="w-full rounded-[3px] mt-4"
              style={{ background: 'var(--vault)', color: 'var(--vault-ink)' }}
            >
              Back to login
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-6">
            <div>
              <Label className="text-[12.5px] block mb-1" style={{ color: 'var(--ink-muted)' }}>
                New password
              </Label>
              <Input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-[13px]" style={{ color: 'var(--danger)' }}>
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full rounded-[3px]"
              style={{ background: 'var(--vault)', color: 'var(--vault-ink)' }}
            >
              {loading ? 'Updating…' : 'Update password'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
