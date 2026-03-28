'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Users, Loader2, ChevronLeft, ChevronRight, Building2, ChevronDown } from 'lucide-react'
import { EmployeeCard } from '@/components/employees/EmployeeCard'
import { EmployeeListItem } from '@/components/employees/EmployeeListItem'
import { EmployeeFilters } from '@/components/employees/EmployeeFilters'
import { Button } from '@/components/ui/button'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'

interface Employee {
  id: string
  name: string
  email: string | null
  department: string | null
  title: string | null
  phone: string | null
  avatar: string | null
}

interface EmployeesResponse {
  employees: Employee[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  filters: {
    departments: string[]
  }
}

export default function EmployeesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtreler
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'department'>('department')

  // Sayfalama (grid/list modları için)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 20

  // Filtre seçenekleri
  const [departments, setDepartments] = useState<string[]>([])

  // Debounce için
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Çalışanları getir
  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Departman görünümünde tüm çalışanları getir (limit=0)
      const fetchLimit = viewMode === 'department' ? 0 : limit
      const params = new URLSearchParams({
        page: page.toString(),
        limit: fetchLimit.toString(),
      })

      if (debouncedSearch) params.set('search', debouncedSearch)
      if (department && viewMode !== 'department') params.set('department', department)

      const res = await fetch(`/api/employees?${params}`)
      if (!res.ok) throw new Error('Çalışanlar yüklenemedi')

      const data: EmployeesResponse = await res.json()

      setEmployees(data.employees)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
      setDepartments(data.filters.departments)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu')
    } finally {
      setLoading(false)
    }
  }, [page, limit, debouncedSearch, department, viewMode])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchEmployees()
    }
  }, [status, fetchEmployees])

  // Departman görünümü için gruplama
  const groupedByDepartment = useMemo(() => {
    if (viewMode !== 'department') return {}

    const groups: Record<string, Employee[]> = {}
    for (const emp of employees) {
      const dept = emp.department || 'Diğer'
      if (!groups[dept]) groups[dept] = []
      groups[dept].push(emp)
    }

    // Departman ismine göre sırala, "Diğer" en sona
    const sorted: Record<string, Employee[]> = {}
    const keys = Object.keys(groups).sort((a, b) => {
      if (a === 'Diğer') return 1
      if (b === 'Diğer') return -1
      return a.localeCompare(b, 'tr')
    })
    for (const key of keys) {
      sorted[key] = groups[key]
    }
    return sorted
  }, [employees, viewMode])

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
      {/* Başlık */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6" />
          Çalışan Rehberi
        </h1>
        <p className="text-muted-foreground mt-1">
          Tüm çalışanları görüntüleyin ve arayın
        </p>
      </div>

      {/* Filtreler */}
      <EmployeeFilters
        search={search}
        onSearchChange={setSearch}
        department={department}
        onDepartmentChange={(v) => {
          setDepartment(v)
          setPage(1)
        }}
        viewMode={viewMode}
        onViewModeChange={(mode) => {
          setViewMode(mode)
          setPage(1)
        }}
        departments={departments}
      />

      {/* Sonuç sayısı */}
      <div className="text-sm text-muted-foreground">
        {loading ? (
          'Yükleniyor...'
        ) : (
          <>
            <span className="font-medium">{total}</span> çalışan bulundu
          </>
        )}
      </div>

      {/* Hata */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Çalışan listesi */}
      {!loading && !error && (
        <>
          {employees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Users className="h-16 w-16 mb-4 opacity-30" />
              <p className="text-lg">Çalışan bulunamadı</p>
              <p className="text-sm">Filtrelerinizi değiştirmeyi deneyin</p>
            </div>
          ) : viewMode === 'department' ? (
            /* Departman Accordion Görünümü */
            <Accordion type="multiple" className="space-y-2">
              {Object.entries(groupedByDepartment).map(([dept, deptEmployees]) => (
                <AccordionItem
                  key={dept}
                  value={dept}
                  className="border rounded-lg px-4"
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5 text-primary" />
                      <span className="font-semibold text-base">{dept}</span>
                      <span className="text-sm text-muted-foreground font-normal">
                        ({deptEmployees.length} kişi)
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pt-2">
                      {deptEmployees.map((employee) => (
                        <EmployeeListItem key={employee.id} employee={employee} />
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : viewMode === 'grid' ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {employees.map((employee) => (
                <EmployeeCard key={employee.id} employee={employee} />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {employees.map((employee) => (
                <EmployeeListItem key={employee.id} employee={employee} />
              ))}
            </div>
          )}

          {/* Sayfalama (departman görünümünde yok) */}
          {viewMode !== 'department' && totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Önceki
              </Button>
              <span className="text-sm text-muted-foreground">
                Sayfa {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Sonraki
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
