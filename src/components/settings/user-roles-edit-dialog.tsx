'use client'

import { useState, useMemo, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Loader2, Cloud, Lock } from 'lucide-react'
import { getRoleVisual } from '@/lib/role-visuals'
import type { UserRow } from './user-roles-list'

interface RoleSummary {
  id: string
  slug: string
  name: string
  userCount: number
}

interface Props {
  user: UserRow
  allRoles: RoleSummary[]
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function UserRolesEditDialog({
  user,
  allRoles,
  open,
  onClose,
  onSaved,
}: Props) {
  const initialManualIds = useMemo(
    () =>
      user.roles
        .filter((r) => r.source === 'manual')
        .map((r) => r.id)
        .sort(),
    [user.roles]
  )
  const azureRoles = useMemo(
    () => user.roles.filter((r) => r.source === 'azure_ad'),
    [user.roles]
  )

  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(initialManualIds)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // PR-FAZ2A: görünür bölümler (mesai performans). Boş = tüm bölümler.
  const initialDepts = useMemo(() => [...(user.gorunurBolumler ?? [])].sort(), [user.gorunurBolumler])
  const [allDepts, setAllDepts] = useState<string[]>([])
  const [selectedDepts, setSelectedDepts] = useState<string[]>(initialDepts)

  useEffect(() => {
    fetch('/api/settings/hr-departments')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: { name: string }[]) => setAllDepts(Array.isArray(data) ? data.map((d) => d.name) : []))
      .catch(() => setAllDepts([]))
  }, [])

  const sortedSelected = useMemo(
    () => [...selectedRoleIds].sort(),
    [selectedRoleIds]
  )
  const deptsChanged = useMemo(
    () => JSON.stringify([...selectedDepts].sort()) !== JSON.stringify(initialDepts),
    [selectedDepts, initialDepts]
  )
  const hasChanges =
    JSON.stringify(sortedSelected) !== JSON.stringify(initialManualIds) || deptsChanged
  const overLimit = selectedRoleIds.length > 9

  function toggle(roleId: string) {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId]
    )
  }

  function toggleDept(name: string) {
    setSelectedDepts((prev) =>
      prev.includes(name) ? prev.filter((d) => d !== name) : [...prev, name]
    )
  }

  async function handleSave() {
    if (!hasChanges || overLimit) return
    setSaving(true)
    setErrorMsg(null)
    try {
      const rolesChanged =
        JSON.stringify(sortedSelected) !== JSON.stringify(initialManualIds)
      let added = 0
      let removed = 0

      if (rolesChanged) {
        const res = await fetch(`/api/users/${user.id}/roles`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roleIds: selectedRoleIds }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setErrorMsg(data.error ?? 'Rol kaydetme başarısız')
          return
        }
        ;({ added = 0, removed = 0 } = data.changes ?? {})
      }

      // PR-FAZ2A: görünür bölümler
      if (deptsChanged) {
        const res2 = await fetch(`/api/users/${user.id}/departments`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gorunurBolumler: selectedDepts }),
        })
        const d2 = await res2.json().catch(() => ({}))
        if (!res2.ok) {
          setErrorMsg(d2.error ?? 'Görünür bölüm kaydı başarısız')
          return
        }
      }

      const parts: string[] = []
      if (rolesChanged && added + removed > 0) {
        parts.push(
          `${added ? `${added} rol eklendi` : ''}${added && removed ? ', ' : ''}${removed ? `${removed} rol kaldırıldı` : ''}`,
        )
      }
      if (deptsChanged) {
        parts.push(selectedDepts.length ? `görünür bölümler: ${selectedDepts.length}` : 'görünür bölümler: tümü')
      }
      if (parts.length === 0) toast.info('Değişiklik yok')
      else toast.success(`${user.name ?? user.email}: ${parts.join(' · ')}`)
      onSaved()
    } catch {
      setErrorMsg('Sunucuya ulaşılamadı')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rolleri düzenle</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{user.name ?? '(isimsiz)'}</span>
            <span className="text-muted-foreground"> · {user.email}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
          {azureRoles.length > 0 && (
            <div className="rounded-md border bg-muted/40 p-3 space-y-2">
              <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Cloud className="h-3.5 w-3.5 text-blue-600" />
                Azure AD ile atanan roller (kilitli)
              </div>
              <div className="flex flex-wrap gap-1">
                {azureRoles.map((r) => {
                  const visual = getRoleVisual(r.slug)
                  const Icon = visual.Icon
                  return (
                    <Badge key={r.id} variant="outline" className="gap-1 font-normal">
                      <Icon className="h-3 w-3" />
                      {r.name}
                      <Lock className="h-2.5 w-2.5 ml-0.5 opacity-60" />
                    </Badge>
                  )
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Bu roller LDAP sync ile yönetilir, manuel kaldırılamaz.
              </p>
            </div>
          )}

          <div className="space-y-1">
            <div className="text-xs font-semibold text-foreground">
              Manuel atanan roller{' '}
              <span className="text-muted-foreground font-normal">
                ({selectedRoleIds.length}/9)
              </span>
            </div>
            <div className="space-y-1">
              {allRoles.map((role) => {
                const checked = selectedRoleIds.includes(role.id)
                const visual = getRoleVisual(role.slug)
                const Icon = visual.Icon
                return (
                  <label
                    key={role.id}
                    className={[
                      'flex items-center gap-3 rounded-md p-2 cursor-pointer transition-colors',
                      checked ? 'bg-teal-50' : 'hover:bg-muted',
                    ].join(' ')}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggle(role.id)}
                    />
                    <div className={`p-1.5 rounded ${visual.tone}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{role.name}</div>
                      <div className="text-[11px] font-mono text-muted-foreground truncate">
                        {role.slug}
                      </div>
                    </div>
                    <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
                      {role.userCount} kişi
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* PR-FAZ2A: Görünür Bölümler (Mesai Performansı) */}
          <div className="space-y-1">
            <div className="text-xs font-semibold text-foreground">
              Görünür Bölümler (Mesai Performansı){' '}
              <span className="text-muted-foreground font-normal">
                {selectedDepts.length === 0 ? '(boş = tüm bölümler)' : `(${selectedDepts.length} seçili)`}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {allDepts.map((d) => {
                const checked = selectedDepts.includes(d)
                return (
                  <label
                    key={d}
                    className={[
                      'flex items-center gap-2 rounded-md p-1.5 cursor-pointer transition-colors text-sm',
                      checked ? 'bg-teal-50' : 'hover:bg-muted',
                    ].join(' ')}
                  >
                    <Checkbox checked={checked} onCheckedChange={() => toggleDept(d)} />
                    <span className="truncate">{d}</span>
                  </label>
                )
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Boş = tüm bölümler. Yalnız mesai performans raporunu (overtime.report) etkiler.
            </p>
          </div>

          {overLimit && (
            <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
              Bir kullanıcıya en fazla 9 rol atanabilir
            </div>
          )}
          {errorMsg && (
            <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
              {errorMsg}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            İptal
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || overLimit || saving}
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
