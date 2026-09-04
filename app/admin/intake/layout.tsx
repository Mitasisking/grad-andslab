// Scoped to app/admin/intake/, for the same reason as
// app/admin/grading/layout.tsx — keeps the legacy /admin page untouched.
export default function AdminIntakeLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ background: 'var(--paper)', color: 'var(--ink)', minHeight: '100vh' }}>{children}</div>
}
