'use client'

import {
  Bell, Cake, Clock, MessageSquare, Megaphone, Star,
  CreditCard, FlaskConical, Calendar, Send,
} from 'lucide-react'
import StatCard from '@/components/ui/stat-card'

const comm = stats => stats?.communication || {}

export function TodaysRemindersWidget({ stats }) {
  return (
    <StatCard label="Today's Reminders" val={comm(stats).todays_reminders} sub="Messages today" icon={Bell} color="#6366F1" href="/marketing" />
  )
}

export function CommBirthdaysWidget({ stats }) {
  return (
    <StatCard label="Birthdays Today" val={comm(stats).birthdays} sub="Patients celebrating" icon={Cake} color="#EC4899" href="/marketing" />
  )
}

export function PendingFollowupsCommWidget({ stats }) {
  return (
    <StatCard label="Pending Follow-ups" val={stats?.followups_due_count} sub="Due for outreach" icon={Clock} color="#F59E0B" href="/marketing" />
  )
}

export function CommunicationActivityWidget({ stats }) {
  return (
    <StatCard label="Delivered Today" val={comm(stats).delivered} sub={`${comm(stats).failed || 0} failed`} icon={Send} color="#0D9488" href="/marketing" />
  )
}

export function CampaignPerformanceWidget({ stats }) {
  return (
    <StatCard label="Campaigns" val={comm(stats).campaigns_sent ?? '—'} sub="Sent this period" icon={Megaphone} color="#8B5CF6" href="/marketing" />
  )
}

export function ReviewRequestsWidget({ stats }) {
  return (
    <StatCard label="Review Requests" val={comm(stats).review_requests} sub="Pending reviews" icon={Star} color="#F59E0B" href="/marketing" />
  )
}

export function OutstandingPaymentsCommWidget({ stats }) {
  return (
    <StatCard label="Payment Reminders" val={comm(stats).payment_reminders} sub="Sent today" icon={CreditCard} color="#EF4444" href="/billing" />
  )
}

export function LabNotificationsWidget({ stats }) {
  return (
    <StatCard label="Lab Notifications" val={comm(stats).lab_notifications} sub="Sent today" icon={FlaskConical} color="#0D9488" href="/lab-cases" />
  )
}

export function AppointmentRemindersWidget({ stats }) {
  return (
    <StatCard label="Appointment Reminders" val={comm(stats).appointment_reminders} sub="Sent today" icon={Calendar} color="#6366F1" href="/appointments" />
  )
}

export function CommMessagesSentWidget({ stats }) {
  return (
    <StatCard label="Messages Sent" val={comm(stats).messages_sent ?? comm(stats).todays_reminders} sub="Communication volume" icon={MessageSquare} color="#0D9488" href="/marketing" />
  )
}

export const COMMUNICATION_FLOW_WIDGET_MAP = {
  comm_todays_reminders: TodaysRemindersWidget,
  comm_birthdays: CommBirthdaysWidget,
  comm_pending_followups: PendingFollowupsCommWidget,
  comm_activity: CommunicationActivityWidget,
  comm_campaign_performance: CampaignPerformanceWidget,
  comm_review_requests: ReviewRequestsWidget,
  comm_outstanding_payments: OutstandingPaymentsCommWidget,
  comm_lab_notifications: LabNotificationsWidget,
  comm_appointment_reminders: AppointmentRemindersWidget,
  comm_messages_sent: CommMessagesSentWidget,
}

export const COMMUNICATION_FLOW_STAT_WIDGET_IDS = new Set(Object.keys(COMMUNICATION_FLOW_WIDGET_MAP))
