/**
 * The packing Do's and Don'ts shown to customers, in one place so every
 * surface says exactly the same thing: the site-wide Submission Best
 * Practices section above the footer (components/SubmissionBestPractices.tsx)
 * and the /prepare page's guide (components/PackagingGuidelines.tsx).
 *
 * Standing rule: packing guidance only ever recommends semi-rigid card
 * savers -- toploaders may appear only as a "don't".
 */
export type Practice = { lead: string; detail: string }

export const DO_ITEMS: Practice[] = [
  { lead: 'Include your order number:', detail: 'Always place a note with your order number inside your parcel.' },
  {
    lead: 'Use fresh protection:',
    detail: 'Place cards into clear, loose-fit penny sleeves and clean semi-rigid card savers.',
  },
  {
    lead: 'Maintain your sequence:',
    detail: 'Pack your cards in the exact order they appear on your digital submission queue.',
  },
  {
    lead: 'Check your details:',
    detail: 'Ensure your return shipping address is perfectly up to date on your account dashboard.',
  },
]

export const DONT_ITEMS: Practice[] = [
  { lead: 'Use Sellotape:', detail: 'Never use sticky tape to seal the tops of semi-rigid card savers.' },
  {
    lead: 'Use untracked shipping:',
    detail: 'Avoid the standard post office. Always use secure, tracked local options like Pudo or The Courier Guy.',
  },
  {
    lead: 'Use tight or coloured sleeves:',
    detail: 'Do not use tight-fit inner sleeves, ETB sleeves, or sleeves with coloured backs. Clear is required.',
  },
  {
    lead: 'Use rubber bands:',
    detail: 'Do not wrap your submission tightly in elastic bands, as this can permanently dent card edges.',
  },
]
