import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { isValidPsaCertFormat } from '@/lib/psa/cert-verification'

const PSA_CERT_LOOKUP_URL = 'https://api.psacard.com/publicapi/cert/GetByCertNumber'

/**
 * Live-lookup half of PSA's dual-layer verification (see lib/psa/
 * cert-verification.ts's doc comment). Server-only route -- PSA's API needs
 * a bearer token (PSA_API_TOKEN), which must never reach the browser, so the
 * admin bulk importer calls this route instead of PSA's API directly.
 * Admin-gated for the same reason every other /api/admin route is: this
 * spends a real API credential/request quota per call.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const certNumber = request.nextUrl.searchParams.get('certNumber')?.trim() ?? ''
  if (!isValidPsaCertFormat(certNumber)) {
    return NextResponse.json({ error: 'PSA cert numbers are 8-10 digits.' }, { status: 400 })
  }

  const token = process.env.PSA_API_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'PSA_API_TOKEN is not configured.' }, { status: 500 })
  }

  try {
    const res = await fetch(`${PSA_CERT_LOOKUP_URL}/${encodeURIComponent(certNumber)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    })

    if (res.status === 404) {
      return NextResponse.json({ verified: false, error: 'No PSA cert found with that number.' }, { status: 404 })
    }
    if (!res.ok) {
      // Surface PSA's own response body (not just the status) -- a 401/403
      // is almost always a token problem (missing "Bearer " expectation,
      // wrong header name, token not yet active/scoped for this endpoint),
      // and PSA's error text says which without needing to guess from the
      // status code alone.
      const bodyText = await res.text().catch(() => '')
      console.error('psa verify-cert: PSA responded', res.status, bodyText)
      return NextResponse.json(
        { error: `PSA lookup failed (${res.status}).`, detail: bodyText.slice(0, 500) },
        { status: 502 },
      )
    }

    const data = await res.json()
    return NextResponse.json({ verified: true, data })
  } catch (err) {
    console.error('psa verify-cert: request failed', err)
    return NextResponse.json({ error: 'Could not reach PSA right now.' }, { status: 502 })
  }
}
