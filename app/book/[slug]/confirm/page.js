'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { CheckCircle2, Calendar, Clock, MapPin, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ToothIcon } from '@/components/dentos/Logo'

const fmtFull = d => { const x = new Date(d+'T00:00:00'); return x.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' }) }

function App() {
  const { slug } = useParams()
  const [info, setInfo] = useState(null)
  useEffect(() => {
    const raw = sessionStorage.getItem('dentos_booking')
    if (raw) try { setInfo(JSON.parse(raw)) } catch {}
  }, [])
  return (
    <div className="light min-h-screen bg-[#F8FAFC]">
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <CheckCircle2 className="w-16 h-16 mx-auto text-[#22C55E]"/>
          <h1 className="mt-4 text-2xl font-bold text-[#0F172A]">Appointment Requested!</h1>
          {info && (
            <div className="mt-6 p-5 bg-[#F8FAFC] rounded-lg border border-slate-200 text-left space-y-3">
              <div className="flex items-center gap-3 text-sm text-slate-900"><Calendar className="w-4 h-4 text-[#0D9488]"/><span>{fmtFull(info.date)}</span></div>
              <div className="flex items-center gap-3 text-sm text-slate-900"><Clock className="w-4 h-4 text-[#0D9488]"/><span>{info.time}</span></div>
              {info.doctor_name && <div className="flex items-center gap-3 text-sm text-slate-900"><span className="w-4 h-4 inline-flex items-center justify-center text-[#0D9488] font-bold">👨‍⚕️</span><span>Dr. {info.doctor_name}</span></div>}
              {info.clinic_name && <div className="flex items-center gap-3 text-sm text-slate-900"><MapPin className="w-4 h-4 text-[#0D9488]"/><span>{info.clinic_name}{info.clinic_city?`, ${info.clinic_city}`:''}</span></div>}
            </div>
          )}
          {info?.unmatched_note && (
            <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-md text-sm text-orange-800">
              Your appointment is confirmed. Please mention your previous visit details to our receptionist when you arrive — they will help match your records.
            </div>
          )}
          <p className="mt-6 text-sm text-slate-500">Our team will confirm your appointment shortly. If you don&apos;t hear from us within 2 hours, please call {info?.clinic_phone ? <a href={`tel:+91${info.clinic_phone}`} className="text-[#0D9488] underline">+91 {info.clinic_phone}</a> : 'the clinic'}.</p>
          <div className="mt-6 space-y-2">
            {info?.clinic_phone && <a href={`https://wa.me/91${info.clinic_phone}?text=Hi, I just booked an appointment via your DentOS booking page.`} target="_blank" rel="noreferrer" className="w-full inline-flex items-center justify-center gap-2 px-4 h-12 rounded-md bg-green-600 text-white hover:bg-green-700 font-medium"><MessageCircle className="w-5 h-5"/>Chat with us on WhatsApp</a>}
            <Link href={`/book/${slug}`} className="block text-sm text-[#0D9488] hover:underline">Book Another Appointment</Link>
          </div>
        </div>
        <div className="text-center text-xs text-slate-500 mt-6">Powered by <span className="text-[#0D9488] font-medium">DentOS</span></div>
      </div>
    </div>
  )
}
export default App
