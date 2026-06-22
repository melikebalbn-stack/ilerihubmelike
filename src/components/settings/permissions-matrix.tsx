'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Check,
  Save,
  X,
  Lock,
  Loader2,
  ShieldCheck,
} from 'lucide-react'
import { moduleLabel, moduleIcon, roleAcronym, getRoleVisual } from '@/lib/role-visuals'

interface Role {
  id: string
  slug: string
  name: string
  isSystem: boolean
  isProtected: boolean
}

interface Permission {
  id: string
  key: string
  description: string
  module: string
}

interface Props {
  roles: Role[]
  permissions: Permission[]
  modules: string[]
  initialMatrix: Record<string, string[]>
  initialModule: string
}

type CellState = 'granted' | 'pending-add' | 'pending-remove' | 'none' | 'locked'

export function PermissionsMatrix({
  roles,
  permissions,
  modules,
  initialMatrix,
  initialModule,
}: Props) {
  const router = useRouter()
  const [activeModule, setActiveModule] = useState(initialModule)
  const [saving, setSaving] = useState(false)
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false)

  const [originalMatrix] = useState(() => {
    const m = new Map<string, Set<string>>()
    for (const [roleId, permIds] of Object.entries(initialMatrix)) {
      m.set(roleId, new Set(permIds))
    }
    return m
  })

  const [currentMatrix, setCurrentMatrix] = useState(() => {
    const m = new Map<string, Set<string>>()
    for (const [roleId, permIds] of Object.entries(initialMatrix)) {
      m.set(roleId, new Set(permIds))
    }
    return m
  })

  const superAdminId = useMemo(
    () => roles.find((r) => r.slug === 'super-admin')?.id,
    [roles]
  )

  const changes = useMemo(() => {
    const result: Array<{ roleId: string; permissionId: string; action: 'add' | 'remove' }> = []
    for (const role of roles) {
      const orig = originalMatrix.get(role.id) ?? new Set<string>()
      const curr = currentMatrix.get(role.id) ?? new Set<string>()
      for (const permId of curr) {
        if (!orig.has(permId)) result.push({ roleId: role.id, permissionId: permId, action: 'add' })
      }
      for (const permId of orig) {
        if (!curr.has(permId)) result.push({ roleId: role.id, permissionId: permId, action: 'remove' })
      }
    }
    return result
  }, [roles, originalMatrix, currentMatrix])

  const hasChanges = changes.length > 0

  useEffect(() => {
    if (!hasChanges) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasChanges])

  // URL sync: activeModule → ?module=X. window.history.replaceState (RSC tetiklemez,
  // user-roles-list ile aynı pattern; router.replace aynı URL'de bile RSC payload
  // fetch tetikliyordu, performans regression'ı yaratıyordu). No-op guard +
  // window.location pathname guard.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.location.pathname !== '/settings/izin-matrisi') return

    const newUrl = activeModule
      ? `/settings/izin-matrisi?module=${activeModule}`
      : '/settings/izin-matrisi'

    const currentUrl = window.location.pathname + window.location.search
    if (currentUrl === newUrl) return

    window.history.replaceState({}, '', newUrl)
  }, [activeModule])

  function getCellState(roleId: string, permissionId: string): CellState {
    if (roleId === superAdminId) return 'locked'
    const inOrig = originalMatrix.get(roleId)?.has(permissionId) ?? false
    const inCurr = currentMatrix.get(roleId)?.has(permissionId) ?? false
    if (inOrig && inCurr) return 'granted'
    if (!inOrig && inCurr) return 'pending-add'
    if (inOrig && !inCurr) return 'pending-remove'
    return 'none'
  }

  function toggleCell(roleId: string, permissionId: string) {
    if (roleId === superAdminId) return
    setCurrentMatrix((prev) => {
      const next = new Map(prev)
      const set = new Set(next.get(roleId) ?? [])
      if (set.has(permissionId)) set.delete(permissionId)
      else set.add(permissionId)
      next.set(roleId, set)
      return next
    })
  }

  async function handleSave() {
    if (!hasChanges) return
    setSaving(true)
    try {
      const res = await fetch('/api/permissions/matrix', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Kaydetme başarısız')
        return
      }
      toast.success(data.message ?? `${changes.length} değişiklik kaydedildi`)
      router.refresh()
    } catch {
      toast.error('Sunucuya ulaşılamadı')
    } finally {
      setSaving(false)
    }
  }

  function handleCancelConfirmed() {
    setCurrentMatrix(() => {
      const m = new Map<string, Set<string>>()
      for (const [roleId, permIds] of originalMatrix.entries()) {
        m.set(roleId, new Set(permIds))
      }
      return m
    })
    setConfirmCancelOpen(false)
  }

  const activePermissions = permissions.filter((p) => p.module === activeModule)
  const permissionsCountByModule = useMemo(() => {
    const map: Record<string, number> = {}
    for (const p of permissions) map[p.module] = (map[p.module] ?? 0) + 1
    return map
  }, [permissions])

  const pendingByModule = useMemo(() => {
    const map: Record<string, number> = {}
    const permModuleById = new Map(permissions.map((p) => [p.id, p.module]))
    for (const c of changes) {
      const m = permModuleById.get(c.permissionId)
      if (m) map[m] = (map[m] ?? 0) + 1
    }
    return map
  }, [changes, permissions])

  const totalRolesCount = roles.length
  const totalAssignments = useMemo(() => {
    let sum = 0
    for (const set of currentMatrix.values()) sum += set.size
    return sum
  }, [currentMatrix])

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-teal-600" />
              İzin Matrisi
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {totalRolesCount} rol × {permissions.length} izin · {totalAssignments} aktif atama
            </p>
          </div>

          <div className="flex items-center gap-2">
            {hasChanges && (
              <Badge variant="secondary" className="text-sm bg-blue-100 text-blue-800 border-blue-200">
                {changes.length} bekleyen değişiklik
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmCancelOpen(true)}
              disabled={!hasChanges || saving}
            >
              <X className="h-4 w-4 mr-1" />
              İptal
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-3">
            <div className="flex flex-wrap gap-1.5">
              {modules.map((m) => {
                const Icon = moduleIcon(m)
                const active = m === activeModule
                const pending = pendingByModule[m] ?? 0
                return (
                  <button
                    key={m}
                    onClick={() => setActiveModule(m)}
                    className={[
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                      active
                        ? 'bg-teal-600 text-white'
                        : 'bg-muted hover:bg-muted/70 text-foreground',
                    ].join(' ')}
                  >
                    <Icon className="h-4 w-4" />
                    {moduleLabel(m)}
                    <Badge
                      variant={active ? 'secondary' : 'outline'}
                      className={[
                        'ml-1 px-1.5 py-0 text-[10px] tabular-nums h-4',
                        active ? 'bg-white/20 text-white border-transparent' : '',
                      ].join(' ')}
                    >
                      {permissionsCountByModule[m] ?? 0}
                    </Badge>
                    {pending > 0 && (
                      <span className="ml-1 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-blue-500 text-white text-[10px] font-bold">
                        {pending}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background z-10">
                <tr className="border-b">
                  <th className="text-left p-3 font-semibold min-w-[280px]">
                    İzin
                  </th>
                  {roles.map((role) => {
                    const visual = getRoleVisual(role.slug)
                    const Icon = visual.Icon
                    const isLocked = role.id === superAdminId
                    return (
                      <Tooltip key={role.id}>
                        <TooltipTrigger asChild>
                          <th className="p-2 text-center font-semibold w-[60px]">
                            <div className="flex flex-col items-center gap-1">
                              <div
                                className={[
                                  'p-1.5 rounded relative',
                                  visual.tone,
                                ].join(' ')}
                              >
                                <Icon className="h-3.5 w-3.5" />
                                {isLocked && (
                                  <Lock className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 text-muted-foreground bg-background rounded-full p-[1px]" />
                                )}
                              </div>
                              <span className="text-[10px] font-mono text-muted-foreground">
                                {roleAcronym(role.slug)}
                              </span>
                            </div>
                          </th>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-xs">
                            <div className="font-semibold">{role.name}</div>
                            <div className="text-muted-foreground font-mono">{role.slug}</div>
                            {isLocked && (
                              <div className="text-amber-600 mt-1">Düzenlenemez</div>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {activePermissions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={roles.length + 1}
                      className="p-8 text-center text-muted-foreground"
                    >
                      Bu modülde izin bulunamadı
                    </td>
                  </tr>
                ) : (
                  activePermissions.map((perm) => {
                    const rowHasPending = roles.some((r) => {
                      const s = getCellState(r.id, perm.id)
                      return s === 'pending-add' || s === 'pending-remove'
                    })
                    return (
                      <tr
                        key={perm.id}
                        className={[
                          'border-b transition-colors',
                          rowHasPending ? 'bg-blue-50/40' : 'hover:bg-muted/30',
                        ].join(' ')}
                      >
                        <td className="p-3">
                          <div className="space-y-0.5">
                            <div className="font-medium text-sm">{perm.description}</div>
                            <div className="font-mono text-xs text-muted-foreground">
                              {perm.key}
                            </div>
                          </div>
                        </td>
                        {roles.map((role) => {
                          const state = getCellState(role.id, perm.id)
                          const isLocked = state === 'locked'
                          return (
                            <td key={role.id} className="p-1 text-center">
                              <button
                                onClick={() => toggleCell(role.id, perm.id)}
                                disabled={isLocked}
                                className={[
                                  'inline-flex items-center justify-center h-8 w-8 rounded transition-all',
                                  isLocked
                                    ? 'cursor-not-allowed'
                                    : 'cursor-pointer hover:bg-muted',
                                  state === 'pending-add' && 'bg-blue-100 ring-1 ring-blue-300',
                                  state === 'pending-remove' && 'bg-red-100 ring-1 ring-red-300',
                                ].filter(Boolean).join(' ')}
                                aria-label={`${role.name} → ${perm.key}: ${state}`}
                              >
                                <CellGlyph state={state} />
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                Atanmış
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-blue-600" />
                Eklenecek (kaydet bekliyor)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-red-500 line-through decoration-2" />
                Kaldırılacak
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 text-muted-foreground/40 inline-flex items-center justify-center">
                  ·
                </span>
                Atanmamış
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" />
                Super Admin (kilitli — tüm izinler)
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={confirmCancelOpen} onOpenChange={setConfirmCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Değişiklikleri iptal et</AlertDialogTitle>
            <AlertDialogDescription>
              {changes.length} bekleyen değişiklik geri alınacak. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelConfirmed}>
              Tüm değişiklikleri iptal et
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  )
}

function CellGlyph({ state }: { state: CellState }) {
  if (state === 'locked') return <Check className="h-4 w-4 text-emerald-700/60" />
  if (state === 'granted') return <Check className="h-4 w-4 text-emerald-600" />
  if (state === 'pending-add') return <Check className="h-4 w-4 text-blue-600" />
  if (state === 'pending-remove')
    return (
      <Check className="h-4 w-4 text-red-500 line-through decoration-2 decoration-red-500" />
    )
  return <span className="text-muted-foreground/40 text-base leading-none">·</span>
}
