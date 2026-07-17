'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSandboxBySlug, canAccessSandbox } from '@/lib/sandbox-config'
import SandboxHeader from '@/components/sandbox/SandboxHeader'
import SandboxWorkspace from '@/components/sandbox/SandboxWorkspace'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ClipboardList } from 'lucide-react'

export default function MelikeSandboxPage() {
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
    if (!canAccessSandbox('melike', session.user.email, userRole)) {
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

  const sandboxModule = getSandboxBySlug('melike')
  if (!sandboxModule) return null

  return (
    <div className="space-y-6">
      <SandboxHeader
        module={sandboxModule}
        userName={session?.user?.name ?? 'Melike'}
      />

      <Link href="/sandbox/melike/toplu-kart-okutamama">
        <Card className="hover:shadow-md transition-shadow cursor-pointer border-teal-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-teal-600" />
              Toplu Kart Okutamama
            </CardTitle>
            <CardDescription className="text-xs">
              Sicil No / Ad Soyad seçimli, Excel export/import destekli liste
            </CardDescription>
          </CardHeader>
        </Card>
      </Link>

      <SandboxWorkspace ownerName="Melike" />
    </div>
  )
}
