// Scoped to app/admin/shop/, not app/admin/layout.tsx — matches
// app/admin/grading/layout.tsx's own reasoning: a layout at app/admin/
// would also wrap the legacy app/admin/page.tsx, which should stay untouched.
export default function AdminShopLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ background: 'var(--paper)', color: 'var(--ink)', minHeight: '100vh' }}>{children}</div>
}
