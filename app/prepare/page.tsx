import Link from 'next/link'

interface StepItem {
  label: string
  body: string
}

interface Step {
  number: string
  title: string
  items: StepItem[]
}

const STEPS: Step[] = [
  {
    number: '1',
    title: 'Sleeve and Secure',
    items: [
      {
        label: 'Penny Sleeves',
        body: 'Place each card upside down into a brand new, clean penny sleeve. This protects the surface from scratching.',
      },
      {
        label: 'Semi-Rigid Holders',
        body: 'Insert the sleeved card right-side up into a semi-rigid holder (such as a Card Saver 1). This creates a dust seal at the top.',
      },
      {
        label: 'Avoid Toploaders',
        body: 'Please do not ship cards in standard hard toploaders or magnetic one-touches. Cards can easily slide out during transit, and grading companies strongly prefer semi-rigid holders.',
      },
    ],
  },
  {
    number: '2',
    title: 'Organize Your Submission',
    items: [
      {
        label: 'Match the Packing Slip',
        body: 'Stack your cards in the exact order they appear on your Cuppa Cards digital packing slip.',
      },
      {
        label: 'Labeling',
        body: 'If you are submitting multiple orders, group them properly and label the outside of the protective bags.',
      },
    ],
  },
  {
    number: '3',
    title: 'The Cardboard Sandwich',
    items: [
      {
        label: 'Support',
        body: 'Place your stack of Card Savers between two pieces of sturdy, corrugated cardboard that are slightly larger than the holders.',
      },
      {
        label: 'Secure',
        body: "Bind the cardboard together using rubber bands (ensure they are not too tight to avoid bending the cards) or painter's tape. Never use packing tape or scotch tape anywhere near the cards.",
      },
    ],
  },
  {
    number: '4',
    title: 'Pack and Ship',
    items: [
      {
        label: 'Bubble Wrap',
        body: 'Wrap your secured cardboard sandwich in a generous layer of bubble wrap.',
      },
      {
        label: 'Box it Up',
        body: 'Place the bundle inside a sturdy cardboard shipping box. Fill any void space with packing paper or extra bubble wrap. If you shake the box, you should not feel the cards shifting inside.',
      },
    ],
  },
]

export default function PrepareCardsPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Hero */}
      <section className="relative pt-28 pb-16 md:pt-36 md:pb-20 overflow-hidden">
        <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
          <div className="inline-block mb-4 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-semibold text-emerald-400 tracking-wide">
            PACKING GUIDELINES
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600 mb-6 tracking-tight">
            How to Prepare Your Cards
          </h1>
          <p className="text-lg md:text-xl text-slate-300 leading-relaxed">
            Proper preparation ensures your Pokémon and Sports cards arrive at our facility in the exact condition
            you sent them. Please follow these industry-standard packing guidelines before shipping your
            submission.
          </p>
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-amber-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />
      </section>

      {/* Steps */}
      <section className="py-16 md:py-20 bg-slate-950 border-y border-slate-800">
        <div className="max-w-3xl mx-auto px-6 space-y-10">
          {STEPS.map((step) => (
            <div
              key={step.number}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 hover:border-amber-500/50 transition duration-300"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 shrink-0 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center text-xl font-black">
                  {step.number}
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-white">{step.title}</h2>
              </div>
              <div className="space-y-4 pl-0 md:pl-16">
                {step.items.map((item) => (
                  <p key={item.label} className="text-slate-300 leading-relaxed">
                    <span className="font-semibold text-slate-100">{item.label}:</span> {item.body}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-24">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Need Supplies?</h2>
          <p className="text-slate-300 text-lg leading-relaxed mb-8">
            Grab our all-in-one Basic Submission Kit from the Accessories shop — it includes 100 Card Saver 1s,
            penny sleeves, bubble wrap, and a shipping box, everything you need in one order.
          </p>
          <Link
            href="/shop?category=accessories"
            className="inline-block bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-lg px-8 py-4 rounded-xl transition shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:shadow-[0_0_25px_rgba(245,158,11,0.4)]"
          >
            Shop the Basic Submission Kit
          </Link>
        </div>
      </section>
    </div>
  )
}
