import AppShell from '@/components/dentos/AppShell'
import { RoleProvider } from '@/components/dentos/RoleContext'

export default function Layout({ children }) {
  return (
    <RoleProvider>
      <AppShell>{children}</AppShell>
    </RoleProvider>
  )
}
