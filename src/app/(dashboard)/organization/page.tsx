'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Network, Loader2, Users, Filter } from 'lucide-react'
import { OrgChart } from '@/components/employees/OrgChart'
import { NativeSelect as Select } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'

interface OrgNode {
  id: string
  name: string
  title: string | null
  department: string | null
  email: string | null
  children: OrgNode[]
}

interface OrgTreeResponse {
  tree: OrgNode[]
  departments: string[]
  totalEmployees: number
}

// Departmana göre ağacı filtrele
function filterTreeByDepartment(tree: OrgNode[], department: string): OrgNode[] {
  if (!department) return tree

  function filterNode(node: OrgNode): OrgNode | null {
    // Bu düğüm veya alt düğümler departmana ait mi?
    const matchesDepartment = node.department?.toLowerCase().includes(department.toLowerCase())
    const filteredChildren = node.children
      .map(child => filterNode(child))
      .filter((child): child is OrgNode => child !== null)

    // Bu düğüm eşleşiyor veya alt düğümler var
    if (matchesDepartment || filteredChildren.length > 0) {
      return {
        ...node,
        children: filteredChildren,
      }
    }

    return null
  }

  return tree
    .map(node => filterNode(node))
    .filter((node): node is OrgNode => node !== null)
}

export default function OrganizationPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [tree, setTree] = useState<OrgNode[]>([])
  const [departments, setDepartments] = useState<string[]>([])
  const [totalEmployees, setTotalEmployees] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDepartment, setSelectedDepartment] = useState('')

  useEffect(() => {
    async function fetchOrgTree() {
      try {
        setLoading(true)
        const res = await fetch('/api/organization/tree')

        if (!res.ok) {
          throw new Error('Organizasyon şeması yüklenemedi')
        }

        const data: OrgTreeResponse = await res.json()
        setTree(data.tree)
        setDepartments(data.departments)
        setTotalEmployees(data.totalEmployees)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Bir hata oluştu')
      } finally {
        setLoading(false)
      }
    }

    if (status === 'authenticated') {
      fetchOrgTree()
    }
  }, [status])

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

  const filteredTree = filterTreeByDepartment(tree, selectedDepartment)

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Network className="h-6 w-6" />
            Organizasyon Şeması
          </h1>
          <p className="text-muted-foreground mt-1">
            Şirket hiyerarşisini görselleştirin
          </p>
        </div>

        {/* Departman filtresi */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="w-48"
          >
            <option value="">Tüm Departmanlar</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* İstatistikler */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalEmployees}</p>
                <p className="text-sm text-muted-foreground">Toplam Çalışan</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <Network className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{departments.length}</p>
                <p className="text-sm text-muted-foreground">Departman</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                <Users className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{tree.length}</p>
                <p className="text-sm text-muted-foreground">Üst Yönetici</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hata */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Organizasyon Şeması */}
      {!loading && !error && (
        <OrgChart tree={filteredTree} />
      )}

      {/* Kullanım ipucu */}
      <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-4">
        <strong>İpucu:</strong> Düğümlere tıklayarak alt kademeleri açıp kapatabilirsiniz.
        Zoom için Ctrl + scroll kullanın. Sürükleyerek kaydırabilirsiniz.
        İsme tıklayarak çalışan detayına gidebilirsiniz.
      </div>
    </div>
  )
}
