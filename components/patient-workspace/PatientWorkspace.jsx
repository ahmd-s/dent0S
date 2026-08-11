'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { useRole } from '@/components/dentos/RoleContext'
import { useWorkspace } from '@/components/workspace/useWorkspace'
import { ConsentFormsTab } from '@/components/dentos/ConsentFormsTab'
import { NewLabCaseDialog } from '@/components/dentos/NewLabCaseDialog'
import OutstandingBalanceModal from '@/components/dentos/OutstandingBalanceModal'
import PatientOverviewHeader from './PatientOverviewHeader'
import PatientClinicalSummary from './PatientClinicalSummary'
import PatientSmartActions from './PatientSmartActions'
import PatientTimelinePanel from './PatientTimelinePanel'
import PatientTreatmentWorkspace from './PatientTreatmentWorkspace'
import PatientToothChartPanel from './PatientToothChartPanel'
import PatientAIWorkspace from './PatientAIWorkspace'
import PatientDocumentsPanel from './PatientDocumentsPanel'
import PatientLabWorkspace from './PatientLabWorkspace'
import PatientFinancialSummary from './PatientFinancialSummary'
import PatientAppointmentsPanel from './PatientAppointmentsPanel'
import PatientFlowStatus from './PatientFlowStatus'
import PatientFollowupsPanel from './PatientFollowupsPanel'
import PatientInternalRemarks from './PatientInternalRemarks'
import PatientPrescriptionsPanel from './PatientPrescriptionsPanel'
import PatientInventoryPanel from './PatientInventoryPanel'
import LazyTabPanel from './LazyTabPanel'
import EditPatientModal from './EditPatientModal'
import BookForPatientModal from './BookForPatientModal'
import {
  deriveClinicalSummary,
  getVisiblePatientTabs,
  trackRecentPatient,
} from '@/lib/patient-clinical'

const TAB_STORAGE_KEY = 'dentos_patient_tab'

