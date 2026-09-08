'use client'

import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: { sitekey: string; callback: (token: string) => void; 'expired-callback'?: () => void },
      ) => string
      remove: (widgetId: string) => void
    }
  }
}

// Cloudflare's own published "always passes" test key -- used only when
// NEXT_PUBLIC_TURNSTILE_SITE_KEY isn't set, so /my-account renders and
// functions out of the box before a real Turnstile site is configured.
// Swap in a real site key (dash.cloudflare.com -> Turnstile) before launch;
// the test key never actually blocks a bot.
const TEST_SITE_KEY = '1x00000000000000000000AA'

let scriptPromise: Promise<void> | null = null
function loadTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.turnstile) return Promise.resolve()
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Could not load Turnstile'))
      document.head.appendChild(script)
    })
  }
  return scriptPromise
}

interface Props {
  onVerify: (token: string) => void
  onExpire?: () => void
}

/**
 * Cloudflare Turnstile widget -- the bot-blocking hook for both forms on
 * /my-account. The token this produces is passed straight through as
 * `captchaToken` on supabase.auth.signInWithPassword/signUp's `options`,
 * which is Supabase Auth's own built-in CAPTCHA verification hook (it
 * calls Turnstile's siteverify API server-side using the SECRET key
 * configured in the Supabase dashboard's Auth settings -- this app never
 * sees or needs that secret). Until CAPTCHA protection is turned on there,
 * the token is accepted but not actually checked -- wiring this up here is
 * necessary but not sufficient; the dashboard toggle is the other half.
 */
export function TurnstileWidget({ onVerify, onExpire }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || TEST_SITE_KEY,
          callback: onVerify,
          'expired-callback': onExpire,
        })
      })
      .catch((err) => {
        console.error('Turnstile failed to load', err)
        if (!cancelled) setError('Could not load the verification widget.')
      })

    return () => {
      cancelled = true
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (error) {
    return (
      <p className="text-[12px]" style={{ color: 'var(--danger)' }}>
        {error}
      </p>
    )
  }

  return <div ref={containerRef} />
}
