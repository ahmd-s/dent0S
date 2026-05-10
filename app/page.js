import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'

function App() {
  const user = getCurrentUser()
  if (user) redirect('/dashboard')
  redirect('/login')
}

export default App
