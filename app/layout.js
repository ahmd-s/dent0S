import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/theme-provider'

/**
 * Self-hosted at build time. globals.css previously started with
 * `@import url('https://fonts.googleapis.com/...')`, which serialises three
 * blocking round-trips before any text can paint: globals.css, then Google's
 * stylesheet, then the font files on a third origin. Serving the font from our
 * own origin removes two of them and the third-party dependency.
 */
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata = {
  title: {
    default: 'DentOS — The Clinic OS for Modern Dentists',
    template: '%s · DentOS',
  },
  description: 'Multi-tenant dental clinic management for modern practices in India. Patients, appointments, billing, lab, inventory, AI, and more.',
  applicationName: 'DentOS',
  keywords: ['dental clinic software', 'clinic management', 'DentOS', 'India'],
  authors: [{ name: 'DentOS' }],
  creator: 'DentOS',
  robots: { index: false, follow: false },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  )
}
