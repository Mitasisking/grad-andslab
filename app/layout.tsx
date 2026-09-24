import './globals.css'
import type { Metadata } from 'next'
import { Fraunces } from 'next/font/google'
import Navbar from '../components/Navbar'
import { Footer } from '../components/Footer'
import { SubmissionBestPractices } from '../components/SubmissionBestPractices'
import { siteConfig } from '../lib/site-config'

// Brand guide (Stock photos/Cuppascards Logo and Colour Guide.pdf) specifies
// "Recoleta Regular" as the display font -- a paid Latinotype typeface with
// no free/Google Fonts distribution and no licensed font files present on
// this machine. Fraunces is a free, visually-close stand-in (warm, rounded
// serif with a similar display character) used here as --font-display until
// real Recoleta font files are supplied, at which point this becomes a
// next/font/local swap contained entirely to this file.
const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '600', '700', '900'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
})

export const metadata: Metadata = {
  title: `${siteConfig.name} | PCG Middleman Service`,
  description: 'Professional Pokémon card grading middleman service based in South Africa.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={fraunces.variable}>
      <body className="bg-slate-900 min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow">
          {children}
        </main>
        <SubmissionBestPractices />
        <Footer />
      </body>
    </html>
  )
}