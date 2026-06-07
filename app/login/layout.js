import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'

export default function LoginLayout({ children }) {
  const token = cookies().get('dentos_token')?.value
  if (token) {
    const user = verifyToken(token)
    if (user) {
      redirect('/dashboard')
    }
  }
  return <>{children}</>
}
