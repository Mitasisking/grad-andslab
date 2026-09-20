-- ============================================================================
-- Migration: 0063_add_product_grading_company.sql
--
-- Adds a real products.grading_company column so the shop's Grader filter
-- (components/shop/product-filters.tsx) stops relying on a bare title
-- substring match (lib/shop/grader.ts's now-removed matchesGrader). That
-- heuristic misclassified any card whose own name happens to contain a
-- grader's letters -- concretely, "ACE SPEC" is a real Pokemon TCG card
-- mechanic (e.g. "Prime Catcher ACE SPEC"), so a PCG- or PSA-graded ACE SPEC
-- card's title (e.g. "Prime Catcher ACE SPEC — PSA 10") would incorrectly
-- match a customer's ACE grader filter, since the check only asked "does
-- the word ACE appear anywhere in this title", never which grader actually
-- graded it.
--
-- Nullable (not every row is category = 'graded', and even some historical
-- graded rows can't be confidently reclassified -- see the backfill below),
-- with a CHECK pinning it to 'PCG'/'ACE'/'PSA' and a second CHECK forbidding
-- it outside category = 'graded', same two-constraint shape already used
-- for grading_company/tier pairing on public.submissions (0023_allow_pcg_psa_ace_grading.sql).
-- ============================================================================

alter table public.products
  add column grading_company text;

alter table public.products
  add constraint chk_products_grading_company_valid
  check (grading_company is null or grading_company in ('PCG', 'ACE', 'PSA'));

alter table public.products
  add constraint chk_products_grading_company_matches_category
  check (grading_company is null or category = 'graded');

-- Backfill for existing 'graded' rows, so switching the filter to read this
-- column doesn't silently drop products a customer could already find.
-- Every current grading-tool import (bulk-pcg-import.tsx, bulk-ace-import.tsx,
-- bulk-psa-import.tsx) appends the exact literal suffix " — <GRADER> <grade>"
-- to the title (e.g. "Ninetales — PCG 9") -- matching that anchored suffix,
-- not a bare "contains" check, is what avoids reintroducing the exact bug
-- this migration exists to fix (a card whose own name contains a grader's
-- letters, like "... ACE SPEC — PSA 10", must not match on "ACE"). A manually
-- created graded product with no such suffix is left NULL rather than
-- guessed at -- same "can't be classified, don't guess" stance already
-- taken by components/shop/product-filters.tsx's deriveSetLanguages.
update public.products set grading_company = 'PCG' where category = 'graded' and grading_company is null and title like '%— PCG %';
update public.products set grading_company = 'ACE' where category = 'graded' and grading_company is null and title like '%— ACE %';
update public.products set grading_company = 'PSA' where category = 'graded' and grading_company is null and title like '%— PSA %';

-- ============================================================================
-- End of migration 0063_add_product_grading_company.sql
-- ============================================================================
