/**
 * Flat shipping charge added to every shop order, in South African Rand.
 * The shop only sells in ZAR (create_order() rejects any non-'sa' product).
 *
 * This is the display/app-side copy. The amount actually charged is fixed
 * inside create_order() itself (supabase/migrations/0066_server_side_shop_shipping.sql),
 * which ignores whatever shipping value it is called with -- so if this
 * ever changes, that migration's v_shipping_zar must change in the same
 * commit, or the checkout page will show a total Payfast doesn't charge.
 */
export const SHOP_SHIPPING_FLAT_RATE_ZAR = 110
