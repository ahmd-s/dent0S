'use client'
import { ShieldX, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useRole } from './RoleContext'
import Link from 'next/link'

export default function AccessDenied() {
  const { currentRole } = useRole()

  const rolePermissions = {
    admin: [
      'Full access to all features',
      'Manage staff and team members',
      'Access settings and clinic configuration',
      'Manage inventory and lab cases',
      'Full billing and invoice management',
      'Complete patient and clinical data access'
    ],
    doctor: [
      'Full patient records access',
      'Create and manage visits',
      'View and edit clinical notes',
      'Manage appointments',
      'View billing information (read-only)',
      'Manage inventory and lab cases'
    ],
    receptionist: [
      'View patient basic information (name, phone, age)',
      'Manage appointments',
      'Full billing and invoice management',
      'View appointment history',
      'Manage consent forms'
    ]
  }

  const permissions = rolePermissions[currentRole] || []

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="max-w-lg w-full p-8 bg-card border-border rounded-lg">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
            <ShieldX className="w-8 h-8 text-red-500" />
          </div>
          
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-6">
            You don't have permission to access this page or feature.
          </p>

          <div className="w-full text-left mb-6">
            <h2 className="text-sm font-semibold text-foreground mb-3 capitalize">
              Your Role: {currentRole || 'Unknown'}
            </h2>
            <div className="bg-muted rounded-lg p-4">
              <h3 className="text-xs font-medium text-muted-foreground mb-2">What you can access:</h3>
              <ul className="space-y-1">
                {permissions.map((permission, index) => (
                  <li key={index} className="text-sm text-foreground flex items-start gap-2">
                    <span className="text-[#0D9488] mt-1">•</span>
                    {permission}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <Link href="/dashboard" className="w-full">
            <Button className="w-full bg-[#0D9488] hover:bg-[#0B7E73]">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}
