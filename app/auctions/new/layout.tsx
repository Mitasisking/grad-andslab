// Scoped to app/auctions/new/ for the same reason as
// app/auctions/[id]/layout.tsx — keeps the legacy /auctions listing page untouched.
export default function NewAuctionLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ background: 'var(--paper)', color: 'var(--ink)', minHeight: '100vh' }}>{children}</div>
}
