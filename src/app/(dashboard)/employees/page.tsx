'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Users, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { EmployeeCard } from '@/components/employees/EmployeeCard'
import { EmployeeListItem } from '@/components/employees/EmployeeListItem'
import { EmployeeFilters } from '@/components/employees/EmployeeFilters'
import { Button } from '@/components/ui/button'

interface Employee {
  id: string
  name: string
  email: string | null
  department: string | null
  title: string | null
  location: string | null
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
    locations: string[]
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
  const [location, setLocation] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // Sayfalama
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 20

  // Filtre seçenekleri
  const [departments, setDepartments] = useState<string[]>([])
  const [locations, setLocations] = useState<string[]>([])

  // Debounce için
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1) // Arama değiştiğinde sayfa 1'e dön
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Çalışanları getir
  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      })

      if (debouncedSearch) params.set('search', debouncedSearch)
      if (department) params.set('department', department)
      if (location) params.set('location', location)

      const res = await fetch(`/api/employees?${params}`)
      if (!res.ok) throw new Error('Çalışanlar yüklenemedi')

      const data: EmployeesResponse = await res.json()

      setEmployees(data.employees)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
      setDepartments(data.filters.departments)
      setLocations(data.filters.locations)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu')
    } finally {
      setLoading(false)
    }
  }, [page, limit, debouncedSearch, department, location])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchEmployees()
    }
  }, [status, fetchEmployees])

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
        location={location}
        onLocationChange={(v) => {
          setLocation(v)
          setPage(1)
        }}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        departments={departments}
        locations={locations}
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

          {/* Sayfalama */}
          {totalPages > 1 && (
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
