import AppShell from '@/components/dentos/AppShell'
import { RoleProvider } from '@/components/dentos/RoleContext'
import { WorkspaceProvider } from '@/components/workspace/WorkspaceProvider'

export default function Layout({ children }) {
  return (
    <RoleProvider>
      <WorkspaceProvider>
        <AppShell>{children}</AppShell>
      </WorkspaceProvider>
    </RoleProvider>
  )
}
