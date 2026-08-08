'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronLeft, ChevronRight, Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DentosLogo, ToothIcon } from '@/components/dentos/Logo'
import ImageUpload from '@/components/dentos/ImageUpload'
import { toast } from 'sonner'

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const TIMES = (() => {
  const arr = []
  for (let h=6; h<=22; h++) for (let m=0;m<60;m+=30) {
    const hh = h%12===0?12:h%12, ap = h<12?'AM':'PM'
    arr.push(`${String(hh).padStart(2,'0')}:${String(m).padStart(2,'0')} ${ap}`)
  }
  return arr
})()

function App() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [clinic, setClinic] = useState({ name:'', address:'', city:'', phone:'', gstin:'', logo_url:'' })
  const [hours, setHours] = useState(DAYS.map(d => ({ day:d, open: d!=='Sun', start:'10:00 AM', end:'07:00 PM' })))
  const [team, setTeam] = useState([])
  const [staff, setStaff] = useState({ full_name:'', email:'', role:'doctor', password:'' })

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(async d => {
      if (d?.user) {
        if (d.is_platform_admin) {
          if (d.platform_session_active) router.push('/platform-admin')
          else {
            await fetch('/api/auth/logout', { method: 'POST' })
            router.push('/login')
          }
          return
        }
        setUser(d.user)
        setClinic(c => ({ ...c, name: d.clinic?.name || '', phone: d.clinic?.phone || '' }))
        if (d.clinic?.onboarding_complete) router.push('/dashboard')
      } else router.push('/login')
    })
  }, [router])

  const submitStep1 = async () => {
    if (!clinic.name || !clinic.address || !clinic.city || !clinic.phone) { toast.error('Fill all required fields'); return }
    setLoading(true)
    const r = await fetch('/api/onboarding/clinic', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(clinic) })
    setLoading(false)
    if (r.ok) setStep(2); else toast.error('Failed to save')
  }
  const submitStep2 = async () => {
    setLoading(true)
    const r = await fetch('/api/onboarding/hours', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ working_hours: hours }) })
    setLoading(false)
    if (r.ok) setStep(3); else toast.error('Failed to save')
  }
  const addStaff = async () => {
    if (!staff.full_name || !staff.email || !staff.password) { toast.error('Fill all staff fields'); return }
    if (staff.password.length < 8) { toast.error('Password min 8 chars'); return }
    const r = await fetch('/api/onboarding/team', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(staff) })
    const d = await r.json()
    if (!r.ok) { toast.error(d.error || 'Failed'); return }
    toast.success(`${staff.full_name} added to your clinic`)
    setTeam(t => [...t, { ...staff }])
    setStaff({ full_name:'', email:'', role:'doctor', password:'' })
  }
  const complete = async () => {
    setLoading(true)
    const r = await fetch('/api/onboarding/complete', { method:'POST' })
    setLoading(false)
    if (r.ok) router.push('/dashboard')
    else toast.error('Failed')
  }

  if (!user) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]"/></div>

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex justify-center mb-8"><DentosLogo /></div>
        <div className="flex items-center justify-center gap-2 mb-10">
          {[1,2,3].map(s => (
            <div key={s} className="flex items-center">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium border-2 ${step>=s?'bg-[#0D9488] border-[#0D9488] text-white':'bg-card border-border text-muted-foreground'}`}>
                {step>s ? <Check className="w-4 h-4"/> : s}
              </div>
              {s<3 && <div className={`w-16 h-0.5 ${step>s?'bg-[#0D9488]':'bg-border'}`}/>}
            </div>
          ))}
        </div>

        <div className="bg-card text-card-foreground rounded-lg border border-border p-8 shadow-sm">
          {step===1 && (
            <>
              <h2 className="text-2xl font-bold text-foreground">Tell us about your clinic</h2>
              <p className="text-muted-foreground text-sm mt-1">This appears on invoices and patient records.</p>
              <div className="mt-6 space-y-4">
                <div className="space-y-1.5"><Label>Clinic Name</Label><Input value={clinic.name} onChange={e=>setClinic({...clinic,name:e.target.value})} /></div>
                <div className="space-y-1.5"><Label>Full Address</Label><Textarea rows={3} value={clinic.address} onChange={e=>setClinic({...clinic,address:e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>City</Label><Input value={clinic.city} onChange={e=>setClinic({...clinic,city:e.target.value})} /></div>
                  <div className="space-y-1.5"><Label>Clinic Phone</Label><Input value={clinic.phone} onChange={e=>setClinic({...clinic,phone:e.target.value})} /></div>
                </div>
                <div className="space-y-1.5"><Label>GST Number <span className="text-muted-foreground text-xs">(optional)</span></Label><Input value={clinic.gstin} onChange={e=>setClinic({...clinic,gstin:e.target.value})} /></div>
                <div className="space-y-1.5">
                  <Label>Clinic Logo <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <ImageUpload
                    value={clinic.logo_url}
                    onChange={url => setClinic({ ...clinic, logo_url: url })}
                    uploadUrl="/api/clinic/logo"
                    fallback={<ToothIcon className="w-8 h-8 text-white" />}
                    helperText="JPG, PNG or WEBP. Max 5MB."
                  />
                </div>
              </div>
              <div className="mt-8 flex justify-end">
                <Button onClick={submitStep1} disabled={loading} className="bg-[#0D9488] hover:bg-[#0B7E73]">Continue {loading?<Loader2 className="w-4 h-4 animate-spin ml-2"/>:<ChevronRight className="w-4 h-4 ml-1"/>}</Button>
              </div>
            </>
          )}
          {step===2 && (
            <>
              <h2 className="text-2xl font-bold text-foreground">When is your clinic open?</h2>
              <p className="text-muted-foreground text-sm mt-1">Set default working hours.</p>
              <div className="mt-6 space-y-3">
                {hours.map((h,i) => (
                  <div key={h.day} className="flex items-center gap-4 py-2 border-b border-border last:border-0">
                    <div className="w-12 font-medium">{h.day}</div>
                    <div className="flex items-center gap-2 w-28">
                      <Switch checked={h.open} onCheckedChange={v => setHours(p => p.map((x,j)=>j===i?{...x,open:v}:x))} />
                      <span className="text-sm text-muted-foreground">{h.open?'Open':'Closed'}</span>
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <Select value={h.start} disabled={!h.open} onValueChange={v=>setHours(p=>p.map((x,j)=>j===i?{...x,start:v}:x))}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>{TIMES.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                      <Select value={h.end} disabled={!h.open} onValueChange={v=>setHours(p=>p.map((x,j)=>j===i?{...x,end:v}:x))}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>{TIMES.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 flex justify-between">
                <Button variant="outline" onClick={()=>setStep(1)}><ChevronLeft className="w-4 h-4 mr-1"/>Back</Button>
                <Button onClick={submitStep2} disabled={loading} className="bg-[#0D9488] hover:bg-[#0B7E73]">Continue<ChevronRight className="w-4 h-4 ml-1"/></Button>
              </div>
            </>
          )}
          {step===3 && (
            <>
              <h2 className="text-2xl font-bold text-foreground">Add your team <span className="text-muted-foreground font-normal text-base">(optional)</span></h2>
              <p className="text-muted-foreground text-sm mt-1">You can always add more people later from Settings.</p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Full Name</Label><Input value={staff.full_name} onChange={e=>setStaff({...staff,full_name:e.target.value})}/></div>
                <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={staff.email} onChange={e=>setStaff({...staff,email:e.target.value})}/></div>
                <div className="space-y-1.5"><Label>Role</Label>
                  <Select value={staff.role} onValueChange={v=>setStaff({...staff,role:v})}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="doctor">Doctor</SelectItem>
                      <SelectItem value="receptionist">Receptionist</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Temp Password</Label><Input type="password" value={staff.password} onChange={e=>setStaff({...staff,password:e.target.value})}/></div>
              </div>
              <Button variant="outline" onClick={addStaff} className="mt-4 w-full border-dashed"><Plus className="w-4 h-4 mr-2"/>Add Team Member</Button>
              {team.length>0 && <div className="mt-5 space-y-2">
                {team.map((t,i)=>(
                  <div key={i} className="flex items-center justify-between bg-muted rounded-md p-3">
                    <div><div className="font-medium text-sm">{t.full_name}</div><div className="text-xs text-muted-foreground">{t.email} • {t.role}</div></div>
                    <span className="text-xs text-success">Added</span>
                  </div>
                ))}
              </div>}
              <div className="mt-8 flex justify-between items-center">
                <Button variant="outline" onClick={()=>setStep(2)}><ChevronLeft className="w-4 h-4 mr-1"/>Back</Button>
                <div className="flex items-center gap-3">
                  <button onClick={complete} className="text-sm text-muted-foreground hover:text-foreground">Skip for now →</button>
                  <Button onClick={complete} disabled={loading} className="bg-[#0D9488] hover:bg-[#0B7E73]">Complete Setup{loading?<Loader2 className="w-4 h-4 animate-spin ml-2"/>:<ChevronRight className="w-4 h-4 ml-1"/>}</Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
