'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MapPin, Phone, Loader2, Calendar, Clock, User, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ToothIcon } from '@/components/dentos/Logo'
import { toast } from 'sonner'

const todayIso = () => new Date().toISOString().slice(0,10)
const fmtFull = d => { const x = new Date(d+'T00:00:00'); return x.toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', year:'numeric' }) }

function App() {
  const { slug } = useParams()
  const router = useRouter()
  const [clinic, setClinic] = useState(null)
  const [doctors, setDoctors] = useState([])
  const [doctor, setDoctor] = useState('')
  const [date, setDate] = useState(todayIso())
  const [slots, setSlots] = useState([])
  const [time, setTime] = useState('')
  const [f, setF] = useState({ name:'', phone:'', reason:'' })
  const [busy, setBusy] = useState(false)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetch(`/api/public/clinic/${slug}`).then(r => { if (r.status===404) setNotFound(true); return r.json() }).then(d => {
      if (d?.clinic) { setClinic(d.clinic); setDoctors(d.doctors||[]); if (d.doctors?.length===1) setDoctor(d.doctors[0].id) }
    })
  }, [slug])
  useEffect(() => {
    if (!clinic) return
    const params = new URLSearchParams({ date }); if (doctor) params.set('doctor_id', doctor)
    fetch(`/api/public/clinic/${slug}/slots?` + params).then(r=>r.json()).then(d => setSlots(d.slots||[]))
    setTime('')
  }, [clinic, date, doctor, slug])

  if (notFound) return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]"><div className="text-center"><h1 className="text-2xl font-bold text-[#0F172A]">Clinic not found</h1><p className="text-muted-foreground mt-2">This booking link is invalid.</p></div></div>
  if (!clinic) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]"/></div>

  const submit = async e => {
    e.preventDefault()
    if (!f.name || !f.phone || !time) { toast.error('Please fill all required fields'); return }
    if (!/^\d{10}$/.test(f.phone)) { toast.error('Phone must be 10 digits'); return }
    if (!doctor && doctors.length>0) { toast.error('Select a doctor'); return }
    setBusy(true)
    const r = await fetch(`/api/public/clinic/${slug}/book`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ name: f.name, phone: f.phone, reason: f.reason, doctor_id: doctor || null, appointment_date: date, appointment_time: time })
    })
    const d = await r.json()
    setBusy(false)
    if (!r.ok) { toast.error(d.error || 'Could not book'); return }
    sessionStorage.setItem('dentos_booking', JSON.stringify({ ...d, date, time, doctor_name: d.doctor_name, name: f.name }))
    router.push(`/book/${slug}/confirm`)
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-xl mx-auto px-4 py-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#0D9488] mx-auto">{clinic.logo_url ? <img src={clinic.logo_url} alt="" className="w-full h-full rounded-2xl object-cover"/> : <ToothIcon className="w-8 h-8 text-white"/>}</div>
          <h1 className="mt-4 text-2xl font-bold text-[#0F172A]">{clinic.name}</h1>
          <div className="mt-2 text-sm text-muted-foreground flex items-center justify-center gap-3 flex-wrap">
            {clinic.city && <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5"/>{clinic.city}</span>}
            {clinic.phone && <a href={`tel:+91${clinic.phone}`} className="inline-flex items-center gap-1 text-[#0D9488] hover:underline"><Phone className="w-3.5 h-3.5"/>+91 {clinic.phone}</a>}
          </div>
        </div>

        {doctors.length>0 && (
          <div className="mt-8">
            <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">Our Doctors</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {doctors.map(d => (
                <button key={d.id} onClick={()=>setDoctor(d.id)} className={`p-3 rounded-lg border text-left transition ${doctor===d.id?'border-[#0D9488] bg-[#0D9488]/5':'bg-white border-border hover:border-[#0D9488]/50'}`}>
                  <div className="w-10 h-10 rounded-full bg-[#0D9488]/10 flex items-center justify-center text-sm font-semibold text-[#0D9488]">{d.full_name?.split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase()}</div>
                  <div className="mt-2 font-medium text-sm">Dr. {d.full_name}</div>
                  {d.specialization && <div className="text-xs text-muted-foreground">{d.specialization}</div>}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={submit} className="mt-8 bg-white rounded-lg border border-border p-6 space-y-5">
          <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-2"><Calendar className="w-5 h-5 text-[#0D9488]"/>Book an Appointment</h2>
          <div>
            <Label className="text-sm font-medium">Select Date</Label>
            <Input type="date" min={todayIso()} value={date} onChange={e=>setDate(e.target.value)} className="mt-1.5"/>
            <div className="text-xs text-muted-foreground mt-1">{fmtFull(date)}</div>
          </div>
          <div>
            <Label className="text-sm font-medium">Select Time</Label>
            {slots.length === 0 && <div className="mt-2 text-sm text-muted-foreground">Clinic is closed on this day. Choose another date.</div>}
            <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 gap-2">
              {slots.map(s => (
                <button key={s.time} type="button" disabled={s.taken} onClick={()=>setTime(s.time)}
                  className={`px-3 py-2 rounded-md text-sm border transition ${s.taken?'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200':time===s.time?'bg-[#0D9488] text-white border-[#0D9488]':'bg-white border-border hover:border-[#0D9488] hover:text-[#0D9488]'}`}>
                  {s.time}
                </button>
              ))}
            </div>
          </div>
          <div className="pt-4 border-t border-border space-y-3">
            <h3 className="text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2"><User className="w-3.5 h-3.5"/>Your Details</h3>
            <div className="space-y-1.5"><Label>Full Name *</Label><Input value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></div>
            <div className="space-y-1.5"><Label>Mobile Number *</Label>
              <div className="flex"><span className="px-3 flex items-center bg-muted border border-r-0 border-input rounded-l-md text-sm text-muted-foreground">+91</span>
                <Input value={f.phone} onChange={e=>setF({...f,phone:e.target.value.replace(/\D/g,'').slice(0,10)})} className="rounded-l-none" placeholder="9876543210"/></div></div>
            <div className="space-y-1.5"><Label>Reason for Visit</Label><Textarea rows={2} value={f.reason} onChange={e=>setF({...f,reason:e.target.value})} placeholder="e.g. Toothache, cleaning, consultation"/></div>
          </div>
          <p className="text-xs text-muted-foreground">We&apos;ll confirm your appointment via call or WhatsApp.</p>
          <Button type="submit" disabled={busy || !time} className="w-full bg-[#0D9488] hover:bg-[#0B7E73] h-12 text-base">{busy?<Loader2 className="w-5 h-5 animate-spin"/>:<>Book Appointment <ChevronRight className="w-5 h-5 ml-1"/></>}</Button>
        </form>
        <div className="text-center text-xs text-muted-foreground mt-6">Powered by <span className="text-[#0D9488] font-medium">DentOS</span></div>
      </div>
    </div>
  )
}
export default App
