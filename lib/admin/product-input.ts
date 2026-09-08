import type { CardType, Sport } from '@/lib/submission-types'
import type { CardVariant, ProductRegion } from '@/lib/shop/product-type'
import { REGION_OPTIONS } from '@/lib/shop/product-type'

export type { ProductRegion }
export type ProductCategory = 'sealed' | 'accessories' | 'graded' | 'cards'
/** Mirrors public.product_franchise (0036_add_product_franchise.sql) -- see that migration for why this is separate from CardType. */
export type ProductFranchise = 'pokemon' | 'sports' | 'general'

const VALID_CATEGORIES: ProductCategory[] = ['sealed', 'accessories', 'graded', 'cards']
const VALID_FRANCHISES: ProductFranchise[] = ['pokemon', 'sports', 'general']
const VALID_SPORTS: Sport[] = ['soccer', 'rugby', 'f1', 'nhl', 'nba', 'mlb', 'nfl']
const VALID_CARD_VARIANTS: CardVariant[] = ['rookie', 'auto', 'patch', 'parallel', 'base']
const VALID_REGIONS: ProductRegion[] = REGION_OPTIONS.map((r) => r.value)

export interface ProductInput {
  title: string
  description: string | null
  category: ProductCategory
  franchise: ProductFranchise
  price: number
  stock: number
  images: string[]
  isActive: boolean
  cardType: CardType
  setName: string | null
  cardNumber: string | null
  sport: Sport | null
  brand: string | null
  cardVariant: CardVariant | null
  playerName: string | null
  region: ProductRegion
}

/** Shared by app/api/admin/products' POST and [id]'s PATCH — same fields, same rules, either way in. */
export function validateProductInput(body: Partial<ProductInput>): string | null {
  if (!body.title?.trim()) return 'Product name is required.'
  if (!body.category || !VALID_CATEGORIES.includes(body.category)) return 'A valid category is required.'
  if (!body.franchise || !VALID_FRANCHISES.includes(body.franchise)) return 'A valid franchise is required.'
  if (typeof body.price !== 'number' || !Number.isFinite(body.price) || body.price < 0) {
    return 'Price must be a non-negative number.'
  }
  if (typeof body.stock !== 'number' || !Number.isFinite(body.stock) || body.stock < 0 || !Number.isInteger(body.stock)) {
    return 'Stock must be a non-negative whole number.'
  }
  if (body.cardType && body.cardType !== 'pokemon' && body.cardType !== 'sports_card') {
    return 'Card type must be Pokemon or Sports Card.'
  }
  if (body.cardType === 'sports_card' && (!body.sport || !VALID_SPORTS.includes(body.sport))) {
    return 'A valid sport is required for sports cards.'
  }
  if (body.cardType !== 'sports_card' && body.sport) {
    return 'Sport should only be set for sports cards.'
  }
  if (body.cardVariant && !VALID_CARD_VARIANTS.includes(body.cardVariant)) {
    return 'Invalid card type/variant.'
  }
  if (!body.region || !VALID_REGIONS.includes(body.region)) {
    return 'A valid region is required.'
  }
  return null
}

/** Maps the camelCase request body to products' actual snake_case columns. */
export function toProductRow(body: ProductInput) {
  const cardType = body.cardType ?? 'pokemon'
  return {
    title: body.title.trim(),
    description: body.description?.trim() || null,
    category: body.category,
    franchise: body.franchise,
    price: body.price,
    stock: body.stock,
    images: body.images ?? [],
    is_active: body.isActive ?? true,
    card_type: cardType,
    set_name: body.setName?.trim() || null,
    card_number: body.cardNumber?.trim() || null,
    sport: cardType === 'sports_card' ? body.sport : null,
    brand: body.brand?.trim() || null,
    card_variant: body.cardVariant || null,
    player_name: body.playerName?.trim() || null,
    region: body.region,
  }
}
