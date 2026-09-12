import type { Metadata } from 'next'
import { ExperiencePage } from '@/components/experience/experience-page'

export const metadata: Metadata = {
  title: "The Vault | Cuppa's Cards",
  description: 'An interactive look inside Cuppa’s Cards grading process.',
}

export default function Page() {
  return <ExperiencePage />
}
