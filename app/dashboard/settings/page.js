'use client'
import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
function App() {
  const [me, setMe] = useState(null)
  useEffect(() => { fetch('/api/auth/me').then(r=>r.json()).then(setMe) }, [])
  return <div className="p-8 max-w-3xl"><h1 className="text-2xl font-bold text-[#0F172A] mb-6">Settings</h1>
    <Card className="p-6 bg-white border-border rounded-lg">
      <h3 className="font-semibold mb-4">Clinic</h3>
      {me?.clinic && <dl className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
        {[['Name',me.clinic.name],['Slug',me.clinic.slug],['City',me.clinic.city],['Phone',me.clinic.phone],['Address',me.clinic.address],['GSTIN',me.clinic.gstin||'—'],['Plan',me.clinic.subscription_plan]].map(([k,v])=>(
          <div key={k}><dt className="text-muted-foreground text-xs">{k}</dt><dd className="font-medium text-[#0F172A]">{v||'—'}</dd></div>
        ))}
      </dl>}
    </Card>
  </div>
}
export default App
