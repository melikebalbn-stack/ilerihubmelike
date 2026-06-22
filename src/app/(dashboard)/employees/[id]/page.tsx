'use client'

import { useState, useEffect, use } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, User } from 'lucide-react'
import { EmployeeDetail } from '@/components/employees/EmployeeDetail'
import { Button } from '@/components/ui/button'

interface TeamMember {
  id: string
  name: string
  title: string | null
  email: string | null
}

interface Manager {
  id: string
  name: string
  title: string | null
  email: string | null
}

interface EmployeeDetailData {
  id: string
  name: string
  email: string | null
  department: string | null
  title: string | null
  phone: string | null
  avatar: string | null
  manager: Manager | null
  teamMembers: TeamMember[]
}

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()

  const [employee, setEmployee] = useState<EmployeeDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchEmployee() {
      try {
        setLoading(true)
        const res = await fetch(`/api/employees/${id}`)

        if (res.status === 404) {
          setError('Çalışan bulunamadı')
          return
        }

        if (!res.ok) {
          throw new Error('Çalışan bilgileri yüklenemedi')
        }

        const data = await res.json()
        setEmployee(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Bir hata oluştu')
      } finally {
        setLoading(false)
      }
    }

    if (status === 'authenticated' && id) {
      fetchEmployee()
    }
  }, [status, id])

  // Auth kontrolü
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    router.push('/auth/login')
    return null
  }

  return (
    <div className="space-y-6">
      {/* Geri butonu */}
      <div>
        <Link href="/employees">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            Çalışan Rehberi
          </Button>
        </Link>
      </div>

      {/* Yükleniyor */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Hata */}
      {error && (
        <div className="flex flex-col items-center justify-center py-16">
          <User className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <p className="text-lg font-medium text-muted-foreground">{error}</p>
          <Link href="/employees" className="mt-4">
            <Button variant="outline">Çalışan Rehberine Dön</Button>
          </Link>
        </div>
      )}

      {/* Çalışan detayı */}
      {!loading && !error && employee && (
        <EmployeeDetail
          employee={employee}
          canEdit={session?.user?.permissions?.includes('calisanrehberi.admin') ?? false}
          onPhoneUpdate={(phone) => setEmployee({ ...employee, phone: phone || null })}
        />
      )}
    </div>
  )
}
