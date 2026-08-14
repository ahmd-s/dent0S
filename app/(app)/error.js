'use client'

import { Button } from '@/components/ui/button'

export default function Error({ error, reset }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {error?.message || 'An unexpected error occurred. Your data is safe — try again.'}
      </p>
      <Button onClick={reset} className="mt-4 bg-[#0D9488] hover:bg-[#0B7E73]">
        Try again
      </Button>
    </div>
  )
}
