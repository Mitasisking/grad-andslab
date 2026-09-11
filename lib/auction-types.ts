import type { PaymentStatus } from './submission-types'

// ----------------------------------------------------------------------------
// Phase 4 — marketplace & real-time auction engine
// Row shapes below mirror `select('*')` against supabase/migrations/0001_init_schema.sql
// (auctions, bids) — payment_status is the same public.payment_status enum
// submissions use, hence the shared import rather than a redefinition.
// ----------------------------------------------------------------------------

export type AuctionStatus = 'active' | 'extended' | 'closed'

export interface AuctionRow {
  id: string
  item_id: string | null
  product_id: string | null
  seller_id: string
  title: string
  description: string | null
  images: string[]
  starting_price: number
  reserve_price: number | null
  bid_increment: number
  current_high_bid: number | null
  current_high_bidder_id: string | null
  status: AuctionStatus
  starts_at: string
  ends_at: string
  extension_count: number
  created_at: string
  updated_at: string
}

export interface BidRow {
  id: string
  auction_id: string
  bidder_id: string
  amount: number
  payment_status: PaymentStatus
  created_at: string
}
