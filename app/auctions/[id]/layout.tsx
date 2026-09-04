// Scoped to app/auctions/[id]/ specifically, not app/auctions/layout.tsx —
// a layout there would also wrap the legacy app/auctions/page.tsx listing,
// which doesn't reference these tokens and should render unchanged.
export default function AuctionDetailLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ background: 'var(--paper)', color: 'var(--ink)', minHeight: '100vh' }}>{children}</div>
}
