const LAST_UPDATED = '07/09/2026'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="max-w-3xl mx-auto px-6 py-20 md:py-28">
        <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600 mb-3 tracking-tight">
          Terms of Service
        </h1>
        <p className="text-sm text-slate-500 mb-12">Last Updated: {LAST_UPDATED}</p>

        <p className="text-slate-300 leading-relaxed mb-12">
          Welcome to Cuppas Cards RSA, operated by Mitchy Moo (Pty) Ltd (&quot;we,&quot; &quot;us,&quot; or
          &quot;our&quot;). By accessing our website, purchasing products from our shop, or utilizing our card
          grading submission services, you agree to be bound by these Terms of Service.
        </p>

        <div className="space-y-12">
          <Section number="1" title="General Provisions">
            <P>
              By using our platform, you confirm that you are legally capable of entering into binding contracts.
              We reserve the right to refuse service, terminate accounts, or cancel orders at our sole discretion.
              All pricing and transactions on our platform are processed in USD ($).
            </P>
          </Section>

          <Section number="2" title="Grading Middleman Services">
            <P>
              Cuppa Cards acts strictly as an intermediary between you (the customer) and third-party grading
              companies (including, but not limited to, PSA, ACE, and PCG).
            </P>
            <Item label="Subjectivity of Grades">
              We do not grade cards ourselves and cannot guarantee any specific grade. The final grade is
              determined solely by the third-party grading company.
            </Item>
            <Item label="Pre-Grading Inspections">
              If you select our &quot;Inspect &amp; clean&quot; service, we will lightly clean surface debris. This
              service does not guarantee a higher grade, and we are not liable for any microscopic damage that may
              already exist on the card.
            </Item>
            <Item label="Submission Timelines">
              Estimated turnaround times are provided by the grading companies and are subject to change. We are
              not responsible for delays caused by the grading companies or customs processing.
            </Item>
          </Section>

          <Section number="3" title="Shipping and Liability">
            <Item label="Customer to Cuppas Cards RSA">
              You are responsible for safely packaging your cards (we recommend Penny Sleeves and Card Saver 1s)
              and shipping them to us. We are not liable for any damage or loss that occurs before the items are
              officially marked as received at our facility.
            </Item>
            <Item label="Cuppas Cards RSA to Grading Companies">
              Once received, your items are fully covered by our fine art insurance policy while in our possession
              and during transit to and from the grading companies.
            </Item>
            <Item label="Return Shipping">
              We will ship your graded or raw cards back to you using secure, tracked courier services. Our
              liability ends once the package is marked as &quot;Delivered&quot; by the courier.
            </Item>
          </Section>

          <Section number="4" title="Retail Purchases (Shop)">
            <Item label="Card Condition">
              Raw (ungraded) cards are sold &quot;as is.&quot; We strive to provide accurate imagery and condition
              descriptions, but minor imperfections may exist.
            </Item>
            <Item label="Returns & Refunds">
              Due to the volatile nature of the trading card market, all sales on single cards (raw or graded) and
              sealed products are final. Refunds are only issued in the event of an inventory error or if a product
              arrives significantly not as described.
            </Item>
          </Section>

          <Section number="5" title="Vendor Bookings & Events">
            <P>
              Event organizers submitting inquiries through our Vendor portal agree to provide accurate event
              details. Submitting a booking inquiry does not guarantee our attendance; all vending arrangements are
              subject to formal agreement and availability.
            </P>
          </Section>

          <Section number="6" title="Limitation of Liability">
            <P>
              To the maximum extent permitted by law, Mitchy Moo (Pty) Ltd and Cuppas Cards Rsa shall not be liable
              for any indirect, incidental, or consequential damages arising from the use of our services, including
              but not limited to market fluctuations in the value of your trading cards.
            </P>
          </Section>

          <Section number="7" title="Governing Law">
            <P>
              These Terms of Service and any separate agreements whereby we provide you services shall be governed
              by and construed in accordance with the laws of South Africa.
            </P>
          </Section>

          <Section number="8" title="Contact Information">
            <P>
              Questions about the Terms of Service should be sent to us at{' '}
              <a href="mailto:mitchell@cuppascardsrsa.co.za" className="text-amber-400 hover:text-amber-300 transition">
                mitchell@cuppascardsrsa.co.za
              </a>
              .
            </P>
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
        <span className="text-amber-400">{number}.</span> {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-slate-300 leading-relaxed">{children}</p>
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="text-slate-300 leading-relaxed">
      <span className="font-semibold text-slate-100">{label}:</span> {children}
    </p>
  )
}
