-- ============================================================================
-- Migration: 0058_add_product_lore.sql
--
-- Adds an optional ~100-word "lore" story to a product, generated via
-- /api/admin/generate-lore and shown on the public product card ("The Story
-- of this Card") for high-end chase cards. Nullable and free-form: most
-- products will never have one, and admins can freely edit the generated
-- text before saving.
-- ============================================================================

alter table public.products
  add column lore text;

-- ============================================================================
-- End of migration 0058_add_product_lore.sql
-- ============================================================================
