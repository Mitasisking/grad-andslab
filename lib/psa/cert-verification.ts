/**
 * Format-check half of PSA's dual-layer cert verification. PSA cert numbers
 * are documented as 8-10 numeric digits -- unlike ACE/PCG, where
 * lib/cert-validation.ts's plain \d+ is the only rule this codebase has
 * evidence for, since neither publishes a real format spec. The live-lookup
 * half is app/api/admin/psa/verify-cert/route.ts, which calls PSA's own
 * public GetByCertNumber API rather than caching a scraped copy (see
 * components/dashboard/cert-link.tsx's doc comment on why a live link/lookup
 * beats a cached one here).
 */
export const PSA_CERT_NUMBER_PATTERN = /^\d{8,10}$/

export function isValidPsaCertFormat(certNumber: string): boolean {
  return PSA_CERT_NUMBER_PATTERN.test(certNumber.trim())
}

export interface ParsedPsaCertNumbers {
  valid: string[]
  invalid: string[]
}

/** Same comma-separated parsing shape as lib/cert-validation.ts's parseCertNumbers, just against the stricter 8-10 digit PSA pattern. */
export function parsePsaCertNumbers(raw: string): ParsedPsaCertNumbers {
  const seenValid = new Set<string>()
  const invalid: string[] = []
  for (const piece of raw.split(',')) {
    const trimmed = piece.trim()
    if (!trimmed) continue
    if (isValidPsaCertFormat(trimmed)) {
      seenValid.add(trimmed)
    } else {
      invalid.push(trimmed)
    }
  }
  return { valid: Array.from(seenValid), invalid }
}
