'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getSandboxBySlug, canAccessSandbox } from '@/lib/sandbox-config'
import SandboxHeader from '@/components/sandbox/SandboxHeader'
import SandboxWorkspace from '@/components/sandbox/SandboxWorkspace'

export default function ElifSandboxPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user?.email) {
      router.push('/login')
      return
    }
    const userRole = (session.user as any).role || 'EMPLOYEE'
    if (!canAccessSandbox('elif', session.user.email, userRole)) {
      router.push('/')
      return
    }
    setAuthorized(true)
  }, [session, status, router])

  if (status === 'loading' || !authorized) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    )
  }

  const sandboxModule = getSandboxBySlug('elif')
  if (!sandboxModule) return null

  return (
    <div className="space-y-6">
      <SandboxHeader
        module={sandboxModule}
        userName={session?.user?.name ?? 'Elif'}
      />
      <SandboxWorkspace ownerName="Elif" />
    </div>
  )
}
