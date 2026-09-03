import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRouteClient } from '@/lib/supabase-route-client'

export async function GET() {
  const supabase = await getSupabaseRouteClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('addresses')
    .select('id, label, full_name, line1, line2, city, state, postal, country, is_default')
    .eq('user_id', user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ addresses: data })
}

interface CreateAddressBody {
  label?: string
  fullName: string
  line1: string
  line2?: string
  city: string
  state: string
  postal: string
  country?: string
  isDefault?: boolean
}

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseRouteClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = (await request.json()) as CreateAddressBody

  if (!body.fullName || !body.line1 || !body.city || !body.state || !body.postal) {
    return NextResponse.json({ error: 'Missing required address fields' }, { status: 400 })
  }

  // The partial unique index (one default per user) means a second default
  // insert would fail outright, so clear any existing default first.
  if (body.isDefault) {
    await supabase.from('addresses').update({ is_default: false }).eq('user_id', user.id).eq('is_default', true)
  }

  const { data, error } = await supabase
    .from('addresses')
    .insert({
      user_id: user.id,
      label: body.label || 'Address',
      full_name: body.fullName,
      line1: body.line1,
      line2: body.line2 ?? null,
      city: body.city,
      state: body.state,
      postal: body.postal,
      country: body.country || 'US',
      is_default: body.isDefault ?? false,
    })
    .select('id, label, full_name, line1, line2, city, state, postal, country, is_default')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ address: data }, { status: 201 })
}
