-- ============================================================================
-- Migration: 0045_fix_auction_bid_race_condition.sql
--
-- Fixes a real lost-update race condition found while auditing the auction
-- bidding flow: lib/auctions/finalize-bid.ts previously read
-- auctions.current_high_bid/current_high_bidder_id with a plain `select`,
-- decided in application code whether the new bid was higher, then wrote
-- current_high_bid back with a plain `update` -- two bids finalizing at
-- close to the same instant (two 3DS confirmations landing together, or an
-- off-session confirm racing the Stripe webhook's on-session path for a
-- different bidder) could both read the same stale current_high_bid, both
-- decide "I'm higher", and then whichever update ran last would win
-- regardless of which bid amount was actually larger -- a real
-- financial-correctness bug, not just a theoretical one, since this
-- determines who the auction believes is winning and who a seller gets
-- paid by.
--
-- Fixed the same way this codebase already fixes every other
-- read-then-write money path (create_order() in
-- 0032_multicurrency_checkout.sql locks each product row with `for update`
-- before deciding): a security definer function that locks the auctions
-- row, decides under that lock, updates, and returns the pre-update
-- bidder/amount so the caller can correctly release the actual previous
-- high bidder's Stripe hold -- not a value read before the lock was taken.
--
-- Depends on 0044_reconcile_auctions_schema.sql having already run --
-- current_high_bid/current_high_bidder_id did not exist in production
-- before that migration (a much bigger drift than this one alone), so this
-- must apply after it, not before.
-- ============================================================================

create or replace function public.record_auction_bid_result(
  p_auction_id uuid,
  p_bidder_id uuid,
  p_amount numeric
)
returns table (
  became_high_bid boolean,
  previous_high_bidder_id uuid,
  previous_high_bid_amount numeric
)
language plpgsql
security definer set search_path = public
as $$
declare
  v_current_high_bid numeric;
  v_current_high_bidder_id uuid;
begin
  select a.current_high_bid, a.current_high_bidder_id
  into v_current_high_bid, v_current_high_bidder_id
  from public.auctions a
  where a.id = p_auction_id
  for update;

  if not found then
    raise exception 'Auction % not found', p_auction_id;
  end if;

  if v_current_high_bid is null or p_amount > v_current_high_bid then
    update public.auctions
    set current_high_bid = p_amount, current_high_bidder_id = p_bidder_id
    where id = p_auction_id;

    return query select true, v_current_high_bidder_id, v_current_high_bid;
  else
    return query select false, v_current_high_bidder_id, v_current_high_bid;
  end if;
end;
$$;

-- ============================================================================
-- End of migration 0045_fix_auction_bid_race_condition.sql
-- ============================================================================
