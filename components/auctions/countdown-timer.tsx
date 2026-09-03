'use client'

import { useEffect, useState } from 'react'

interface Props {
  endsAt: string
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Ended'
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')

  return days > 0 ? `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

/** Live countdown to an auction's end; turns to the danger color in the final minute. */
export function CountdownTimer({ endsAt }: Props) {
  const target = new Date(endsAt).getTime()
  const [remaining, setRemaining] = useState(() => target - Date.now())

  useEffect(() => {
    const tick = () => setRemaining(target - Date.now())
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [target])

  const isFinalMinute = remaining > 0 && remaining <= 60_000

  return (
    <p
      className="text-[18px] mt-0.5"
      style={{ fontVariantNumeric: 'tabular-nums', color: isFinalMinute ? 'var(--danger)' : 'var(--ink)' }}
    >
      {formatRemaining(remaining)}
    </p>
  )
}
