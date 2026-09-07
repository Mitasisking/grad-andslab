const LAST_UPDATED = '07/09/2026'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="max-w-3xl mx-auto px-6 py-20 md:py-28">
        <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600 mb-3 tracking-tight">
          Privacy Policy
        </h1>
        <p className="text-sm text-slate-500 mb-12">Last Updated: {LAST_UPDATED}</p>

        <p className="text-slate-300 leading-relaxed mb-12">
          This Privacy Policy explains what personal information Cuppa Cards, operated by Mitchy Moo (Pty) Ltd
          (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), collects through this website, our shop, our card
          grading submission service, and our contact and vendor forms, and how we use, share, and protect it.
        </p>

        <div className="space-y-12">
          <Section number="1" title="Information We Collect">
            <Item label="Account information">
              When you create an account, we collect your name and email address.
            </Item>
            <Item label="Shipping addresses">
              Addresses you save are used to ship graded cards and shop orders back to you.
            </Item>
            <Item label="Card submission details">
              When you submit cards for grading, we collect card details (name, set, card number, declared value)
              and any market value estimate looked up from a third-party pricing source at your request.
            </Item>
            <Item label="Order and purchase history">
              Products purchased, submissions made, and auction bids placed through your account.
            </Item>
            <Item label="Payment information">
              Payments are processed by Stripe. We do not collect or store your full card number — see Section 3.
            </Item>
            <Item label="Contact and vendor form submissions">
              Name, email, and message content you submit through our Contact Us or Vendor booking forms.
            </Item>
          </Section>

          <Section number="2" title="How We Use Your Information">
            <P>We use the information above to:</P>
            <Item label="Fulfil orders and submissions">
              Process shop purchases, ship physical cards to and from grading partners, and deliver graded or raw
              cards back to you.
            </Item>
            <Item label="Communicate with you">
              Send order confirmations, submission status updates, and respond to messages you send us.
            </Item>
            <Item label="Prevent fraud and abuse">
              Verify orders and submissions, and protect the security of accounts and payments.
            </Item>
            <Item label="Improve our services">
              Understand how the shop, submission flow, and auctions are used so we can improve them.
            </Item>
          </Section>

          <Section number="3" title="Third-Party Service Providers">
            <P>We share information with the following third parties only as needed to provide our services:</P>
            <Item label="Stripe">
              Processes all payments. Stripe receives your payment details directly and in accordance with its own
              privacy policy — we never see or store your full card number.
            </Item>
            <Item label="Grading partners (PCG, PSA, ACE)">
              When you submit cards for grading, your name, shipping address, and card details are shared with the
              grading company you select, so far as needed to process your submission.
            </Item>
            <Item label="Supabase">
              Our database, authentication, and file storage provider, which hosts the information described in
              Section 1.
            </Item>
            <Item label="Shipping couriers">
              Your name and address are shared with the courier you select to ship and deliver your order or
              submission.
            </Item>
            <P>We do not sell your personal information to third parties.</P>
          </Section>

          <Section number="4" title="Cookies and Local Storage">
            <P>
              Your shopping cart is stored in your browser&apos;s local storage, not on our servers, so it stays
              private to your device and is never shared with us until you check out. We do not currently use
              third-party advertising or tracking cookies.
            </P>
          </Section>

          <Section number="5" title="Data Security">
            <P>
              Payment data is handled entirely by Stripe under its own PCI-compliant infrastructure. Account and
              submission data is stored with Supabase, encrypted in transit and at rest. No method of transmission
              or storage is 100% secure, but we take reasonable steps to protect your information.
            </P>
          </Section>

          <Section number="6" title="Data Retention">
            <P>
              We retain your information for as long as your account is active, or as needed to fulfil orders and
              submissions, comply with our legal and tax obligations, resolve disputes, and enforce our agreements.
            </P>
          </Section>

          <Section number="7" title="Your Rights">
            <P>
              Depending on where you&apos;re located — including under South Africa&apos;s Protection of Personal
              Information Act (POPIA) and applicable data protection laws in the United States and United Kingdom —
              you may have the right to access, correct, or request deletion of your personal information. To
              exercise any of these rights, contact us using the details in Section 9.
            </P>
          </Section>

          <Section number="8" title="Children's Privacy">
            <P>
              Our services are not directed at children, and we do not knowingly collect personal information from
              anyone under the age of 18.
            </P>
          </Section>

          <Section number="9" title="Contact Us">
            <P>
              Questions about this Privacy Policy or your personal information should be sent to us at{' '}
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
