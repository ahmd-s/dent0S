import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/theme-provider'

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
    <html lang="en" suppressHydrationWarning>
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
