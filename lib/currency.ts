// Every price in the app is stored as a plain number (products.price,
// auctions.starting_price/current_high_bid, cart totals) — this is the one
// place that turns a number into the Rand string shown to a customer, so
// every marketplace surface (shop, cart, checkout, auctions) formats the
// same way instead of each screen hand-rolling its own `$`/toFixed(2).
export function formatZAR(amount: number): string {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount)
}
