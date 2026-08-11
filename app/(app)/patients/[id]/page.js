'use client'

import { useParams } from 'next/navigation'
import PatientWorkspace from '@/components/patient-workspace/PatientWorkspace'

export default function PatientDetailPage() {
  const { id } = useParams()
  return <PatientWorkspace patientId={id} />
}