export default function PatientWorkspace({ patientId }) {
  const router = useRouter()
  const { canViewClinical, canEditClinical } = useRole()
  const {
    layoutClasses,
    isPatientSectionEditable,
    isPatientSectionReadonly,
    isPatientSectionEnabled,
  } = useWorkspace()

  const [patient, setPatient] = useState(null)
  const [visits, setVisits] = useState([])
  const [appointments, setAppointments] = useState([])
  const [labCases, setLabCases] = useState([])
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [editOpen, setEditOpen] = useState(false)
  const [bookOpen, setBookOpen] = useState(false)
  const [labOpen, setLabOpen] = useState(false)
  const [balanceModalOpen, setBalanceModalOpen] = useState(false)

  const canStartVisit = canEditClinical()
  const clinicalReadonly = isPatientSectionReadonly('clinical_notes') || !canEditClinical()

  const visibleTabs = useMemo(
    () => getVisiblePatientTabs(isPatientSectionEnabled),
    [isPatientSectionEnabled]
  )

  const clinical = useMemo(
    () => (patient ? deriveClinicalSummary(patient, visits) : null),
    [patient, visits]
  )

  const loadCore = async () => {
    const [pr, vr, ar] = await Promise.all([
      fetch(`/api/patients/${patientId}`),
      fetch(`/api/visits?patient_id=${patientId}`),
      fetch(`/api/appointments?patient_id=${patientId}`),
    ])
    if (pr.ok) {
      const p = (await pr.json()).patient
      setPatient(p)
      trackRecentPatient(patientId, p.name)
    }
    if (vr.ok) setVisits((await vr.json()).visits || [])
    if (ar.ok) setAppointments((await ar.json()).appointments || [])
  }

  const loadBalance = async () => {
    const r = await fetch(`/api/patients/outstanding-balance?patient_id=${patientId}`)
    if (r.ok) {
      const d = await r.json()
      setBalance(d.outstandingBalance || 0)
    }
  }

  const loadLabCases = async () => {
    const r = await fetch(`/api/lab-cases?patient_id=${patientId}`)
    if (r.ok) setLabCases((await r.json()).lab_cases || [])
  }

  const load = async () => {
    setLoading(true)
    await Promise.all([loadCore(), loadBalance()])
    setLoading(false)
  }

  useEffect(() => {
    if (!patientId) return
    load()
    const saved = localStorage.getItem(TAB_STORAGE_KEY)
    if (saved) setActiveTab(saved)
  }, [patientId])

  useEffect(() => {
    if (activeTab === 'lab' && labCases.length === 0) loadLabCases()
  }, [activeTab, labCases.length])

  const handleTabChange = v => {
    setActiveTab(v)
    localStorage.setItem(TAB_STORAGE_KEY, v)
  }

  const startWalkin = async () => {
    const r = await fetch('/api/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: patientId, chief_complaint: '' }),
    })
    const d = await r.json()
    if (r.ok) router.push(`/visits/${d.id}`)
    else toast.error(d.error || 'Failed')
  }

  const goToLatestVisit = () => {
    const vid = visits[0]?.id || clinical?.latest_visit_id
    if (vid) router.push(`/visits/${vid}`)
    else startWalkin()
  }

  if (loading || !patient) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[#0D9488]" />
      </div>
    )
  }

  const defaultTab = visibleTabs.find(t => t.id === activeTab)?.id || visibleTabs[0]?.id || 'overview'

  return (
    <div className={`max-w-7xl mx-auto space-y-4 ${layoutClasses}`}>
      <Link href="/patients" className="text-sm text-muted-foreground hover:text-[#0D9488] flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" />Back to Patients
      </Link>

      <PatientOverviewHeader
        patient={patient}
        appointments={appointments}
        clinical={clinical}
        balance={balance}
        onEdit={() => setEditOpen(true)}
        onBalanceClick={() => setBalanceModalOpen(true)}
        canEditProfile={isPatientSectionEditable('basic_info')}
      />

      <PatientSmartActions
        onBookAppointment={() => setBookOpen(true)}
        onNewVisit={startWalkin}
        onNewLab={() => setLabOpen(true)}
        onCollectPayment={() => setBalanceModalOpen(true)}
        onGenerateAI={() => handleTabChange('ai')}
        onNewPrescription={goToLatestVisit}
        canStartVisit={canStartVisit}
      />

      <Tabs value={defaultTab} onValueChange={handleTabChange}>
        <TabsList className="bg-muted flex-wrap h-auto gap-0.5 p-1">
          {visibleTabs.map(tab => (
            <TabsTrigger key={tab.id} value={tab.id} className="text-xs sm:text-sm">{tab.label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <PatientClinicalSummary clinical={clinical} readonly={clinicalReadonly} />
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <LazyTabPanel tabId="timeline" activeTab={defaultTab}>
            <PatientTimelinePanel patientId={patientId} />
          </LazyTabPanel>
        </TabsContent>

        <TabsContent value="treatment" className="mt-4">
          <LazyTabPanel tabId="treatment" activeTab={defaultTab}>
            <PatientTreatmentWorkspace visits={visits} onNewVisit={startWalkin} canStartVisit={canStartVisit} />
          </LazyTabPanel>
        </TabsContent>

        <TabsContent value="tooth_chart" className="mt-4">
          <LazyTabPanel tabId="tooth_chart" activeTab={defaultTab}>
            <PatientToothChartPanel
              patientId={patientId}
              readonly={isPatientSectionReadonly('tooth_chart') || !canEditClinical()}
            />
          </LazyTabPanel>
        </TabsContent>

        <TabsContent value="prescriptions" className="mt-4">
          <LazyTabPanel tabId="prescriptions" activeTab={defaultTab}>
            <PatientPrescriptionsPanel visits={visits} />
          </LazyTabPanel>
        </TabsContent>

        <TabsContent value="ai" className="mt-4">
          <LazyTabPanel tabId="ai" activeTab={defaultTab}>
            <PatientAIWorkspace
              patient={patient}
              visits={visits}
              onUpdated={load}
              readonly={isPatientSectionReadonly('ai_summary') || !canEditClinical()}
            />
          </LazyTabPanel>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <LazyTabPanel tabId="documents" activeTab={defaultTab}>
            <PatientDocumentsPanel
              patientId={patientId}
              readonly={isPatientSectionReadonly('documents') || !canEditClinical()}
            />
          </LazyTabPanel>
        </TabsContent>

        <TabsContent value="lab" className="mt-4">
          <LazyTabPanel tabId="lab" activeTab={defaultTab}>
            <PatientLabWorkspace
              patientId={patientId}
              labCases={labCases}
              activeTab={defaultTab}
              onNewLab={() => setLabOpen(true)}
              readonly={isPatientSectionReadonly('lab_reports') || !canEditClinical()}
            />
          </LazyTabPanel>
        </TabsContent>

        <TabsContent value="inventory" className="mt-4">
          <LazyTabPanel tabId="inventory" activeTab={defaultTab}>
            {isPatientSectionEnabled('inventory_usage') && (
              <PatientInventoryPanel
                patientId={patientId}
                readonly={isPatientSectionReadonly('inventory_usage') || !canViewClinical()}
              />
            )}
          </LazyTabPanel>
        </TabsContent>

        <TabsContent value="billing" className="mt-4">
          <LazyTabPanel tabId="billing" activeTab={defaultTab}>
            <PatientFinancialSummary
              patientId={patientId}
              readonly={isPatientSectionReadonly('billing') || isPatientSectionReadonly('payments')}
              onCollectPayment={() => setBalanceModalOpen(true)}
            />
          </LazyTabPanel>
        </TabsContent>

        <TabsContent value="appointments" className="mt-4 space-y-4">
          {isPatientSectionEnabled('appointment_flow') && (
            <PatientFlowStatus patientId={patientId} appointments={appointments} />
          )}
          <PatientAppointmentsPanel appointments={appointments} />
        </TabsContent>

        <TabsContent value="consents" className="mt-4">
          <LazyTabPanel tabId="consents" activeTab={defaultTab}>
            <ConsentFormsTab patientId={patientId} patientName={patient.name} patientPhone={patient.phone} />
          </LazyTabPanel>
        </TabsContent>

        <TabsContent value="followups" className="mt-4">
          <PatientFollowupsPanel patient={patient} />
        </TabsContent>

        <TabsContent value="remarks" className="mt-4">
          <LazyTabPanel tabId="remarks" activeTab={defaultTab}>
            <PatientInternalRemarks
              patient={patient}
              onSaved={load}
              readonly={isPatientSectionReadonly('internal_remarks') || !canEditClinical()}
            />
          </LazyTabPanel>
        </TabsContent>
      </Tabs>

      <EditPatientModal
        open={editOpen}
        setOpen={setEditOpen}
        patient={patient}
        onSaved={load}
        clinicalLocked={!canEditClinical()}
      />
      <BookForPatientModal open={bookOpen} setOpen={setBookOpen} patient={patient} onCreated={load} />
      <NewLabCaseDialog open={labOpen} setOpen={setLabOpen} lockedPatient={patient} navigateOnCreate={false} onCreated={loadLabCases} />
      <OutstandingBalanceModal open={balanceModalOpen} onOpenChange={setBalanceModalOpen} patientId={patientId} />
    </div>
  )
}
