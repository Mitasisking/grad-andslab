// Every price in the app is stored as a plain number (products.price,
// auctions.starting_price/current_high_bid, cart totals) — this is the one
// place that turns a number into the Rand string shown to a customer, so
// every marketplace surface (shop, cart, checkout, auctions) formats the
// same way instead of each screen hand-rolling its own `$`/toFixed(2).
export function formatZAR(amount: number): string {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount)
}

// The grading submission flow (lib/submission-types.ts, components/submit/*)
// prices and charges exclusively in USD, independent of the ZAR the rest of
// the marketplace (shop/auctions/shop-checkout) uses -- see that formatZAR
// above for those. Kept as its own function rather than a currency param on
// formatZAR so callers can't mix the two up by passing the wrong code.
export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}
