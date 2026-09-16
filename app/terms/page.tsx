import { LegalPageLayout, Section, P, Item, Bullets } from '@/components/legal/legal-page'

const LAST_UPDATED = '16/09/2026'

export default function TermsPage() {
  return (
    <LegalPageLayout title="Terms & Conditions" lastUpdated={LAST_UPDATED}>
      <Section number="1" title="Introduction">
        <P>
          Welcome to Cuppa&apos;s Cards SA, operated by Mitchy Moo (Pty) Ltd (Registration Number: 2025/318120/07).
          These Terms and Conditions govern your use of our website and the purchase of goods and services,
          including sealed products, single cards, card cleaning, and middleman grading submissions. By using our
          website, you agree to be bound by these terms.
        </P>
      </Section>

      <Section number="2" title="Pricing and Payments">
        <P>
          All prices listed on the website are strictly in South African Rands (ZAR). We do not accept payments or
          process quotes in foreign currencies. Payments are processed securely via Payfast. Goods and services will
          only be fulfilled once payment has cleared in full.
        </P>
      </Section>

      <Section number="3" title="Grading Submission Services">
        <P>
          When utilizing our middleman grading services to third-party grading companies (e.g., PCG), Cuppa&apos;s
          Cards SA acts only as a facilitator for shipping and logistics.
        </P>
        <Bullets>
          <li>We do not guarantee specific grades.</li>
          <li>Turnaround times are estimates based on international shipping and the grading company&apos;s current volume.</li>
          <li>
            Cuppa&apos;s Cards SA is not liable for loss or damage of items while in the custody of international
            couriers or the grading company, though we will facilitate insurance claims where applicable.
          </li>
        </Bullets>
      </Section>

      <Section number="4" title="Errors and Omissions">
        <P>
          While we strive for accuracy, trading card market prices fluctuate. We reserve the right to cancel any
          order in the event of an obvious pricing error or inventory shortage, in which case a full refund will be
          issued.
        </P>
      </Section>

      <Section number="5" title="Company Contact Details">
        <Item label="Company">Mitchy Moo (Pty) Ltd t/a Cuppa&apos;s Cards SA</Item>
        <Item label="Email">
          <a href="mailto:mitchell@cuppascards.com" className="text-amber-400 hover:text-amber-300 transition">
            mitchell@cuppascards.com
          </a>
        </Item>
        <Item label="Address">1 Koster street, Swellendam, South Africa</Item>
      </Section>
    </LegalPageLayout>
  )
}
