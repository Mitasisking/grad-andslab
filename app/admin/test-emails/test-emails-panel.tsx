'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Mirrors app/api/admin/simulate-lifecycle/route.ts's STAGE_ORDER 1:1 --
 * display labels only, the route owns the actual GradingEmailStage names
 * and seed payload.
 */
const STAGES: { number: number; label: string }[] = [
  { number: 1, label: 'Send Order Confirmed' },
  { number: 2, label: 'Send Collection Booked' },
  { number: 3, label: 'Send Received at HQ' },
  { number: 4, label: 'Send Dispatched to Grader' },
  { number: 5, label: 'Send Received by Grader' },
  { number: 6, label: 'Send Dispatched to SA' },
  { number: 7, label: 'Send Grades Landed at HQ' },
  { number: 8, label: 'Send Final Dispatch' },
]

const SEQUENCE_DELAY_MS = 5000

interface LogEntry {
  time: string
  text: string
  kind: 'success' | 'error'
}

function timestamp(): string {
  return new Date().toLocaleTimeString()
}

export function TestEmailsPanel() {
  const [targetEmail, setTargetEmail] = useState('mitchelltaljaard@gmail.com')
  const [sendingStage, setSendingStage] = useState<number | null>(null)
  const [runningSequence, setRunningSequence] = useState(false)
  const [log, setLog] = useState<LogEntry[]>([])

  function appendLog(entry: LogEntry) {
    setLog((prev) => [entry, ...prev])
  }

  async function sendStage(stageNumber: number): Promise<boolean> {
    setSendingStage(stageNumber)
    try {
      const res = await fetch('/api/admin/simulate-lifecycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: stageNumber, targetEmail }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        appendLog({
          time: timestamp(),
          text: `Stage ${stageNumber} (${data.stage ?? '?'}) — HTTP ${res.status} — ${data.error ?? 'send failed'}`,
          kind: 'error',
        })
        return false
      }

      appendLog({
        time: timestamp(),
        text: `Stage ${stageNumber} (${data.stage}) — HTTP ${res.status} — messageId: ${data.messageId ?? 'n/a'}`,
        kind: 'success',
      })
      return true
    } catch (error) {
      appendLog({
        time: timestamp(),
        text: `Stage ${stageNumber} — network error — ${error instanceof Error ? error.message : String(error)}`,
        kind: 'error',
      })
      return false
    } finally {
      setSendingStage(null)
    }
  }

  async function runFullSequence() {
    setRunningSequence(true)
    appendLog({ time: timestamp(), text: `Starting full 8-stage sequence to ${targetEmail}...`, kind: 'success' })
    for (const stage of STAGES) {
      await sendStage(stage.number)
      if (stage.number < STAGES.length) {
        await new Promise((resolve) => setTimeout(resolve, SEQUENCE_DELAY_MS))
      }
    }
    appendLog({ time: timestamp(), text: 'Full sequence complete.', kind: 'success' })
    setRunningSequence(false)
  }

  const busy = sendingStage !== null || runningSequence

  return (
    <div className="mt-8 space-y-6">
      <div className="max-w-sm">
        <Label className="text-[12.5px]" style={{ color: 'var(--ink-muted)' }}>
          Target email
        </Label>
        <Input
          type="email"
          value={targetEmail}
          onChange={(e) => setTargetEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {STAGES.map((stage) => (
          <Button
            key={stage.number}
            type="button"
            variant="outline"
            disabled={busy || !targetEmail.trim()}
            onClick={() => sendStage(stage.number)}
            className="rounded-[3px] justify-start"
          >
            {sendingStage === stage.number ? 'Sending…' : `${stage.number}. ${stage.label}`}
          </Button>
        ))}
      </div>

      <Button
        type="button"
        disabled={busy || !targetEmail.trim()}
        onClick={runFullSequence}
        className="w-full rounded-[3px]"
        style={{ background: 'var(--vault)', color: 'var(--vault-ink)' }}
      >
        {runningSequence ? 'Running full sequence…' : `Trigger Full Sequence (${SEQUENCE_DELAY_MS / 1000}s delay between)`}
      </Button>

      <div>
        <p className="text-[12.5px] mb-2" style={{ color: 'var(--ink-muted)' }}>
          Console log
        </p>
        <div
          className="rounded-[3px] border p-3 h-64 overflow-y-auto font-mono text-[12px] space-y-1"
          style={{ borderColor: 'var(--line)', background: 'var(--paper-raised)' }}
        >
          {log.length === 0 && <p style={{ color: 'var(--ink-muted)' }}>No sends yet.</p>}
          {log.map((entry, i) => (
            <p key={i} style={{ color: entry.kind === 'error' ? '#ef4444' : 'var(--ink)' }}>
              [{entry.time}] {entry.text}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}
