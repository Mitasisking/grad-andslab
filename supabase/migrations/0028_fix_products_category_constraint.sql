-- ============================================================================
-- Migration: 0028_fix_products_category_constraint.sql
--
-- The live chk_products_category_lowercase constraint turned out not to
-- match what 0013_standardize_product_category.sql actually committed --
-- confirmed by querying pg_get_constraintdef() directly against production:
--
--   CHECK ((category = ANY (ARRAY['cards'::text, 'sealed'::text, 'accessories'::text])))
--
-- instead of 0013's real check (category::text = lower(category::text)).
-- It's a hardcoded 3-value allow-list missing 'graded' entirely, diverged
-- from the tracked migration at some point outside this migration history
-- -- the same kind of undocumented drift 0013's own comment already flagged
-- for this table's category values once before. Net effect: every insert
-- with category = 'graded' has been failing this constraint, silently
-- blocking that category rather than rejecting a real bad value.
--
-- Restores 0013's original, self-maintaining logic (reject any capitalized
-- form, without hardcoding the allowed lowercase set) rather than just
-- swapping in a corrected-for-now 4-value list, which would only recreate
-- today's failure mode the next time public.product_category gains a
-- value and nobody remembers to update this constraint to match.
-- ============================================================================

alter table public.products
  drop constraint if exists chk_products_category_lowercase;

alter table public.products
  add constraint chk_products_category_lowercase
  check (category::text = lower(category::text));

-- ============================================================================
-- End of migration 0028_fix_products_category_constraint.sql
-- ============================================================================
