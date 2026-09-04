// Scoped to app/admin/grading/, not app/admin/layout.tsx — a layout there
// would also wrap the legacy app/admin/page.tsx, which should stay untouched.
export default function AdminGradingLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ background: 'var(--paper)', color: 'var(--ink)', minHeight: '100vh' }}>{children}</div>
}
