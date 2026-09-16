import { LegalPageLayout, Section, P, Bullets } from '@/components/legal/legal-page'

const LAST_UPDATED = '16/09/2026'

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated={LAST_UPDATED}>
      <Section number="1" title="Introduction">
        <P>
          Cuppa&apos;s Cards SA is committed to protecting your privacy in compliance with the Protection of Personal
          Information Act (POPIA). This policy explains how we collect, use, and safeguard your personal
          information.
        </P>
      </Section>

      <Section number="2" title="Information We Collect">
        <P>
          We collect personal information necessary to fulfill your orders and provide services. This includes your
          name, delivery address, email address, and phone number. Payment details are entered securely on
          Payfast&apos;s portal and are not stored on our servers.
        </P>
      </Section>

      <Section number="3" title="How We Use Your Information">
        <P>Your data is used strictly to:</P>
        <Bullets>
          <li>Process and deliver your orders.</li>
          <li>Communicate regarding your grading submissions and returns.</li>
          <li>Comply with legal and tax obligations.</li>
        </Bullets>
      </Section>

      <Section number="4" title="Third-Party Sharing">
        <P>
          We only share your information with trusted third parties required to operate our business, such as
          courier companies (for local deliveries and international grading shipments) and our payment gateway
          (Payfast). We do not sell your personal data.
        </P>
      </Section>

      <Section number="5" title="Your Rights">
        <P>
          Under POPIA, you have the right to request access to the personal information we hold about you, request
          corrections, or request deletion of your data. Contact us at{' '}
          <a href="mailto:mitchell@cuppascards.com" className="text-amber-400 hover:text-amber-300 transition">
            mitchell@cuppascards.com
          </a>{' '}
          to exercise these rights.
        </P>
      </Section>
    </LegalPageLayout>
  )
}
