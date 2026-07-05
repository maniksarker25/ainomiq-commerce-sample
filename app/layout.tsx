import type { Metadata } from 'next'
import { Inter, Poppins } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'

const inter = Inter({ subsets: ['latin'] })
const poppins = Poppins({ subsets: ['latin'], weight: ['300','400','500','600','700'], variable: '--font-poppins' })

export const metadata: Metadata = {
  title: 'Ainomiq Dashboard',
  description: 'Inventory and customer service dashboard for e-commerce',
  icons: {
    icon: [{ url: '/favicon.png?v=20260513', sizes: '512x512', type: 'image/png' }],
    shortcut: [{ url: '/favicon.ico?v=20260513', sizes: '32x32', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png?v=20260513', sizes: '180x180', type: 'image/png' }],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className + " " + poppins.variable}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
