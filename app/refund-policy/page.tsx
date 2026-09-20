import { LegalPageLayout, Section, P } from '@/components/legal/legal-page'

const LAST_UPDATED = '16/09/2026'

export const metadata = {
  title: 'Refund & Return Policy | CuppasCards',
}

export default function RefundPolicyPage() {
  return (
    <LegalPageLayout title="Refund & Return Policy" lastUpdated={LAST_UPDATED}>
      <Section number="1" title="General Returns (Consumer Protection Act)">
        <P>
          You are entitled to cancel your order and return standard goods within 7 days of receipt for a refund,
          provided the goods are in their original, unopened condition. Return shipping costs are the responsibility
          of the customer unless the item was fundamentally defective or incorrectly supplied.
        </P>
      </Section>

      <Section number="2" title="Sealed Trading Card Products">
        <P>
          Due to the nature of collectible trading cards, strictly no returns or refunds will be accepted on sealed
          products (such as booster boxes, Elite Trainer Boxes, or blister packs) once the factory seal or packaging
          has been broken, opened, or tampered with.
        </P>
      </Section>

      <Section number="3" title="Single Cards">
        <P>
          Single cards are sold based on standard condition guidelines. If you believe a card was severely
          miscategorised, you must contact us within 48 hours of delivery. Returns on single cards are handled on a
          case-by-case basis to prevent card swapping.
        </P>
      </Section>

      <Section number="4" title="Grading Submissions & Services">
        <P>
          Once a card has been cleaned or dispatched to a third-party grading company, the service is considered
          rendered, and the grading fee is non-refundable.
        </P>
      </Section>

      <Section number="5" title="Processing Refunds">
        <P>
          Approved refunds will be processed via the original payment method and may take 3 to 5 business days to
          reflect in your account.
        </P>
      </Section>
    </LegalPageLayout>
  )
}
