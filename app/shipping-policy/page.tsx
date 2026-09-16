import { LegalPageLayout, Section, P, Item } from '@/components/legal/legal-page'

const LAST_UPDATED = '16/09/2026'

export const metadata = {
  title: "Shipping & Delivery Policy | Cuppa's Cards",
}

export default function ShippingPolicyPage() {
  return (
    <LegalPageLayout title="Shipping & Delivery Policy" lastUpdated={LAST_UPDATED}>
      <Section number="1" title="Domestic Shipping">
        <P>We deliver nationwide across South Africa via our trusted courier partners.</P>
        <Item label="Standard Delivery">Takes approximately 2 to 5 business days from dispatch.</Item>
        <Item label="Dispatch Times">Orders are typically packed and dispatched within 1 to 2 business days of payment clearance.</Item>
      </Section>

      <Section number="2" title="Shipping Costs">
        <P>Shipping fees are calculated at checkout based on your location and the size of the order.</P>
      </Section>

      <Section number="3" title="Grading Submission Logistics">
        <P>
          Cards submitted to Cuppa&apos;s Cards SA for grading follow a specific international shipping cycle. Due
          to the multiple courier legs required for international transit, standard domestic delivery timeframes do
          not apply to these services. Clients will be updated via email when their cards depart South Africa,
          arrive at the grading facility, and return to our Swellendam location for final dispatch.
        </P>
      </Section>

      <Section number="4" title="Lost or Damaged Parcels">
        <P>
          Please ensure your delivery address is accurate. Cuppa&apos;s Cards SA is not responsible for packages
          delivered to an incorrectly supplied address. If a parcel is lost or damaged in transit, please contact us
          immediately so we can lodge an inquiry with the courier.
        </P>
      </Section>
    </LegalPageLayout>
  )
}
