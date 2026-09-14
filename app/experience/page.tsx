import type { Metadata } from 'next'
import { ExperiencePage } from '@/components/experience/experience-page'
import { getChaseCards } from '@/components/experience/chase-cards'
import { getSupabaseRouteClient } from '@/lib/supabase-route-client'

export const metadata: Metadata = {
  title: "The Vault | Cuppa's Cards",
  description: 'An interactive look inside Cuppa’s Cards grading process.',
}

export default async function Page() {
  const supabase = await getSupabaseRouteClient()
  const chaseCards = await getChaseCards(supabase)

  return <ExperiencePage chaseCards={chaseCards} />
}
