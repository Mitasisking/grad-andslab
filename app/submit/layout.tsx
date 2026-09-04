export default function SubmitLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ background: 'var(--paper)', color: 'var(--ink)', minHeight: '100vh' }}>{children}</div>
}
