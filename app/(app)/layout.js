import AppShell from '@/components/dentos/AppShell'
import { RoleProvider } from '@/components/dentos/RoleContext'
import { WorkspaceProvider } from '@/components/workspace/WorkspaceProvider'
import { GlobalErrorBoundary } from '@/components/system/GlobalErrorBoundary'
import OfflineBanner from '@/components/system/OfflineBanner'

export default function Layout({ children }) {
  return (
    <RoleProvider>
      <WorkspaceProvider>
        <GlobalErrorBoundary>
          <AppShell>{children}</AppShell>
          <OfflineBanner />
        </GlobalErrorBoundary>
      </WorkspaceProvider>
    </RoleProvider>
  )
}
