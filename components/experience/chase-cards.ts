import type { SupabaseClient } from '@supabase/supabase-js'
import type { Grader } from '@/lib/shop/grader'
import type { ProductRegion } from '@/lib/shop/product-type'

export interface GraderScheme {
  /** Label plate background. */
  bg: string
  /** Label plate text. */
  fg: string
  /** Thin accent rule under the grade line. */
  accent: string
  gradeText: string
}

/** Illustrative top-grade labels -- the point of the hero is the reveal, not a specific real cert. */
export const GRADER_SCHEMES: Record<Grader, GraderScheme> = {
  PCG: { bg: '#e9c465', fg: '#241b06', accent: '#7a5a12', gradeText: 'GEM MINT 10' },
  ACE: { bg: '#16233f', fg: '#eaf6ff', accent: '#5ad1e6', gradeText: 'GRADE 10' },
  PSA: { bg: '#c8161d', fg: '#fdf3e7', accent: '#f2c14e', gradeText: 'GEM MT 10' },
}

export interface ChaseCard {
  productId: string
  name: string
  price: number
  /** High-res front artwork -- products.images[0]. */
  image: string
  /** Which grading company's slab this card reforms inside during Phase 3 -- see lib/shop/grader.ts. */
  grader: Grader
  /** Fan layout in local units, applied before the shared group scale/tilt. */
  fanX: number
  fanZ: number
  fanRotationZ: number
}

/**
 * Fixed Mew-left/Pikachu-center/Gengar-right style fan layout, independent of
 * which 3 products actually fill these slots -- CardShatterFan's whole
 * composition (spacing, alternating rotation) was tuned against exactly 3
 * positions, so this stays static while the cards occupying it are dynamic.
 */
const FAN_SLOTS: Pick<ChaseCard, 'fanX' | 'fanZ' | 'fanRotationZ'>[] = [
  { fanX: -0.95, fanZ: -0.1, fanRotationZ: 0.34 },
  { fanX: 0, fanZ: 0.12, fanRotationZ: 0 },
  { fanX: 0.95, fanZ: -0.1, fanRotationZ: -0.34 },
]

const CHASE_CARD_COLUMNS = 'id, title, price, images, grading_company'

/**
 * The 3 chase cards for the hero shatter fan -- the site's 3 most expensive
 * active Graded listings, highest first, so the hero always shows off
 * whatever the current top-of-catalog actually is instead of 3 cards picked
 * once and left to go stale. Scoped to category = 'graded' (not "any active
 * product") since the shatter narrative's payoff is a raw card reforming
 * inside a specific grader's slab -- a Sealed box or an Accessories kit has
 * no grader to reveal. Region-scoped for the same reason every other
 * price-ordered query in this app is (lib/shop/featured-products.ts): a
 * product's price only means something in its own region's currency, so
 * mixing regions into one "most expensive" ranking would be meaningless.
 */
export async function getChaseCards(
  supabase: SupabaseClient,
  region: ProductRegion = 'sa',
): Promise<ChaseCard[]> {
  const { data, error } = await supabase
    .from('products')
    .select(CHASE_CARD_COLUMNS)
    .eq('category', 'graded')
    .eq('region', region)
    .eq('is_active', true)
    .eq('is_auction', false)
    .gt('stock', 0)
    .order('price', { ascending: false })
    .limit(10)

  if (error) {
    console.error('Chase cards query failed', error.message)
    return []
  }

  const withImages = (data ?? []).filter((p) => p.images.length > 0).slice(0, FAN_SLOTS.length)

  return withImages.map((product, i) => ({
    productId: product.id,
    name: product.title,
    price: product.price,
    image: product.images[0],
    // PCG is the fallback for the rare row with no grading_company set
    // (e.g. a manually created listing predating 0063_add_product_grading_company.sql's
    // backfill) rather than leaving `grader` nullable, since
    // GRADER_SCHEMES/createLabelTexture need a concrete scheme to draw.
    grader: (product.grading_company as Grader | null) ?? 'PCG',
    ...FAN_SLOTS[i],
  }))
}
