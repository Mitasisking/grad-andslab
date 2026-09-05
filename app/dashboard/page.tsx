'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AddAddressForm } from '@/components/submit/add-address-form'
import { fetchAddresses } from '@/lib/addresses-client'
import { STATUS_STAGES } from '@/lib/submission-types'
import type { ShippingAddress } from '@/lib/submission-types'

interface Profile {
  full_name: string
  phone: string
}

interface SubmissionSummary {
  id: string
  grading_company: string
  status: string
  total_declared_value: number
  qr_code_token: string
  created_at: string
}

/**
 * Replaces a prior version of this page that predated the real schema
 * entirely — it read/wrote columns like orders.order_number, orders.grand_total,
 * submissions.card_name and profiles.street_address, none of which exist in
 * supabase/migrations/0001_init_schema.sql or 0005_marketplace.sql. Card
 * submission + checkout already has a correct, complete flow at /submit, so
 * that's linked to here rather than re-duplicated; shipping addresses reuse
 * the same addresses table + AddAddressForm that /submit and /shop/checkout
 * already use, rather than the unused profiles.shipping_* columns.
 */
export default function DashboardPage() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [loading, setLoading] = useState(true)

  const [profile, setProfile] = useState<Profile>({ full_name: '', phone: '' })
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')

  const [addresses, setAddresses] = useState<ShippingAddress[]>([])
  const [showAddAddress, setShowAddAddress] = useState(false)

  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([])

  const router = useRouter()

  useEffect(() => {
    async function loadDashboardData() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)
      await Promise.all([fetchProfile(user.id), fetchAddresses().then(setAddresses), fetchSubmissions(user.id)])
      setLoading(false)
    }
    loadDashboardData()
  }, [router])

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase.from('profiles').select('full_name, phone').eq('id', userId).single()
    if (data && !error) {
      setProfile({ full_name: data.full_name || '', phone: data.phone || '' })
    }
  }

  const fetchSubmissions = async (userId: string) => {
    const { data, error } = await supabase
      .from('submissions')
      .select('id, grading_company, status, total_declared_value, qr_code_token, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5)

    if (!error && data) {
      setSubmissions(data)
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSavingProfile(true)
    setProfileMessage('')

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: profile.full_name, phone: profile.phone, updated_at: new Date().toISOString() })
      .eq('id', user.id)

    setProfileMessage(error ? `Error: ${error.message}` : 'Saved.')
    if (!error) setTimeout(() => setProfileMessage(''), 3000)
    setSavingProfile(false)
  }

  if (loading) {
    return (
      <div style={{ background: 'var(--paper)', color: 'var(--ink-muted)', minHeight: '100vh' }} className="flex items-center justify-center">
        <p className="text-[14px]">Loading your dashboard…</p>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--paper)', color: 'var(--ink)', minHeight: '100vh' }}>
      <div className="mx-auto max-w-3xl px-6 py-10 lg:py-16">
        <p className="text-[13px]" style={{ color: 'var(--ink-muted)' }}>
          My dashboard
        </p>
        <h1 className="text-[28px] mt-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
          Welcome back{profile.full_name ? `, ${profile.full_name}` : ''}
        </h1>
        <p className="text-[13.5px] mt-1" style={{ color: 'var(--ink-muted)' }}>
          {user?.email}
        </p>

        <div className="mt-8 border rounded-[3px] p-6 flex items-center justify-between gap-4" style={{ borderColor: 'var(--line)' }}>
          <div>
            <p className="text-[15px]" style={{ color: 'var(--ink)' }}>
              Submit cards for grading
            </p>
            <p className="text-[13px] mt-1" style={{ color: 'var(--ink-muted)' }}>
              Pick a grader and tier, add your cards, and pay in one flow.
            </p>
          </div>
          <Link
            href="/submit"
            className="px-4 py-2 text-[13.5px] rounded-[3px] shrink-0"
            style={{ background: 'var(--vault)', color: 'var(--vault-ink)' }}
          >
            Start a submission
          </Link>
        </div>

        <div className="mt-10 pt-8 border-t" style={{ borderColor: 'var(--line)' }}>
          <h2 className="text-[18px]" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
            Account info
          </h2>
          <form onSubmit={handleSaveProfile} className="grid sm:grid-cols-2 gap-3 mt-4">
            <div>
              <Label className="text-[12.5px]" style={{ color: 'var(--ink-muted)' }}>
                Full name
              </Label>
              <Input value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
            </div>
            <div>
              <Label className="text-[12.5px]" style={{ color: 'var(--ink-muted)' }}>
                Phone
              </Label>
              <Input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
            </div>
            <div className="sm:col-span-2 flex items-center gap-3 mt-1">
              <Button type="submit" disabled={savingProfile} className="rounded-[3px]" style={{ background: 'var(--vault)', color: 'var(--vault-ink)' }}>
                {savingProfile ? 'Saving…' : 'Save'}
              </Button>
              {profileMessage && (
                <p className="text-[13px]" style={{ color: profileMessage.startsWith('Error') ? 'var(--danger)' : 'var(--seal)' }}>
                  {profileMessage}
                </p>
              )}
            </div>
          </form>
        </div>

        <div className="mt-10 pt-8 border-t" style={{ borderColor: 'var(--line)' }}>
          <h2 className="text-[18px]" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
            Saved addresses
          </h2>

          {addresses.length > 0 && (
            <div className="flex flex-col mt-4 border-t" style={{ borderColor: 'var(--line)' }}>
              {addresses.map((a) => (
                <div key={a.id} className="py-3 border-b text-[14px]" style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}>
                  {a.name} — {a.line1}
                  {a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} {a.postal}
                </div>
              ))}
            </div>
          )}

          {!showAddAddress ? (
            <button
              type="button"
              onClick={() => setShowAddAddress(true)}
              className="mt-4 text-[13.5px] underline underline-offset-2"
              style={{ color: 'var(--ink)' }}
            >
              + Add a new address
            </button>
          ) : (
            <AddAddressForm
              onCreated={(address) => {
                setAddresses((prev) => [...prev, address])
                setShowAddAddress(false)
              }}
              onCancel={() => setShowAddAddress(false)}
            />
          )}
        </div>

        <div className="mt-10 pt-8 border-t" style={{ borderColor: 'var(--line)' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-[18px]" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
              Recent submissions
            </h2>
            <Link href="/dashboard/submissions" className="text-[13px] underline underline-offset-2" style={{ color: 'var(--ink-muted)' }}>
              View all
            </Link>
          </div>

          {submissions.length === 0 ? (
            <p className="text-[14px] mt-4" style={{ color: 'var(--ink-muted)' }}>
              No submissions yet.
            </p>
          ) : (
            <div className="flex flex-col mt-4 border-t" style={{ borderColor: 'var(--line)' }}>
              {submissions.map((s) => {
                const stage = STATUS_STAGES.find((stg) => stg.value === s.status)
                return (
                  <Link
                    key={s.id}
                    href={`/dashboard/submissions/${s.id}`}
                    className="flex items-center justify-between py-3 border-b gap-4"
                    style={{ borderColor: 'var(--line)' }}
                  >
                    <div>
                      <p className="text-[14px]" style={{ color: 'var(--ink)' }}>
                        {s.grading_company} — #{s.qr_code_token.slice(0, 8).toUpperCase()}
                      </p>
                      <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--ink-muted)' }}>
                        {new Date(s.created_at).toLocaleDateString()} · ${Number(s.total_declared_value).toFixed(2)} declared
                      </p>
                    </div>
                    <span className="text-[13px] shrink-0" style={{ color: 'var(--seal)' }}>
                      {stage?.label ?? s.status}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
