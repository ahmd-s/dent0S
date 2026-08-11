'use client'

import DiagnosticsPanel from '@/components/system/DiagnosticsPanel'

export default function PlatformDiagnosticsPage() {
  return <DiagnosticsPanel scope="platform" apiPath="/api/platform-admin/diagnostics" />
}
