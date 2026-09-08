import { redirect } from 'next/navigation'
import { getSupabaseRouteClient } from '@/lib/supabase-route-client'
import { formatUSD, formatZAR } from '@/lib/currency'

const ACCOUNT_LABEL: Record<string, string> = {
  revenue: 'Revenue',
  liability: 'Liability',
  expense: 'Expense',
  cogs: 'COGS',
  tax_payable: 'Tax Payable',
}

interface LedgerEntryRow {
  id: string
  order_id: string | null
  submission_id: string | null
  account_category: string
  amount: number
  currency: string
  created_at: string
}

export default async function AdminFinancialsPage() {
  const supabase = await getSupabaseRouteClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  // Revenue: captured orders only -- pending/failed/refunded aren't real
  // revenue yet. Figures here are each order's own total in ITS region's
  // currency (0032_multicurrency_checkout.sql) summed together, which is
  // exactly the gap ledger_currency/0034 exists to eventually close --
  // this skeleton doesn't convert ZAR/GBP into USD, so treat this number
  // as directional only until that conversion is built.
  const { data: capturedOrders } = await supabase
    .from('orders')
    .select('total, tax_collected')
    .eq('payment_status', 'captured')

  const revenue = (capturedOrders ?? []).reduce((sum, o) => sum + Number(o.total ?? 0), 0)
  const taxCollected = (capturedOrders ?? []).reduce((sum, o) => sum + Number(o.tax_collected ?? 0), 0)

  // Best-effort COGS: order_items joined to products.cost_basis, which is
  // null for the vast majority of the catalog right now (see 0034's own
  // comment) -- so this total only reflects the products someone has
  // actually priced a cost basis for, not true COGS across every order.
  const { data: itemsWithCost } = await supabase
    .from('order_items')
    .select('quantity, products(cost_basis)')

  const cogs = (itemsWithCost ?? []).reduce((sum, item) => {
    const product = item.products as unknown as { cost_basis: number | null } | null
    if (!product?.cost_basis) return sum
    return sum + product.cost_basis * item.quantity
  }, 0)

  const { count: missingCostCount } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .is('cost_basis', null)

  const { data: ledgerEntries } = await supabase
    .from('ledger_entries')
    .select('id, order_id, submission_id, account_category, amount, currency, created_at')
    .order('created_at', { ascending: false })
    .limit(20)

  const entries = (ledgerEntries ?? []) as LedgerEntryRow[]

  // The only figures on this page that are genuinely ZAR-normalized --
  // everything in ledger_entries is constrained to currency = 'zar'
  // (0034_accounting_foundations.sql) and posted in ZAR already
  // (app/api/submissions/route.ts converts at checkout time), unlike
  // Revenue/Tax Collected/COGS below, which sum each row's own real
  // region currency with no conversion. Shop orders don't post ledger
  // entries yet (only grading submissions do), so this is partial too.
  const { data: ledgerTotals } = await supabase.from('ledger_entries').select('account_category, amount')
  const ledgerRevenueZar = (ledgerTotals ?? [])
    .filter((e) => e.account_category === 'revenue')
    .reduce((sum, e) => sum + Number(e.amount), 0)
  const ledgerTaxPayableZar = (ledgerTotals ?? [])
    .filter((e) => e.account_category === 'tax_payable')
    .reduce((sum, e) => sum + Number(e.amount), 0)
  const ledgerLiabilityZar = (ledgerTotals ?? [])
    .filter((e) => e.account_category === 'liability')
    .reduce((sum, e) => sum + Number(e.amount), 0)

  const { count: uncostedTierCount } = await supabase
    .from('grading_tier_costs')
    .select('grading_company', { count: 'exact', head: true })
    .is('wholesale_cost_zar', null)

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <p className="text-[13px]" style={{ color: 'var(--ink-muted)' }}>
        Admin
      </p>
      <h1 className="text-[28px] mt-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
        Financials
      </h1>
      <p className="text-[13.5px] mt-2 max-w-2xl" style={{ color: 'var(--ink-muted)' }}>
        Foundational skeleton, not a finished reporting suite. The accounting baseline is ZAR — grading submissions
        post ledger entries in ZAR now; shop orders don&apos;t yet. Tax/FX rates are static placeholders. The
        &quot;grading company fee&quot; liability is looked up per company + tier from the grading_tier_costs
        matrix; it posts as 0 until real wholesale costs are filled in there.
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
        <MetricCard label="Ledger Revenue (ZAR, submissions only)" value={formatZAR(ledgerRevenueZar)} />
        <MetricCard label="Ledger Tax Payable (ZAR, submissions only)" value={formatZAR(ledgerTaxPayableZar)} />
        <MetricCard label="Ledger Liability (ZAR, submissions only)" value={formatZAR(ledgerLiabilityZar)} />
      </div>

      {!!uncostedTierCount && (
        <p className="text-[12.5px] mt-4" style={{ color: 'var(--danger)' }}>
          {uncostedTierCount} of 10 grading company/tier combinations still have no wholesale_cost_zar set in
          grading_tier_costs — the liability split above excludes them.
        </p>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
        <MetricCard label="Revenue (captured shop orders, unconverted)" value={formatUSD(revenue)} />
        <MetricCard label="Tax Collected (shop orders, unconverted)" value={formatUSD(taxCollected)} />
        <MetricCard label="COGS (priced products only)" value={formatUSD(cogs)} />
        <MetricCard label="Gross Margin (unconverted)" value={formatUSD(revenue - taxCollected - cogs)} />
      </div>

      {!!missingCostCount && (
        <p className="text-[12.5px] mt-4" style={{ color: 'var(--danger)' }}>
          {missingCostCount} product{missingCostCount === 1 ? '' : 's'} still have no cost basis set — COGS above
          excludes them.
        </p>
      )}

      <div className="mt-10">
        <h2 className="text-[18px]" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
          Recent ledger entries
        </h2>

        <div className="mt-4 border-t" style={{ borderColor: 'var(--line)' }}>
          {entries.length === 0 ? (
            <p className="text-[13.5px] py-6" style={{ color: 'var(--ink-muted)' }}>
              No ledger entries yet — grading submissions post revenue/tax entries in ZAR automatically now
              (app/api/submissions/route.ts); this stays empty until at least one has been created since the
              migration ran.
            </p>
          ) : (
            <>
              <div
                className="hidden sm:grid gap-4 py-2 text-[11.5px] uppercase tracking-wide border-b"
                style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr', borderColor: 'var(--line)', color: 'var(--ink-muted)' }}
              >
                <span>Date</span>
                <span>Category</span>
                <span>Source</span>
                <span>Amount</span>
              </div>
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="grid sm:grid-cols-4 gap-2 sm:gap-4 py-3 border-b text-[13.5px]"
                  style={{ borderColor: 'var(--line)' }}
                >
                  <span style={{ color: 'var(--ink-muted)' }}>{new Date(entry.created_at).toLocaleDateString()}</span>
                  <span style={{ color: 'var(--ink)' }}>{ACCOUNT_LABEL[entry.account_category] ?? entry.account_category}</span>
                  <span style={{ color: 'var(--ink-muted)' }}>
                    {entry.submission_id
                      ? `Submission ${entry.submission_id.slice(0, 8)}`
                      : entry.order_id
                        ? `Order ${entry.order_id.slice(0, 8)}`
                        : '—'}
                  </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>
                    {formatZAR(entry.amount)}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </main>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-[3px] p-5" style={{ borderColor: 'var(--line)' }}>
      <p className="text-[11.5px] uppercase tracking-wide" style={{ color: 'var(--ink-muted)' }}>
        {label}
      </p>
      <p className="text-[22px] mt-1.5" style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>
        {value}
      </p>
    </div>
  )
}
