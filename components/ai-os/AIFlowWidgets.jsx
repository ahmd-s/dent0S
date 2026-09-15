'use client'

import {
  Sparkles, FileText, Mic, Lightbulb, BarChart3, Clock,
  FlaskConical, Package, AlertTriangle, Stethoscope, Brain,
} from 'lucide-react'
import StatCard from '@/components/ui/stat-card'

const ai = stats => stats?.ai || {}

export function DoctorBriefWidget({ stats }) {
  return <StatCard label="Doctor Brief" val={ai(stats).requests_today ? 'Ready' : '—'} sub="Daily brief available" icon={Stethoscope} color="#6366F1" href="/ai" />
}

export function ClinicalAlertsWidget({ stats }) {
  return <StatCard label="Clinical Alerts" val={ai(stats).clinical_suggestions} sub="Recall suggestions" icon={AlertTriangle} color="#EF4444" href="/ai" />
}

export function PendingAIDraftsWidget({ stats }) {
  return <StatCard label="Pending AI Drafts" val={ai(stats).pending_drafts} sub="Prescriptions & voice" icon={FileText} color="#F59E0B" href="/ai" />
}

export function BusinessInsightsAIWidget({ stats }) {
  return <StatCard label="Business Insights" val={stats?.analytics?.insights?.length ?? '—'} sub="AI-powered BI" icon={BarChart3} color="#8B5CF6" href="/ai" />
}

export function VoiceQueueWidget({ stats }) {
  return <StatCard label="Voice Queue" val={ai(stats).voice_notes} sub="Processed today" icon={Mic} color="#0D9488" href="/ai" />
}

export function LabInsightsAIWidget({ stats }) {
  return <StatCard label="Lab Insights" val={stats?.lab?.open_cases ?? '—'} sub="Open lab cases" icon={FlaskConical} color="#0D9488" href="/lab-cases" />
}

export function InventoryInsightsAIWidget({ stats }) {
  return <StatCard label="Inventory Insights" val={stats?.inventory?.low_stock_count ?? '—'} sub="Low stock items" icon={Package} color="#F59E0B" href="/inventory" />
}

export function PatientRiskWidget({ stats }) {
  return <StatCard label="Patient Risk" val={ai(stats).clinical_suggestions} sub="High-risk flagged" icon={Brain} color="#EC4899" href="/ai" />
}

export function TreatmentSuggestionsWidget({ stats }) {
  return <StatCard label="Treatment Suggestions" val={ai(stats).todays_summaries} sub="Summaries today" icon={Lightbulb} color="#6366F1" href="/ai" />
}

export function AISummaryWidget({ stats }) {
  return <StatCard label="AI Summaries" val={ai(stats).todays_summaries} sub={`${ai(stats).requests_today || 0} requests today`} icon={Sparkles} color="#0D9488" href="/ai" />
}

export function AutomationQueueWidget({ stats }) {
  return <StatCard label="Automation Queue" val={ai(stats).automation_queue_size ?? 6} sub="Prepared tasks" icon={Clock} color="#8B5CF6" href="/ai" />
}

export const AI_FLOW_WIDGET_MAP = {
  ai_doctor_brief: DoctorBriefWidget,
  ai_clinical_alerts: ClinicalAlertsWidget,
  ai_pending_drafts: PendingAIDraftsWidget,
  ai_business_insights: BusinessInsightsAIWidget,
  ai_voice_queue: VoiceQueueWidget,
  ai_lab_insights: LabInsightsAIWidget,
  ai_inventory_insights: InventoryInsightsAIWidget,
  ai_patient_risk: PatientRiskWidget,
  ai_treatment_suggestions: TreatmentSuggestionsWidget,
  ai_summary: AISummaryWidget,
  ai_automation_queue: AutomationQueueWidget,
}

export const AI_FLOW_STAT_WIDGET_IDS = new Set(Object.keys(AI_FLOW_WIDGET_MAP))
