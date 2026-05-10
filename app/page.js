import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
function App() {
  const u = getCurrentUser()
  if (u) redirect('/dashboard')
  redirect('/login')
}
export default App
