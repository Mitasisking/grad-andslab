import { LegalPageLayout, Section, SubSection, P, Item, Bullets } from '@/components/legal/legal-page'

const LAST_UPDATED = '24/09/2026'

export default function TermsPage() {
  return (
    <LegalPageLayout title="Terms & Conditions" lastUpdated={LAST_UPDATED}>
      <Section number="1" title="Introduction">
        <P>
          Welcome to CuppasCards SA, operated by Mitchy Moo (Pty) Ltd (Registration Number: 2025/318120/07).
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
          When utilizing our middleman grading services to a third-party grading company (currently ACE Grading in
          the UK), CuppasCards SA acts only as a facilitator for shipping and logistics.
        </P>
        <Bullets>
          <li>We do not guarantee specific grades.</li>
          <li>Turnaround times are estimates based on international shipping and the grading company&apos;s current volume.</li>
          <li>
            CuppasCards SA is not liable for loss or damage of items while in the custody of international
            couriers or the grading company. Compensation for loss or damage in transit is limited to the Secursus
            insurance payout described in section 5.3, and we will facilitate that claim on your behalf.
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

      <Section number="5" title="Shipping Policy" id="shipping-policy">
        <SubSection number="5.1" title="Domestic Shop Orders">
          <Bullets>
            <li>
              <strong className="text-slate-100">Flat Rate:</strong> All standard Shop purchases are subject to a flat
              domestic shipping rate of R 110,00 per order.
            </li>
            <li>
              <strong className="text-slate-100">Couriers:</strong> We utilize trusted local logistics partners,
              primarily The Courier Guy and Pudo, to ensure secure, tracked delivery across South Africa.
            </li>
            <li>
              <strong className="text-slate-100">Processing Time:</strong> In-stock shop orders are typically processed
              and dispatched within 1 to 2 business days. Delivery timeframes depend on the destination but generally
              range from 2 to 4 business days post-dispatch.
            </li>
          </Bullets>
        </SubSection>

        <SubSection number="5.2" title="Grading Submission Logistics (Middleman Service)">
          <P>Our grading submission service involves a multi-leg journey to ACE Grading in the UK and back.</P>
          <Bullets>
            <li>
              <strong className="text-slate-100">Domestic Legs:</strong> Clients are responsible for getting their cards
              to our intake facility and for the final return leg from our facility to their address. The standard
              courier fee for the return leg from our facility to your address is R 110,00. Clients arrange and pay
              for their own shipping to our intake facility.
            </li>
            <li>
              <strong className="text-slate-100">International Freight:</strong> Outbound and return international
              freight for pooled batches is calculated at the time of submission checkout. These shipments are
              dispatched using expedited, secure international couriers.
            </li>
          </Bullets>
        </SubSection>

        <SubSection number="5.3" title="Insurance Coverage">
          <Bullets>
            <li>
              <strong className="text-slate-100">Mandatory Protection:</strong> To safeguard your high-value assets,
              mandatory fine-art insurance via Secursus is applied to all international grading submissions.
            </li>
            <li>
              <strong className="text-slate-100">Calculation:</strong> Insurance is calculated at 15% of your declared
              card value (in ZAR) and is applied twice to cover both the outbound leg (SA to UK) and the return leg (UK
              to SA).
            </li>
            <li>
              <strong className="text-slate-100">Liability:</strong> CuppasCards (operating under Mitchy Moo Pty Ltd)
              acts strictly as a secure middleman. In the unlikely event of loss or damage during transit, compensation
              is strictly limited to the finalized payout from the Secursus insurance claim based on your declared
              value.
            </li>
          </Bullets>
        </SubSection>

        <SubSection number="5.4" title="Customs, Duties, and Taxes">
          <Bullets>
            <li>
              <strong className="text-slate-100">Import Assessments:</strong> International return shipments from the
              UK are subject to South African customs clearance.
            </li>
            <li>
              <strong className="text-slate-100">Client Responsibility:</strong> Estimates typically include a ~20%
              customs duty assessment and 15% VAT levied on the declared grading and service values upon re-entry.
              These baseline estimates are built into the submission flow, but any exceptional levies imposed by SARS
              Customs remain the liability of the client.
            </li>
          </Bullets>
        </SubSection>
      </Section>

      <Section number="6" title="Refund & Return Policy" id="refund-policy">
        <SubSection number="6.1" title="Shop Purchases (Sealed Product & Singles)">
          <Bullets>
            <li>
              <strong className="text-slate-100">Sealed Product:</strong> Unopened, factory-sealed products (e.g.,
              booster boxes, Elite Trainer Boxes) may be returned within 7 days of delivery for a full refund, minus
              the original R 110,00 shipping cost and return shipping fees. The tamper-proof seals and shrink wrap
              must be completely intact.
            </li>
            <li>
              <strong className="text-slate-100">Single Cards (Raw &amp; Graded):</strong> Due to the volatile nature of
              trading card market values and condition sensitivities, all sales of single cards (raw or graded) are
              strictly final.
            </li>
            <li>
              <strong className="text-slate-100">Damaged Shop Items:</strong> If a shop order arrives damaged, you must
              contact our support team with photographic evidence of the packaging and the item within 24 hours of
              delivery to initiate an insurance review.
            </li>
          </Bullets>
        </SubSection>

        <SubSection number="6.2" title="Grading Submissions">
          <Bullets>
            <li>
              <strong className="text-slate-100">Pre-Dispatch Cancellations:</strong> You may cancel a grading
              submission for a full refund (minus any non-refundable payment gateway transaction fees) only if the
              cancellation is requested <em>before</em> your cards have been processed and dispatched in an outbound
              international batch.
            </li>
            <li>
              <strong className="text-slate-100">Post-Dispatch Finality:</strong> Once a submission batch has physically
              left our South African facility en route to ACE Grading, the service is locked in. No refunds, tier
              changes, or cancellations can be processed under any circumstances.
            </li>
            <li>
              <strong className="text-slate-100">Pre-Grading Preparation:</strong> Fees paid for optional add-ons (such
              as Pre-grading preparation, Full Clean &amp; Polish, or Slab Guards) are non-refundable once the physical
              work on the card has commenced at our intake facility.
            </li>
            <li>
              <strong className="text-slate-100">Grader Outcomes:</strong> CuppasCards provides logistics, cleaning, and
              middleman services. We do not determine the final grade. We offer no refunds, partial credits, or
              compensation if a card receives a lower grade than expected from ACE Grading.
            </li>
          </Bullets>
        </SubSection>

        <SubSection number="6.3" title="Processing of Refunds">
          <P>
            Approved refunds will be processed back to the original method of payment strictly in South African Rands
            (ZAR). Please allow 5 to 7 business days for the funds to reflect in your account, depending on your
            banking institution.
          </P>
        </SubSection>
      </Section>

      <Section number="7" title="Company Contact Details">
        <Item label="Company">Mitchy Moo (Pty) Ltd t/a CuppasCards SA</Item>
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
