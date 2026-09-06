import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white selection:bg-amber-500 selection:text-slate-900">
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-block mb-4 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-semibold text-emerald-400 tracking-wide">
            OFFICIAL PCG SUBMISSION MIDDLEMAN
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600 mb-6 tracking-tight">
            Grade & Slab
          </h1>
          <p className="text-xl md:text-2xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            South Africa's premier middleman service for Premier Card Grading. We handle the international logistics, you get the grades.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/dashboard" 
              className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-lg px-8 py-4 rounded-xl transition shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:shadow-[0_0_25px_rgba(245,158,11,0.4)]"
            >
              Start a Submission
            </Link>
            <Link 
              href="/shop" 
              className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-white font-bold text-lg px-8 py-4 rounded-xl border border-slate-700 transition"
            >
              Browse the Shop
            </Link>
          </div>
        </div>
        
        {/* Background decorative glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-amber-500/5 rounded-full blur-3xl -z-10 pointer-events-none"></div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 bg-slate-950 border-y border-slate-800">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">The Easiest Way to Grade</h2>
            <p className="text-slate-400 max-w-xl mx-auto text-lg">
              Skip the international shipping headaches and customs paperwork. We manage the entire pipeline from Cape Town to PCG and back.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl hover:border-amber-500/50 transition duration-300 group">
              <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center text-xl font-black mb-6 group-hover:scale-110 transition duration-300">1</div>
              <h3 className="text-xl font-bold text-slate-100 mb-3">Submit Online</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Use our integrated TCGdex database to quickly search and add your cards to your digital queue. Choose your turnaround tier starting from just $19.95 per card.
              </p>
            </div>
            
            {/* Step 2 */}
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl hover:border-amber-500/50 transition duration-300 group">
              <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center text-xl font-black mb-6 group-hover:scale-110 transition duration-300">2</div>
              <h3 className="text-xl font-bold text-slate-100 mb-3">Secure Logistics</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Send your cards to our local hub. We meticulously prep, pack, and express ship your submissions via DHL with full fine-art insurance included.
              </p>
            </div>
            
            {/* Step 3 */}
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl hover:border-amber-500/50 transition duration-300 group">
              <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center text-xl font-black mb-6 group-hover:scale-110 transition duration-300">3</div>
              <h3 className="text-xl font-bold text-slate-100 mb-3">Slabs to Your Door</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Track your order's progress live on your dashboard. Once graded, we handle all import customs and deliver the pristine slabs right back to your address.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 py-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-500">
          <p>© {new Date().getFullYear()} Grade & Slab. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/vendor" className="hover:text-amber-400 transition">Vendor Inquiries</Link>
            <Link href="#" className="hover:text-amber-400 transition">Terms of Service</Link>
            <Link href="#" className="hover:text-amber-400 transition">Privacy Policy</Link>
            <a href="mailto:support@gradeandslab.co.za" className="hover:text-amber-400 transition">Contact Support</a>
          </div>
        </div>
      </footer>
    </div>
  )
}