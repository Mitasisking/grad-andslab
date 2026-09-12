import type { CardType, Sport } from '@/lib/submission-types'
import type { CardVariant } from '@/lib/shop/product-type'
import type { ProductCategory, ProductFranchise, ProductRegion } from '@/lib/admin/product-input'

/** Mirrors `select('*')` against public.products (0001_init_schema.sql + 0012/0020/0026/0031/0036's additions). */
export interface AdminProduct {
  id: string
  title: string
  description: string | null
  category: ProductCategory
  franchise: ProductFranchise
  price: number
  /** Nullable -- most of the catalog has no known cost yet (see 0034_accounting_foundations.sql). */
  cost_basis: number | null
  stock: number
  sku: string | null
  images: string[]
  is_active: boolean
  /** Staged for the Live Auctions "Coming Soon" grid instead of the regular shop -- see 0054_add_product_is_auction.sql. */
  is_auction: boolean
  linked_submission_item_id: string | null
  set_name: string | null
  card_number: string | null
  /** Used by lib/shop/availability.ts's 3-year in-print/out-of-print split and the Sealed-category shop time-gate (0020_add_product_release_date.sql). */
  release_date: string | null
  /** Bypasses the Sealed time-gate and surfaces under its own Shop category pill regardless of category/age -- see 0055_add_product_pokemon_center.sql. */
  is_pokemon_center: boolean
  card_type: CardType
  sport: Sport | null
  brand: string | null
  card_variant: CardVariant | null
  player_name: string | null
  region: ProductRegion
  created_at: string
  updated_at: string
}
