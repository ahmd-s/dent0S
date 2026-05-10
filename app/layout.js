import './globals.css'
import { Toaster } from '@/components/ui/sonner'

export const metadata = {
  title: 'DentOS — The Clinic OS for Modern Dentists',
  description: 'Multi-tenant clinic management for small dental clinics in India.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  )
}
