import { ExternalLink } from 'lucide-react'

/**
 * Links a cert number straight to the grading company's own official
 * verification page -- deliberately just a link, never a copy of their
 * data. The point of "verify this cert" is checking against the grader's
 * live record (a card can be downgraded/reholdered/invalidated after the
 * fact); anything scraped and cached ourselves would go stale and
 * misrepresent itself as current. Only the two graders with a known public
 * cert-lookup page are listed -- PSA is temporarily hidden site-wide
 * anyway (see lib/submission-types.ts's GRADING_COMPANY_OPTIONS).
 */
const CERT_LOOKUP_BASE_URL: Record<string, string> = {
  ACE: 'https://acegrading.com/cert/',
  PCG: 'https://pcgpopreport.com/report/',
}

/** So callers can decide whether to render CertLink or a plain-text fallback before rendering, rather than CertLink silently returning null for an unlisted grader. */
export function hasCertLookup(grader: string): boolean {
  return grader in CERT_LOOKUP_BASE_URL
}

interface Props {
  grader: string
  certNumber: string
}

export function CertLink({ grader, certNumber }: Props) {
  const baseUrl = CERT_LOOKUP_BASE_URL[grader]
  if (!baseUrl) return null

  return (
    <a
      href={`${baseUrl}${encodeURIComponent(certNumber)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 underline underline-offset-2"
      style={{ color: 'var(--ink)' }}
    >
      Cert #{certNumber}
      <ExternalLink className="size-3" aria-hidden="true" />
    </a>
  )
}
