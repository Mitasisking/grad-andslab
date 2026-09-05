import Link from 'next/link'

const CATEGORIES: { value: string | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: 'sealed', label: 'Sealed' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'graded', label: 'Graded' },
  { value: 'cards', label: 'Raw Cards' },
]

/** URL-driven filter (?category=), not client state — matches how app/shop/page.tsx fetches server-side. */
export function CategoryTabs({ active }: { active: string | null }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {CATEGORIES.map((c) => {
        const selected = active === c.value
        return (
          <Link
            key={c.label}
            href={c.value ? `/shop?category=${c.value}` : '/shop'}
            className="px-3.5 py-1.5 text-[13.5px] rounded-[3px] border"
            style={{
              borderColor: selected ? 'var(--seal)' : 'var(--line)',
              background: selected ? 'var(--paper-raised)' : 'transparent',
              color: 'var(--ink)',
            }}
          >
            {c.label}
          </Link>
        )
      })}
    </div>
  )
}
