export type Grader = 'PCG' | 'ACE'

/**
 * products has no dedicated grading-company column -- graded listings are
 * distinguished from raw ones only by category = 'graded' (app/shop/
 * page.tsx's CATEGORIES), and nothing records which of our two active
 * partners (PCG/ACE — see app/page.tsx's hero copy) actually graded a given
 * slab. A text match against the title is the only signal there is, not a
 * real structured field. Sellers/admin should include the grader's name in
 * the listing title (e.g. "PCG 10 Charizard...") for this to actually match
 * -- if that stops being reliable, a real products.grading_company column is
 * the fix, not a better regex here.
 *
 * Lives here (not components/shop/product-filters.tsx, which is 'use client')
 * so server-only callers -- like components/experience/chase-cards.ts's
 * product fetch -- can call it directly; a Server Component can't invoke a
 * plain function exported from a 'use client' module.
 */
export function matchesGrader(title: string, grader: Grader): boolean {
  return title.toUpperCase().includes(grader)
}

/** First matching grader in a title, or null if neither PCG nor ACE appears. */
export function detectGrader(title: string): Grader | null {
  if (matchesGrader(title, 'PCG')) return 'PCG'
  if (matchesGrader(title, 'ACE')) return 'ACE'
  return null
}
