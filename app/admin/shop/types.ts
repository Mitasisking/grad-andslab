import type { CardType, Sport } from '@/lib/submission-types'
import type { CardVariant } from '@/lib/shop/product-type'
import type { ProductCategory } from '@/lib/admin/product-input'

/** Mirrors `select('*')` against public.products (0001_init_schema.sql + 0012/0020/0026's additions). */
export interface AdminProduct {
  id: string
  title: string
  description: string | null
  category: ProductCategory
  price: number
  stock: number
  sku: string | null
  images: string[]
  is_active: boolean
  linked_submission_item_id: string | null
  set_name: string | null
  card_number: string | null
  card_type: CardType
  sport: Sport | null
  brand: string | null
  card_variant: CardVariant | null
  player_name: string | null
  created_at: string
  updated_at: string
}
