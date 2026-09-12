/**
 * Shared by both bulk importers (bulk-ace-import.tsx, bulk-pcg-import.tsx).
 * ACE and PCG cert numbers are both purely numeric in every example this
 * codebase has used (the importers' own placeholder text, existing saved
 * certs) -- there's no published spec for either company confirming this is
 * the whole rule, so treat this as "reject obviously wrong input" (letters,
 * punctuation, a cert typed into the wrong importer if one company's format
 * ever diverges) rather than a guarantee the cert is real. Actually
 * confirming a cert is real requires checking it against the grading
 * company's own record -- see this file's sibling doc comment in the
 * importers for why that can't be done with a simple existence-check
 * request to their public report page.
 */
export const CERT_NUMBER_PATTERN = /^\d+$/

export function isValidCertFormat(certNumber: string): boolean {
  return CERT_NUMBER_PATTERN.test(certNumber.trim())
}

export interface ParsedCertNumbers {
  valid: string[]
  invalid: string[]
}

export function parseCertNumbers(raw: string): ParsedCertNumbers {
  const seenValid = new Set<string>()
  const invalid: string[] = []
  for (const piece of raw.split(',')) {
    const trimmed = piece.trim()
    if (!trimmed) continue
    if (isValidCertFormat(trimmed)) {
      seenValid.add(trimmed)
    } else {
      invalid.push(trimmed)
    }
  }
  return { valid: Array.from(seenValid), invalid }
}
