import type { Metadata, Viewport } from 'next'
import { Providers } from '@/components/Providers'
import { EmulatorToasts } from '@/components/emulator/EmulatorToasts'
import './globals.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  title: 'Ayala Land Collections Portal',
  description: 'Collections & Payments Management System',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased overflow-x-hidden">
        <Providers>
          {children}
          <EmulatorToasts />
        </Providers>
      </body>
    </html>
  )
}
