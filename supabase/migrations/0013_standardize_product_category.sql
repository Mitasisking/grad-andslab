-- ============================================================================
-- Migration: 0013_standardize_product_category.sql
-- Cleans up the 'Cards'/'Sealed'/'Accessories' capitalized enum values that
-- ended up alongside the canonical lowercase ones (see the conversation
-- around 0012 — these weren't added by anything in this migration history).
--
-- Postgres has no ALTER TYPE ... DROP VALUE, so those three labels stay
-- technically valid for public.product_category forever; this can only
-- migrate existing data to lowercase and add a constraint that rejects the
-- capitalized forms going forward, not remove them from the type itself.
-- ============================================================================

update public.products set category = 'cards' where category::text = 'Cards';
update public.products set category = 'sealed' where category::text = 'Sealed';
update public.products set category = 'accessories' where category::text = 'Accessories';

-- Rejects any capitalized variant — current or future — without having to
-- enumerate the specific allowed values (which would need updating every
-- time a real new category is added to the enum).
alter table public.products
  add constraint chk_products_category_lowercase
  check (category::text = lower(category::text));

-- ============================================================================
-- End of migration 0013_standardize_product_category.sql
-- ============================================================================
