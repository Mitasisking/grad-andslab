import { redirect } from 'next/navigation'
import { getSupabaseRouteClient } from '@/lib/supabase-route-client'
import { formatZAR, formatGBP } from '@/lib/currency'
import { getLatestGbpZarRate, zarToGbp, type ExchangeRate } from '@/lib/pricing/exchange-rate'

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

  // Every real order/submission is region = 'sa' now (app/shop/page.tsx,
  // components/submit/step-grader-tier.tsx both hide the USA/UK option),
  // so orders.total / submissions.service_fee are ZAR amounts in practice
  // -- the USD formatting this card used to have was a mislabel, not a
  // real currency, and never actually converted anything.
  const { data: capturedOrders } = await supabase
    .from('orders')
    .select('total, tax_collected')
    .eq('payment_status', 'captured')

  const shopRevenueZar = (capturedOrders ?? []).reduce((sum, o) => sum + Number(o.total ?? 0), 0)
  const shopTaxCollectedZar = (capturedOrders ?? []).reduce((sum, o) => sum + Number(o.tax_collected ?? 0), 0)

  // Best-effort COGS: order_items joined to products.cost_basis, which is
  // null for the vast majority of the catalog right now (see 0034's own
  // comment) -- so this total only reflects the products someone has
  // actually priced a cost basis for, not true COGS across every order.
  const { data: itemsWithCost } = await supabase
    .from('order_items')
    .select('quantity, products(cost_basis)')

  const cogsZar = (itemsWithCost ?? []).reduce((sum, item) => {
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

  // Liability split by grading company -- ledger_entries has no
  // grading_company column of its own (a liability entry only ever posts
  // against a submission_id, never a company directly), so this joins
  // through the real FK to submissions to get there. Stays at R0/R0 until
  // grading_tier_costs.wholesale_cost_zar is actually filled in (every row
  // is null today -- see 0034_accounting_foundations.sql) since that's the
  // true number, not a fabricated split.
  const { data: liabilityEntries } = await supabase
    .from('ledger_entries')
    .select('amount, submissions(grading_company)')
    .eq('account_category', 'liability')

  const liabilityByCompanyZar: Record<string, number> = { PCG: 0, ACE: 0 }
  for (const entry of liabilityEntries ?? []) {
    const company = (entry.submissions as unknown as { grading_company: string } | null)?.grading_company
    if (company !== 'PCG' && company !== 'ACE') continue
    liabilityByCompanyZar[company] += Number(entry.amount)
  }

  const { count: uncostedTierCount } = await supabase
    .from('grading_tier_costs')
    .select('grading_company', { count: 'exact', head: true })
    .is('wholesale_cost_zar', null)

  // Cash flow: "pending" is money a checkout has started collecting but
  // Payfast hasn't confirmed yet (could still fail or be abandoned);
  // "cleared" is payment_status = 'captured' -- confirmed, in-hand. Same
  // ZAR-in-practice reasoning as shopRevenueZar above applies to both.
  const [{ data: pendingOrders }, { data: pendingSubmissions }, { data: capturedSubmissions }] = await Promise.all([
    supabase.from('orders').select('total').eq('payment_status', 'pending'),
    supabase.from('submissions').select('service_fee').eq('payment_status', 'pending'),
    supabase.from('submissions').select('service_fee').eq('payment_status', 'captured'),
  ])

  const pendingPaymentsZar =
    (pendingOrders ?? []).reduce((sum, o) => sum + Number(o.total ?? 0), 0) +
    (pendingSubmissions ?? []).reduce((sum, s) => sum + Number(s.service_fee ?? 0), 0)

  const clearedLiquidCashZar =
    shopRevenueZar + (capturedSubmissions ?? []).reduce((sum, s) => sum + Number(s.service_fee ?? 0), 0)

  const rate = await getLatestGbpZarRate()

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <p className="text-[13px]" style={{ color: 'var(--ink-muted)' }}>
        Admin
      </p>
      <h1 className="text-[28px] mt-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
        Financials
      </h1>
      <p className="text-[13.5px] mt-2 max-w-2xl" style={{ color: 'var(--ink-muted)' }}>
        Foundational skeleton, not a finished reporting suite. Every figure here is ZAR-primary — this business bills
        and reports in ZAR, with the bracketed GBP figure a live conversion for the UK team (
        {rate ? `synced ${new Date(rate.updatedAt).toLocaleString()}` : 'no exchange rate synced yet'}
        ). The &quot;grading company fee&quot; liability is looked up per company + tier from the
        grading_tier_costs matrix; it posts as R0 until real wholesale costs are filled in there.
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
        <MetricCard label="Ledger Revenue" valueZar={ledgerRevenueZar} rate={rate} />
        <MetricCard label="Ledger Tax Payable" valueZar={ledgerTaxPayableZar} rate={rate} />
        <LiabilityCard totalZar={ledgerLiabilityZar} byCompanyZar={liabilityByCompanyZar} rate={rate} />
      </div>

      {!!uncostedTierCount && (
        <p className="text-[12.5px] mt-4" style={{ color: 'var(--danger)' }}>
          {uncostedTierCount} of 10 grading company/tier combinations still have no wholesale_cost_zar set in
          grading_tier_costs — the liability split above excludes them.
        </p>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
        <MetricCard label="Shop Orders (captured revenue)" valueZar={shopRevenueZar} rate={rate} />
        <MetricCard label="Tax Collected (shop orders)" valueZar={shopTaxCollectedZar} rate={rate} />
        <MetricCard label="COGS (priced products only)" valueZar={cogsZar} rate={rate} />
        <MetricCard label="Gross Margin" valueZar={shopRevenueZar - shopTaxCollectedZar - cogsZar} rate={rate} />
      </div>

      {!!missingCostCount && (
        <p className="text-[12.5px] mt-4" style={{ color: 'var(--danger)' }}>
          {missingCostCount} product{missingCostCount === 1 ? '' : 's'} still have no cost basis set — COGS above
          excludes them.
        </p>
      )}

      <div className="mt-10">
        <h2 className="text-[18px]" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
          Cash flow
        </h2>
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <MetricCard
            label="Pending Payments (processing checkouts)"
            valueZar={pendingPaymentsZar}
            rate={rate}
          />
          <MetricCard label="Cleared Liquid Cash" valueZar={clearedLiquidCashZar} rate={rate} />
        </div>
        <p className="text-[12px] mt-2" style={{ color: 'var(--ink-muted)' }}>
          Pending = shop orders and grading submissions whose checkout has started but Payfast hasn&apos;t confirmed
          yet. Cleared = payment_status = &apos;captured&apos; on both — confirmed, in the account.
        </p>
      </div>

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
                    {formatZarGbp(entry.amount, rate)}
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

/** "R 221,00 (£9.50)" -- omits the bracket entirely rather than guessing when no rate has ever synced yet (rate === null, e.g. before app/api/cron/update-exchange-rate has run once). */
function formatZarGbp(amountZar: number, rate: ExchangeRate | null): string {
  if (!rate) return formatZAR(amountZar)
  return `${formatZAR(amountZar)} (${formatGBP(zarToGbp(amountZar, rate))})`
}

function MetricCard({ label, valueZar, rate }: { label: string; valueZar: number; rate: ExchangeRate | null }) {
  return (
    <div className="border rounded-[3px] p-5" style={{ borderColor: 'var(--line)' }}>
      <p className="text-[11.5px] uppercase tracking-wide" style={{ color: 'var(--ink-muted)' }}>
        {label}
      </p>
      <p className="text-[22px] mt-1.5" style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>
        {formatZarGbp(valueZar, rate)}
      </p>
    </div>
  )
}

function LiabilityCard({
  totalZar,
  byCompanyZar,
  rate,
}: {
  totalZar: number
  byCompanyZar: Record<string, number>
  rate: ExchangeRate | null
}) {
  return (
    <div className="border rounded-[3px] p-5" style={{ borderColor: 'var(--line)' }}>
      <p className="text-[11.5px] uppercase tracking-wide" style={{ color: 'var(--ink-muted)' }}>
        Ledger Liability
      </p>
      <p className="text-[22px] mt-1.5" style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>
        {formatZarGbp(totalZar, rate)}
      </p>
      <div className="mt-3 pt-3 border-t space-y-1.5" style={{ borderColor: 'var(--line)' }}>
        {(['PCG', 'ACE'] as const).map((company) => (
          <div key={company} className="flex items-center justify-between text-[12.5px]">
            <span style={{ color: 'var(--ink-muted)' }}>{company}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>
              {formatZarGbp(byCompanyZar[company] ?? 0, rate)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
