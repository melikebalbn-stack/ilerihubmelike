'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertTriangle,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Cloud,
  Check,
} from 'lucide-react'
import { getRoleVisual } from '@/lib/role-visuals'
import { UserRolesEditDialog } from './user-roles-edit-dialog'

interface RoleSummary {
  id: string
  slug: string
  name: string
  userCount: number
}

export interface UserRow {
  id: string
  name: string | null
  email: string
  isActive: boolean
  jobTitle: string | null
  department: string | null
  roles: Array<{
    id: string
    slug: string
    name: string
    source: 'manual' | 'azure_ad' | string
    assignedAt: string
  }>
}

interface Props {
  allRoles: RoleSummary[]
  unassignedRoles: Array<{ id: string; name: string }>
  initialFilters: { search: string; roleId: string; page: number }
}

const PAGE_SIZE = 20

export function UserRolesList({ allRoles, unassignedRoles, initialFilters }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [users, setUsers] = useState<UserRow[]>([])
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(initialFilters.search)
  const [searchInput, setSearchInput] = useState(initialFilters.search)
  const [roleId, setRoleId] = useState(initialFilters.roleId)
  const [page, setPage] = useState(initialFilters.page)
  const [editingUser, setEditingUser] = useState<UserRow | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (searchInput !== search) {
        setSearch(searchInput)
        setPage(1)
      }
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchInput, search])

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (search) qs.set('search', search)
      if (roleId) qs.set('roleId', roleId)
      qs.set('page', String(page))
      qs.set('pageSize', String(PAGE_SIZE))
      const res = await fetch(`/api/users/roles?${qs}`)
      if (!res.ok) {
        setUsers([])
        return
      }
      const data = await res.json()
      setUsers(data.users)
      setPagination(data.pagination)
    } finally {
      setLoading(false)
    }
  }, [search, roleId, page])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  useEffect(() => {
    if (pathname !== '/settings/kullanici-rolleri') return

    const qs = new URLSearchParams()
    if (search) qs.set('search', search)
    if (roleId) qs.set('roleId', roleId)
    if (page > 1) qs.set('page', String(page))
    const url = qs.toString()
      ? `/settings/kullanici-rolleri?${qs}`
      : '/settings/kullanici-rolleri'
    router.replace(url, { scroll: false })
  }, [search, roleId, page, pathname, router])

  const start = users.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const end = Math.min(page * PAGE_SIZE, pagination.total)
  const activeRoleSummary = useMemo(
    () => (roleId ? allRoles.find((r) => r.id === roleId) : null),
    [roleId, allRoles]
  )

  function onSavedUserRoles() {
    setEditingUser(null)
    loadUsers()
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {unassignedRoles.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-700 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <strong>{unassignedRoles.length} sistem rolü</strong> hiç kullanıcıya
              atanmamış:{' '}
              <span className="font-medium">
                {unassignedRoles.map((r) => r.name).join(', ')}
              </span>
              . Bu rollerin yetkileri etkin değil.
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="İsim veya e-posta ara..."
                className="pl-9"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <select
              value={roleId}
              onChange={(e) => {
                setRoleId(e.target.value)
                setPage(1)
              }}
              className="border rounded-md px-3 py-2 text-sm bg-background min-w-[220px]"
            >
              <option value="">Tüm roller</option>
              {allRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.userCount})
                </option>
              ))}
            </select>
          </div>
          {activeRoleSummary && (
            <p className="text-xs text-muted-foreground mt-2">
              Filtre:{' '}
              <span className="font-medium text-foreground">
                {activeRoleSummary.name}
              </span>{' '}
              rolüne sahip kullanıcılar
              <button
                onClick={() => {
                  setRoleId('')
                  setPage(1)
                }}
                className="ml-2 text-teal-600 hover:underline"
              >
                Temizle
              </button>
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kullanıcı</TableHead>
                <TableHead>Departman / Unvan</TableHead>
                <TableHead>Roller</TableHead>
                <TableHead className="text-right">Aksiyon</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                    {search || roleId
                      ? 'Filtreye uyan kullanıcı bulunamadı'
                      : 'Henüz kullanıcı yok'}
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => {
                  const initials = (u.name ?? u.email)
                    .split(' ')
                    .map((p) => p[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()
                  const isPassive = !u.isActive
                  return (
                    <TableRow key={u.id} className={isPassive ? 'opacity-60' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div
                            className={[
                              'flex h-9 w-9 items-center justify-center rounded-full text-white text-xs font-bold flex-shrink-0',
                              isPassive
                                ? 'bg-gradient-to-br from-gray-400 to-gray-500'
                                : 'bg-gradient-to-br from-teal-500 to-teal-700',
                            ].join(' ')}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium truncate flex items-center gap-2">
                              <span className="truncate">{u.name ?? '(isimsiz)'}</span>
                              {isPassive && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] text-muted-foreground border-muted-foreground/40 flex-shrink-0"
                                >
                                  Pasif
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {u.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{u.department ?? '—'}</div>
                        <div className="text-xs text-muted-foreground">
                          {u.jobTitle ?? '—'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {u.roles.length === 0 ? (
                          <span className="text-xs italic text-muted-foreground">
                            Atanmış rol yok
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {u.roles.map((r) => {
                              const visual = getRoleVisual(r.slug)
                              const Icon = visual.Icon
                              return (
                                <Badge
                                  key={r.id}
                                  variant="outline"
                                  className="gap-1 font-normal"
                                  title={`${r.name} · ${
                                    r.source === 'azure_ad'
                                      ? 'Azure AD ile atandı'
                                      : 'Manuel atandı'
                                  }`}
                                >
                                  <Icon className="h-3 w-3" />
                                  {r.name}
                                  {r.source === 'azure_ad' && (
                                    <Cloud className="h-3 w-3 text-blue-600" />
                                  )}
                                </Badge>
                              )
                            })}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isPassive}
                          title={
                            isPassive ? 'Pasif kullanıcıya rol atanamaz' : undefined
                          }
                          onClick={() => !isPassive && setEditingUser(u)}
                        >
                          <Edit3 className="h-3.5 w-3.5 mr-1" />
                          Düzenle
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {pagination.total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {start}-{end} / {pagination.total} kullanıcı
            {loading && (
              <Loader2 className="inline h-3 w-3 ml-2 animate-spin" />
            )}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Önceki
            </Button>
            <span className="px-2 text-foreground tabular-nums">
              {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages || loading}
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            >
              Sonraki
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {editingUser && (
        <UserRolesEditDialog
          user={editingUser}
          allRoles={allRoles}
          open={!!editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={onSavedUserRoles}
        />
      )}
    </div>
  )
}
