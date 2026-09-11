'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Receipt } from 'lucide-react'
import { getSandboxBySlug, canAccessSandbox } from '@/lib/sandbox-config'
import SandboxHeader from '@/components/sandbox/SandboxHeader'
import SandboxWorkspace from '@/components/sandbox/SandboxWorkspace'
import { Card, CardContent } from '@/components/ui/card'

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

      <Link href="/sandbox/melike/faturalar">
        <Card className="transition-colors hover:border-[#1B4F72]/40 hover:bg-[#EAF1F6]/40">
          <CardContent className="flex items-center gap-3 py-4">
            <Receipt className="h-5 w-5 text-[#1B4F72]" />
            <div>
              <div className="text-sm font-semibold text-[#1B4F72]">Fatura Takip</div>
              <div className="text-xs text-muted-foreground">
                Genel / Sistem Geliştirme ayrımı, TCMB € dönüşümü, aylık ciro kıyası
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>

      <SandboxWorkspace ownerName="Melike" />
    </div>
  )
}
