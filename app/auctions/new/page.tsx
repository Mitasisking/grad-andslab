import { redirect } from 'next/navigation'
import { getSupabaseRouteClient } from '@/lib/supabase-route-client'
import { AuctionDraftForm } from '@/components/auctions/auction-draft-form'

/**
 * Grade-to-Auction landing (app/auctions/README.md's "Grade-to-Auction
 * pipeline"): reached from a "List on Auction" link next to a graded card
 * on the dashboard, as `/auctions/new?itemId=<id>`. Verifies ownership and
 * grading itself rather than trusting the query param, redirects straight
 * to an already-active listing instead of allowing a double-list, and
 * otherwise renders the pre-filled draft form.
 */
export default async function NewAuctionPage({
  searchParams,
}: {
  searchParams: Promise<{ itemId?: string }>
}) {
  const { itemId } = await searchParams
  if (!itemId) redirect('/')

  const supabase = await getSupabaseRouteClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: item } = await supabase
    .from('submission_items')
    .select(
      'id, card_name, set_name, grade_result, market_value_estimate, declared_value, hi_res_photo_url, submissions(grading_company, user_id, status)',
    )
    .eq('id', itemId)
    .single()

  // Without generated Supabase types, a to-one embed (submission_items ->
  // submissions via submission_id) still infers as an array — it's a single
  // row at runtime, so normalize it explicitly rather than force-casting.
  const rawSubmission = item?.submissions
  const submission = Array.isArray(rawSubmission) ? rawSubmission[0] : rawSubmission

  if (!item || item.grade_result === null || !submission || submission.status !== 'graded' || submission.user_id !== user.id) {
    redirect('/')
  }

  // Don't let a second listing get created for a card that's already live.
  const { data: existingAuction } = await supabase
    .from('auctions')
    .select('id')
    .eq('item_id', itemId)
    .in('status', ['active', 'extended'])
    .maybeSingle()

  if (existingAuction) {
    redirect(`/auctions/${existingAuction.id}`)
  }

  return (
    <AuctionDraftForm
      item={{
        id: item.id,
        card_name: item.card_name,
        set_name: item.set_name,
        grade_result: item.grade_result,
        market_value_estimate: item.market_value_estimate,
        declared_value: item.declared_value,
        hi_res_photo_url: item.hi_res_photo_url,
        submissions: { grading_company: submission.grading_company },
      }}
    />
  )
}
