-- ============================================================================
-- Migration: 0006_auctions.sql
-- Anti-sniping: a bid placed within the final 30 seconds of an auction
-- extends ends_at by 120 seconds.
--
-- This is implemented as a Postgres trigger rather than a separate
-- serverless function invoked after the bid write. A trigger runs in the
-- same transaction as the bid INSERT and takes a row lock on the auction,
-- so two near-simultaneous last-second bids can't both read a stale
-- ends_at and only one of them apply the extension — an external function
-- calling back to update the row afterward would be racing exactly that.
-- ============================================================================

create or replace function public.extend_auction_on_late_bid()
returns trigger
language plpgsql
as $$
declare
  auction_row public.auctions%rowtype;
begin
  select * into auction_row from public.auctions where id = new.auction_id for update;

  if auction_row.status in ('active', 'extended') and now() >= (auction_row.ends_at - interval '30 seconds') then
    update public.auctions
    set ends_at = auction_row.ends_at + interval '120 seconds',
        status = 'extended',
        extension_count = auction_row.extension_count + 1
    where id = new.auction_id;
  end if;

  return new;
end;
$$;

create trigger trg_extend_auction_on_late_bid
  after insert on public.bids
  for each row execute function public.extend_auction_on_late_bid();

-- ============================================================================
-- End of migration 0006_auctions.sql
-- ============================================================================
