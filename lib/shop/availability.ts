/** A sealed product counts as out of print once this many years have passed since its set's release date. */
const OUT_OF_PRINT_YEARS = 3

/**
 * Computed at request time from products.release_date (backfilled by
 * app/api/fetch-images/route.ts from TCGdex's set-detail releaseDate) --
 * not a stored flag, so a product crosses from in-print to out-of-print on
 * its own the moment 3 years actually pass, with no re-run needed.
 *
 * Returns null when release_date isn't known yet (not backfilled, or
 * TCGdex has no releaseDate for that set) so callers can tell "confirmed
 * in print" apart from "we don't actually know" instead of defaulting to
 * one bucket and misclassifying it.
 */
export function isOutOfPrint(releaseDate: string | null, now: Date = new Date()): boolean | null {
  if (!releaseDate) return null
  const threshold = new Date(releaseDate)
  threshold.setFullYear(threshold.getFullYear() + OUT_OF_PRINT_YEARS)
  return now >= threshold
}
