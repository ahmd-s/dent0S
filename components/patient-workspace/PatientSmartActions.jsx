'use client'

import {
  CalendarPlus, FilePlus, Sparkles, FlaskConical, IndianRupee,
  FileText, Mic, Pill,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import WorkspaceGate from '@/components/workspace/WorkspaceGate'

export default function PatientSmartActions({
  onBookAppointment,
  onNewVisit,
  onNewLab,
  onCollectPayment,
  onGenerateAI,
  onNewPrescription,
  canStartVisit,
}) {
  return (
    <Card className="p-3 bg-card border-border rounded-xl">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">Quick Actions</div>
      <div className="flex flex-wrap gap-2">
        <WorkspaceGate section="quick_actions" flag="new_visit">
          {canStartVisit && (
            <Button size="sm" onClick={onNewVisit} className="h-8 bg-[#0D9488] hover:bg-[#0B7E73]">
              <FilePlus className="w-3.5 h-3.5 mr-1.5" />New Visit
            </Button>
          )}
        </WorkspaceGate>
        <WorkspaceGate section="quick_actions" flag="new_appointment">
          <Button size="sm" variant="outline" onClick={onBookAppointment} className="h-8">
            <CalendarPlus className="w-3.5 h-3.5 mr-1.5" />Appointment
          </Button>
        </WorkspaceGate>
        <WorkspaceGate section="patient_page" flag="ai_summary">
          <Button size="sm" variant="outline" onClick={onGenerateAI} className="h-8">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />AI Summary
          </Button>
        </WorkspaceGate>
        <WorkspaceGate section="quick_actions" flag="new_lab_case">
          <Button size="sm" variant="outline" onClick={onNewLab} className="h-8">
            <FlaskConical className="w-3.5 h-3.5 mr-1.5" />Lab Case
          </Button>
        </WorkspaceGate>
        <WorkspaceGate section="quick_actions" flag="collect_payment">
          <Button size="sm" variant="outline" onClick={onCollectPayment} className="h-8">
            <IndianRupee className="w-3.5 h-3.5 mr-1.5" />Payment
          </Button>
        </WorkspaceGate>
        <WorkspaceGate section="quick_actions" flag="print_prescription">
          <Button size="sm" variant="outline" onClick={onNewPrescription} className="h-8">
            <Pill className="w-3.5 h-3.5 mr-1.5" />Prescription
          </Button>
        </WorkspaceGate>
        <WorkspaceGate section="quick_actions" flag="generate_ai_summary">
          <Button size="sm" variant="outline" className="h-8 opacity-60" disabled title="Voice notes available during visit">
            <Mic className="w-3.5 h-3.5 mr-1.5" />Voice Note
          </Button>
        </WorkspaceGate>
        <WorkspaceGate section="quick_actions" flag="generate_invoice">
          <Button size="sm" variant="outline" onClick={onCollectPayment} className="h-8">
            <FileText className="w-3.5 h-3.5 mr-1.5" />Invoice
          </Button>
        </WorkspaceGate>
      </div>
    </Card>
  )
}
