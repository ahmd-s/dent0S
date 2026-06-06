'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle2, AlertCircle, Loader2, FileText } from 'lucide-react'
import SignaturePad from '@/components/SignaturePad'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'

export default function ConsentSigningPage() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)
  const [signature, setSignature] = useState('')
  const [patientName, setPatientName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [signed, setSigned] = useState(false)

  useEffect(() => {
    loadConsent()
  }, [token])

  const loadConsent = async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/consent-requests/${token}`)
      if (r.status === 404) {
        setError('Consent request not found')
      } else if (r.status === 410) {
        setError('This consent request has expired')
      } else if (r.status === 409) {
        setError('This consent has already been signed')
      } else {
        const d = await r.json()
        setData(d)
        setPatientName(d.consent_request?.patient_name || '')
      }
    } catch (e) {
      setError('Failed to load consent form')
    }
    setLoading(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!signature) { alert('Please sign the form'); return }
    if (!patientName) { alert('Please enter your name'); return }
    if (!agreed) { alert('Please confirm you have read and understood the consent'); return }
    
    setSubmitting(true)
    try {
      const r = await fetch(`/api/consent-requests/${token}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature_image: signature, patient_name: patientName, agreed })
      })
      const d = await r.json()
      if (r.ok) {
        setSigned(true)
      } else {
        alert(d.error || 'Failed to submit signature')
      }
    } catch (e) {
      alert('Failed to submit signature')
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#0D9488]"/>
          <p className="mt-3 text-muted-foreground">Loading consent form...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-red-500"/>
          <h2 className="mt-4 text-xl font-semibold text-gray-900">Error</h2>
          <p className="mt-2 text-muted-foreground">{error}</p>
        </Card>
      </div>
    )
  }

  if (signed) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <CheckCircle2 className="w-16 h-16 mx-auto text-green-500"/>
          <h2 className="mt-4 text-2xl font-semibold text-gray-900">Thank You!</h2>
          <p className="mt-2 text-muted-foreground">Your consent has been successfully recorded.</p>
          <p className="mt-4 text-sm text-muted-foreground">You can close this page now.</p>
        </Card>
      </div>
    )
  }

  const clinic = data?.clinic || {}
  const template = data?.template || {}
  const consentRequest = data?.consent_request || {}

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-[#0D9488] text-white py-6 px-4">
        <div className="max-w-2xl mx-auto">
          {clinic.logo_url && (
            <img src={clinic.logo_url} alt={clinic.name} className="h-12 mb-2 object-contain"/>
          )}
          <h1 className="text-xl font-bold">{clinic.name || 'Dental Clinic'}</h1>
          {clinic.address && <p className="text-sm opacity-90 mt-1">{clinic.address}</p>}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto p-4 py-8">
        <Card className="p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-[#0D9488]"/>
            <h2 className="text-lg font-semibold">{template.name || 'Consent Form'}</h2>
          </div>
          <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-line leading-relaxed">
            {template.content || 'No content available'}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-4">Sign the Consent</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input 
                value={patientName} 
                onChange={e => setPatientName(e.target.value)}
                placeholder="Enter your full name as it appears on your ID"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input 
                value={new Date().toLocaleDateString()}
                disabled
                className="bg-gray-50"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Signature *</Label>
              <SignaturePad value={signature} onChange={setSignature} />
            </div>

            <div className="flex items-start gap-3">
              <Checkbox 
                id="agree" 
                checked={agreed}
                onCheckedChange={setAgreed}
                className="mt-1"
              />
              <label htmlFor="agree" className="text-sm text-gray-700 leading-relaxed cursor-pointer">
                I have read and understood the above consent form. I agree to the terms and conditions stated therein. I understand that this is an electronic signature that is legally binding.
              </label>
            </div>

            <Button 
              type="submit" 
              disabled={submitting || !signature || !patientName || !agreed}
              className="w-full bg-[#0D9488] hover:bg-[#0B7E73] h-12 text-base"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2"/>
                  Submitting...
                </>
              ) : (
                'Submit Consent'
              )}
            </Button>
          </form>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          By signing, you agree to the terms of this consent form.
        </p>
      </div>
    </div>
  )
}
