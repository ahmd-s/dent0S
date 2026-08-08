'use client'
import { Check } from 'lucide-react'
import { DentosLogo } from './Logo'

export function AuthSplit({ children }) {
  return (
    <div className="min-h-screen flex">
      <div className="hidden md:flex md:w-2/5 bg-[#0D9488] text-white flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -left-20 w-96 h-96 rounded-full bg-white/5" />
        <div className="relative z-10">
          <DentosLogo dark />
        </div>
        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-3xl font-bold leading-tight">The clinic OS for modern dentists</h2>
            <p className="mt-3 text-white/80">Built for busy doctors and receptionists in India.</p>
          </div>
          <ul className="space-y-4">
            {[
              'Complete patient history in seconds',
              'Smart appointment queue management',
              'AI-powered visit summaries',
            ].map(t => (
              <li key={t} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center"><Check className="w-4 h-4" /></span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative z-10 text-sm text-white/60">© 2025 DentOS. Made in India.</div>
      </div>
      <div className="flex-1 flex flex-col min-h-screen bg-background text-foreground">
        <div className="md:hidden p-6 border-b border-border">
          <DentosLogo />
        </div>
        <div className="flex-1 flex items-center justify-center p-6 md:p-12">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>
      </div>
    </div>
  )
}
