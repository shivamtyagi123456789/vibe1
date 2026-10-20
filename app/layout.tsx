import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'),
  title: 'Vibes — Plug in. Sink in.',
  description: 'Explore a cinematic lo-fi room, a moonlit canal, a procedural Project City and an editorial Logbook, connected by hidden project portals.',
  generator: 'v0.app',
  openGraph: { title: 'Vibes — Plug in. Sink in.', description: 'A living lo-fi room. Three procedural stations, five skies, seven hidden worlds.', type: 'website', images: ['/images/vibes-social.png'] },
  twitter: { card: 'summary_large_image', title: 'Vibes — Plug in. Sink in.', images: ['/images/vibes-social.png'] },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0b0712',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
