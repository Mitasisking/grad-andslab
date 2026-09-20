import './globals.css'
import type { Metadata } from 'next'
import Navbar from '../components/Navbar'
import { Footer } from '../components/Footer'
import { siteConfig } from '../lib/site-config'

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
    <html lang="en">
      <body className="bg-slate-900 min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}