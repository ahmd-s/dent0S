'use client'
// Path: app/book/[slug]/page.js
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  MapPin, Phone, Loader2, Calendar, User,
  ChevronRight, Search, UserPlus, CheckCircle2, X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ClinicLogo } from '@/components/dentos/Logo'
import { toast } from 'sonner'

const todayIso = () => new Date().toISOString().slice(0, 10)
const fmtFull = d => {
  const x = new Date(d + 'T00:00:00')
  return x.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Step indicator ─────────────────────────────────────────────────────────
const STEPS = ['Doctor', 'Patient', 'Appointment']
function StepBar({ current }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((label, i) => {
        const idx = i + 1
        const done = current > idx
        const active = current === idx
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors ${
                done ? 'bg-[#0D9488] border-[#0D9488] text-white'
                  : active ? 'border-[#0D9488] text-[#0D9488] bg-white'
                  : 'border-slate-200 text-slate-400 bg-white'
              }`}>
                {done ? <CheckCircle2 className="w-4 h-4" /> : idx}
              </div>
              <span className={`mt-1 text-xs font-medium ${active ? 'text-[#0D9488]' : done ? 'text-[#0D9488]' : 'text-slate-400'}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-16 h-0.5 mb-4 mx-1 ${current > idx ? 'bg-[#0D9488]' : 'bg-slate-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function BookingPage() {
  const { slug } = useParams()
  const router = useRouter()

  const [clinic, setClinic] = useState(null)
  const [doctors, setDoctors] = useState([])
  const [notFound, setNotFound] = useState(false)

  // Step 1 – doctor
  const [doctor, setDoctor] = useState('')

  // Step 2 – patient
  const [phone, setPhone] = useState('')
  const [phoneSearch, setPhoneSearch] = useState([])   // matched patients
  const [searchState, setSearchState] = useState('idle') // idle | searching | done
  const [selectedPatient, setSelectedPatient] = useState(null) // chosen patient obj
  const [showNewForm, setShowNewForm] = useState(false)
  const [newPatient, setNewPatient] = useState({ name: '', age: '', gender: '' })
  const [creatingPatient, setCreatingPatient] = useState(false)
  const searchTimer = useRef(null)

  // Step 3 – appointment
  const [date, setDate] = useState(todayIso())
  const [slots, setSlots] = useState([])
  const [time, setTime] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  // Which step are we on (1, 2, 3)
  const step = !doctor ? 1 : !selectedPatient ? 2 : 3

  // ── Load clinic ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/public/clinic/${slug}`)
      .then(r => { if (r.status === 404) setNotFound(true); return r.json() })
      .then(d => {
        if (d?.clinic) {
          setClinic(d.clinic)
          setDoctors(d.doctors || [])
          if (d.doctors?.length === 1) setDoctor(d.doctors[0].id)
        }
      })
  }, [slug])

  // ── Load slots when doctor / date changes ────────────────────────────────
  useEffect(() => {
    if (!clinic || !doctor) return
    const params = new URLSearchParams({ date, doctor_id: doctor })
    fetch(`/api/public/clinic/${slug}/slots?` + params)
      .then(r => r.json())
      .then(d => setSlots(d.slots || []))
    setTime('')
  }, [clinic, date, doctor, slug])

  // ── Phone search (debounced 400 ms) ──────────────────────────────────────
  useEffect(() => {
    if (phone.length < 5) {
      setPhoneSearch([])
      setSearchState('idle')
      setSelectedPatient(null)
      setShowNewForm(false)
      return
    }
    setSearchState('searching')
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/public/clinic/${slug}/patient-search?phone=${encodeURIComponent(phone)}`)
        const d = await r.json()
        setPhoneSearch(d.patients || [])
        setSearchState('done')
      } catch {
        setSearchState('done')
        setPhoneSearch([])
      }
    }, 400)
    return () => clearTimeout(searchTimer.current)
  }, [phone, slug])

  // ── Select existing patient ───────────────────────────────────────────────
  const selectPatient = (p) => {
    setSelectedPatient(p)
    setShowNewForm(false)
  }

  const clearPatient = () => {
    setSelectedPatient(null)
    setShowNewForm(false)
    setPhone('')
    setPhoneSearch([])
    setSearchState('idle')
  }

  // ── Create new patient ────────────────────────────────────────────────────
  const createPatient = async () => {
    if (!newPatient.name.trim()) { toast.error('Full name is required'); return }
    if (!/^\d{10}$/.test(phone)) { toast.error('Phone must be 10 digits'); return }
    setCreatingPatient(true)
    try {
      const r = await fetch(`/api/public/clinic/${slug}/patient-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPatient.name.trim(), phone, age: newPatient.age || null, gender: newPatient.gender || '' })
      })
      const d = await r.json()
      if (!r.ok) { toast.error(d.error || 'Could not create patient'); return }
      // Backend returns existing patient if phone already exists — either way, use what's returned
      setSelectedPatient(d.patient)
      setShowNewForm(false)
      toast.success(d.existing ? 'Found your existing record!' : 'Patient created')
    } catch {
      toast.error('Network error — please try again')
    } finally {
      setCreatingPatient(false)
    }
  }

  // ── Book appointment ──────────────────────────────────────────────────────
  const submit = async () => {
    if (!selectedPatient?.id) { toast.error('No patient selected'); return }
    if (!doctor) { toast.error('Select a doctor'); return }
    if (!time) { toast.error('Select a time slot'); return }
    setBusy(true)
    try {
      const r = await fetch(`/api/public/clinic/${slug}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: selectedPatient.id,
          doctor_id: doctor,
          appointment_date: date,
          appointment_time: time,
          reason: reason.trim()
        })
      })
      const d = await r.json()
      if (!r.ok) { toast.error(d.error || 'Could not book'); return }
      sessionStorage.setItem('dentos_booking', JSON.stringify({
        ...d, date, time,
        doctor_name: d.doctor_name,
        name: selectedPatient.name,
        clinic_phone: clinic.phone,
        clinic_name: clinic.name,
        clinic_city: clinic.city
      }))
      router.push(`/book/${slug}/confirm`)
    } catch {
      toast.error('Network error — please try again')
    } finally {
      setBusy(false)
    }
  }

  // ── Early returns ─────────────────────────────────────────────────────────
  if (notFound) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[#0F172A]">Clinic not found</h1>
        <p className="text-muted-foreground mt-2">This booking link is invalid.</p>
      </div>
    </div>
  )
  if (!clinic) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-[#0D9488]" />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-xl mx-auto px-4 py-8">

        {/* Clinic header */}
        <div className="text-center mb-8">
          <div className="inline-flex mx-auto">
            <ClinicLogo logoUrl={clinic.logo_url} size="w-16 h-16" iconSize="w-8 h-8" rounded="rounded-2xl" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-[#0F172A]">{clinic.name}</h1>
          <div className="mt-2 text-sm text-muted-foreground flex items-center justify-center gap-3 flex-wrap">
            {clinic.city && <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{clinic.city}</span>}
            {clinic.phone && (
              <a href={`tel:+91${clinic.phone}`} className="inline-flex items-center gap-1 text-[#0D9488] hover:underline">
                <Phone className="w-3.5 h-3.5" />+91 {clinic.phone}
              </a>
            )}
          </div>
        </div>

        <StepBar current={step} />

        {/* ── STEP 1: Doctor ──────────────────────────────────────────────── */}
        <div className={`bg-white rounded-xl border border-border p-6 mb-4 transition-opacity ${step !== 1 ? 'opacity-60' : ''}`}>
          <h2 className="text-base font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#0D9488] text-white text-xs flex items-center justify-center font-bold">1</span>
            Select Doctor
          </h2>
          {doctors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No doctors listed for this clinic.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {doctors.map(d => (
                <button
                  key={d.id}
                  onClick={() => { setDoctor(d.id); setSelectedPatient(null); setPhone(''); setPhoneSearch([]); setSearchState('idle') }}
                  className={`p-3 rounded-lg border text-left transition ${doctor === d.id ? 'border-[#0D9488] bg-[#0D9488]/5' : 'bg-white border-border hover:border-[#0D9488]/50'}`}
                >
                  <div className="w-10 h-10 rounded-full bg-[#0D9488]/10 flex items-center justify-center text-sm font-semibold text-[#0D9488]">
                    {d.full_name?.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="mt-2 font-medium text-sm">Dr. {d.full_name}</div>
                  {d.specialization && <div className="text-xs text-muted-foreground">{d.specialization}</div>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── STEP 2: Patient ─────────────────────────────────────────────── */}
        {doctor && (
          <div className="bg-white rounded-xl border border-border p-6 mb-4">
            <h2 className="text-base font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#0D9488] text-white text-xs flex items-center justify-center font-bold">2</span>
              Find or Add Patient
            </h2>

            {/* Already selected — show summary + change button */}
            {selectedPatient ? (
              <div className="flex items-center justify-between p-4 rounded-lg bg-[#0D9488]/5 border border-[#0D9488]/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#0D9488]/20 flex items-center justify-center text-sm font-bold text-[#0D9488]">
                    {selectedPatient.name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-[#0F172A] text-sm">{selectedPatient.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {selectedPatient.patient_code && <span className="mr-2">{selectedPatient.patient_code}</span>}
                      +91 {selectedPatient.phone}
                    </div>
                  </div>
                </div>
                <button onClick={clearPatient} className="text-muted-foreground hover:text-[#EF4444] transition">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                {/* Phone search input */}
                <div className="space-y-1.5">
                  <Label>Mobile Number</Label>
                  <div className="flex">
                    <span className="px-3 flex items-center bg-muted border border-r-0 border-input rounded-l-md text-sm text-muted-foreground">+91</span>
                    <div className="relative flex-1">
                      <Input
                        value={phone}
                        onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="Enter mobile number to search"
                        className="rounded-l-none pr-9"
                        autoComplete="off"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {searchState === 'searching'
                          ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          : phone
                          ? <Search className="w-4 h-4 text-muted-foreground" />
                          : null}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">We'll look up existing patient records as you type.</p>
                </div>

                {/* Search results */}
                {searchState === 'done' && phone.length >= 5 && (
                  <div className="mt-3 space-y-2">
                    {phoneSearch.length > 0 ? (
                      <>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          {phoneSearch.length} patient{phoneSearch.length > 1 ? 's' : ''} found
                        </p>
                        {phoneSearch.map(p => (
                          <button
                            key={p.id}
                            onClick={() => selectPatient(p)}
                            className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-[#0D9488] hover:bg-[#0D9488]/5 transition text-left"
                          >
                            <div className="w-9 h-9 rounded-full bg-[#0D9488]/10 flex items-center justify-center text-sm font-bold text-[#0D9488] shrink-0">
                              {p.name?.[0]?.toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm text-[#0F172A]">{p.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {p.patient_code && <span className="mr-2 font-mono">{p.patient_code}</span>}
                                +91 {p.phone}
                                {p.age && <span className="ml-2">{p.age} yrs</span>}
                                {p.gender && <span className="ml-2 capitalize">{p.gender}</span>}
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                          </button>
                        ))}
                        <p className="text-xs text-muted-foreground pt-1">
                          Not the right patient?{' '}
                          <button className="text-[#0D9488] underline underline-offset-2" onClick={() => { setShowNewForm(true); setPhoneSearch([]) }}>
                            Add new patient instead
                          </button>
                        </p>
                      </>
                    ) : (
                      <div className="p-4 rounded-lg border border-dashed border-slate-200 text-center">
                        <User className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No patient found with this number.</p>
                        {!showNewForm && (
                          <button
                            onClick={() => setShowNewForm(true)}
                            className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#0D9488] text-white text-sm font-medium hover:bg-[#0B7E73] transition"
                          >
                            <UserPlus className="w-4 h-4" /> Add New Patient
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* New patient mini-form */}
                {showNewForm && (
                  <div className="mt-4 p-4 rounded-lg border border-[#0D9488]/30 bg-[#0D9488]/5 space-y-3">
                    <p className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-[#0D9488]" /> New Patient Details
                    </p>
                    <div className="space-y-1.5">
                      <Label>Full Name <span className="text-[#EF4444]">*</span></Label>
                      <Input
                        value={newPatient.name}
                        onChange={e => setNewPatient({ ...newPatient, name: e.target.value })}
                        placeholder="Enter patient's full name"
                        autoFocus
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Age</Label>
                        <Input
                          type="number"
                          min="0"
                          max="120"
                          value={newPatient.age}
                          onChange={e => setNewPatient({ ...newPatient, age: e.target.value })}
                          placeholder="e.g. 32"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Gender</Label>
                        <select
                          value={newPatient.gender}
                          onChange={e => setNewPatient({ ...newPatient, gender: e.target.value })}
                          className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488] focus:ring-offset-1"
                        >
                          <option value="">Select</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => { setShowNewForm(false); setNewPatient({ name: '', age: '', gender: '' }) }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        disabled={creatingPatient || !newPatient.name.trim() || phone.length < 10}
                        onClick={createPatient}
                        className="flex-1 bg-[#0D9488] hover:bg-[#0B7E73]"
                      >
                        {creatingPatient ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Patient'}
                      </Button>
                    </div>
                    {phone.length < 10 && (
                      <p className="text-xs text-amber-600">Please enter a complete 10-digit number above first.</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── STEP 3: Appointment ─────────────────────────────────────────── */}
        {doctor && selectedPatient && (
          <div className="bg-white rounded-xl border border-border p-6 space-y-5">
            <h2 className="text-base font-semibold text-[#0F172A] flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#0D9488] text-white text-xs flex items-center justify-center font-bold">3</span>
              Pick a Date &amp; Time
            </h2>

            {/* Date */}
            <div>
              <Label className="text-sm font-medium">Select Date</Label>
              <Input type="date" min={todayIso()} value={date} onChange={e => setDate(e.target.value)} className="mt-1.5" />
              <div className="text-xs text-muted-foreground mt-1">{fmtFull(date)}</div>
            </div>

            {/* Slots */}
            <div>
              <Label className="text-sm font-medium">Select Time</Label>
              {slots.length === 0 && (
                <div className="mt-2 text-sm text-muted-foreground">Clinic is closed on this day. Choose another date.</div>
              )}
              <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 gap-2">
                {slots.map(s => (
                  <button
                    key={s.time}
                    type="button"
                    disabled={s.taken}
                    onClick={() => setTime(s.time)}
                    className={`px-3 py-2 rounded-md text-sm border transition ${
                      s.taken
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'
                        : time === s.time
                        ? 'bg-[#0D9488] text-white border-[#0D9488]'
                        : 'bg-white border-border hover:border-[#0D9488] hover:text-[#0D9488]'
                    }`}
                  >
                    {s.time}
                  </button>
                ))}
              </div>
            </div>

            {/* Reason */}
            <div className="pt-2 border-t border-border">
              <Label className="text-sm font-medium">Reason for Visit</Label>
              <Textarea
                rows={2}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. Toothache, cleaning, consultation"
                className="mt-1.5"
              />
            </div>

            <p className="text-xs text-muted-foreground">We'll confirm your appointment via call or WhatsApp.</p>

            <Button
              type="button"
              disabled={busy || !time}
              onClick={submit}
              className="w-full bg-[#0D9488] hover:bg-[#0B7E73] h-12 text-base"
            >
              {busy
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : <>Book Appointment <ChevronRight className="w-5 h-5 ml-1" /></>}
            </Button>
          </div>
        )}

        <div className="text-center text-xs text-muted-foreground mt-6">
          Powered by <span className="text-[#0D9488] font-medium">DentOS</span>
        </div>
      </div>
    </div>
  )
}
