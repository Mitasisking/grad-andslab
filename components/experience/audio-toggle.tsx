'use client'

import { useState } from 'react'
import { isAudioMuted, setAudioMuted } from './sound-effects'

/**
 * Floating mute/unmute control for the shatter/glint sound effects --
 * defaults muted (sound-effects.ts's `muted` starts true) so nothing plays
 * on load regardless of autoplay policy; a click here is the one explicit
 * gesture that turns audio on, and doubles as the reliable place to resume
 * the AudioContext (see setAudioMuted's doc comment).
 */
export function AudioToggle() {
  // Read the module's real state on mount rather than assuming `true` --
  // if this component ever remounts mid-session, it shouldn't silently
  // re-mute audio the visitor already turned on.
  const [muted, setMuted] = useState(() => isAudioMuted())

  function toggle() {
    const next = !muted
    setAudioMuted(next)
    setMuted(next)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={muted ? 'Unmute sound effects' : 'Mute sound effects'}
      aria-pressed={!muted}
      className="fixed bottom-6 right-6 z-50 flex h-11 w-11 items-center justify-center rounded-full border transition hover:border-[#e8b84b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e8b84b]"
      style={{
        background: 'rgba(26,20,8,0.7)',
        borderColor: 'rgba(232,184,75,0.35)',
        backdropFilter: 'blur(6px)',
      }}
    >
      {muted ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f4ead9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="4,9 8,9 13,4.5 13,19.5 8,15 4,15" fill="#f4ead9" stroke="none" />
          <line x1="16.5" y1="9" x2="21.5" y2="15" />
          <line x1="21.5" y1="9" x2="16.5" y2="15" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e8b84b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="4,9 8,9 13,4.5 13,19.5 8,15 4,15" fill="#e8b84b" stroke="none" />
          <path d="M16.5 8.5a5 5 0 0 1 0 7" />
          <path d="M19 6a8.5 8.5 0 0 1 0 12" />
        </svg>
      )}
    </button>
  )
}
