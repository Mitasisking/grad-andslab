-- ============================================================================
-- Migration: 0029_add_product_images_bucket.sql
--
-- Adds a 'product-images' Storage bucket so the Shop Admin Dashboard
-- (app/admin/shop/) can upload card/product photos straight from the
-- New/Edit Product form, instead of only accepting a pasted image URL.
-- public.products already has the images text[] column it writes to
-- (0001_init_schema.sql) -- no products table change needed, just
-- somewhere admin-uploaded files can land.
--
-- Same shape as 0010_rls_hardening_low.sql's submission-photos bucket:
-- public read (product photos are meant to be public the moment they're
-- saved -- components/shop/product-grid.tsx renders them with a plain
-- <img src>, same reasoning as 0010's comment on that bucket), admin-only
-- write via the same requireAdmin()-gated route pattern
-- (app/api/admin/products/photo/route.ts mints the signed upload URL).
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "product_images_admin_insert" on storage.objects;
create policy "product_images_admin_insert"
  on storage.objects for insert
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "product_images_admin_update" on storage.objects;
create policy "product_images_admin_update"
  on storage.objects for update
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "product_images_admin_delete" on storage.objects;
create policy "product_images_admin_delete"
  on storage.objects for delete
  using (bucket_id = 'product-images' and public.is_admin());

-- ============================================================================
-- End of migration 0029_add_product_images_bucket.sql
-- ============================================================================
