import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'My submissions',
  description: 'Track your grading submissions.',
}

export default function DashboardSubmissionsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--paper)', color: 'var(--ink)', minHeight: '100vh' }}>
      <div className="mx-auto max-w-3xl px-6 py-10 lg:py-16">{children}</div>
    </div>
  )
}
