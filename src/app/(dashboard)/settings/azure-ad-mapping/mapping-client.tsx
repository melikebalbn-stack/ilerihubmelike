'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Loader2,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Plus,
  Pencil,
  Trash2,
  Eye,
} from 'lucide-react'

interface RoleSummary {
  id: string
  slug: string
  name: string
  isSystem: boolean
}
interface ADGroup {
  groupCN: string
  userCount: number
  hasMapping: boolean
  mappingId: string | null
  mappedRoleSlug: string | null
  mappedRoleName: string | null
  mappingActive: boolean | null
}
interface Mapping {
  id: string
  groupCN: string
  role: { id: string; slug: string; name: string }
  isActive: boolean
  description: string | null
  createdAt: string
  updatedAt: string
  affectedUserCount: number
}
interface PreviewResult {
  user: {
    id: string
    email: string
    name: string | null
    isActive: boolean
    groups: string[]
  }
  matchingMappings: Array<{
    groupCN: string
    roleSlug: string
    roleName: string
  }>
  wouldGetRoles: Array<{ slug: string; name: string; alreadyHas: boolean }>
  currentRoles: Array<{
    slug: string
    name: string
    source: string
    stillMapped: boolean
  }>
}

export function MappingClient({ allRoles }: { allRoles: RoleSummary[] }) {
  const [groups, setGroups] = useState<ADGroup[]>([])
  const [mappings, setMappings] = useState<Mapping[]>([])
  const [loading, setLoading] = useState(true)
  const [groupSearch, setGroupSearch] = useState('')
  const [pending, setPending] = useState(false)
  const [flash, setFlash] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(
    null
  )

  // Modals
  const [createTarget, setCreateTarget] = useState<ADGroup | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Mapping | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [g, m] = await Promise.all([
        fetch('/api/admin/ldap-group-mappings/groups', { cache: 'no-store' }),
        fetch('/api/admin/ldap-group-mappings', { cache: 'no-store' }),
      ])
      if (g.ok && m.ok) {
        const gj = await g.json()
        const mj = await m.json()
        setGroups(gj.groups ?? [])
        setMappings(mj.mappings ?? [])
      } else {
        setFlash({ kind: 'err', msg: 'Veri yüklenemedi' })
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 4000)
    return () => clearTimeout(t)
  }, [flash])

  const filteredGroups = useMemo(() => {
    const q = groupSearch.trim().toLowerCase()
    if (!q) return groups
    return groups.filter((g) => g.groupCN.toLowerCase().includes(q))
  }, [groups, groupSearch])

  async function triggerSync() {
    if (!confirm('Tüm AD kullanıcılarını şimdi senkronize etmek istediğine emin misin?'))
      return
    setPending(true)
    try {
      const res = await fetch(
        '/api/admin/ldap-group-mappings/trigger-sync',
        { method: 'POST' }
      )
      const json = await res.json()
      if (!res.ok) {
        setFlash({ kind: 'err', msg: json.error ?? 'Sync hatası' })
      } else {
        setFlash({
          kind: 'ok',
          msg: `Sync OK — created:${json.created} updated:${json.updated} (${json.duration ?? '?'}s)`,
        })
        await load()
      }
    } finally {
      setPending(false)
    }
  }

  async function createMapping(
    groupCN: string,
    roleId: string,
    description: string
  ) {
    setPending(true)
    try {
      const res = await fetch('/api/admin/ldap-group-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupCN, roleId, description }),
      })
      const json = await res.json()
      if (!res.ok) {
        setFlash({ kind: 'err', msg: json.error ?? 'Mapping oluşturulamadı' })
      } else {
        setFlash({
          kind: 'ok',
          msg: `Mapping eklendi: ${groupCN} → ${json.mapping.role.name}`,
        })
        setCreateOpen(false)
        setCreateTarget(null)
        await load()
      }
    } finally {
      setPending(false)
    }
  }

  async function patchMapping(
    id: string,
    data: { roleId?: string; isActive?: boolean; description?: string | null }
  ) {
    setPending(true)
    try {
      const res = await fetch(`/api/admin/ldap-group-mappings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) {
        setFlash({ kind: 'err', msg: json.error ?? 'Güncellenemedi' })
      } else {
        setFlash({ kind: 'ok', msg: 'Güncellendi' })
        setEditTarget(null)
        await load()
      }
    } finally {
      setPending(false)
    }
  }

  async function deleteMapping(id: string, groupCN: string) {
    if (
      !confirm(
        `'${groupCN}' mapping'i silinsin mi? Mevcut UserRole kayıtları sonraki sync'te temizlenir.`
      )
    )
      return
    setPending(true)
    try {
      const res = await fetch(`/api/admin/ldap-group-mappings/${id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!res.ok) {
        setFlash({ kind: 'err', msg: json.error ?? 'Silinemedi' })
      } else {
        setFlash({ kind: 'ok', msg: `Mapping silindi: ${groupCN}` })
        await load()
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-4">
      {flash && (
        <Card
          className={
            flash.kind === 'ok'
              ? 'border-emerald-300 bg-emerald-50'
              : 'border-red-300 bg-red-50'
          }
        >
          <CardContent className="p-3 text-sm flex items-center gap-2">
            {flash.kind === 'ok' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-700" />
            )}
            <span
              className={
                flash.kind === 'ok' ? 'text-emerald-900' : 'text-red-900'
              }
            >
              {flash.msg}
            </span>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => setPreviewOpen(true)}
        >
          <Eye className="h-4 w-4 mr-1" />
          Test Mode (Bir kullanıcı için preview)
        </Button>
        <Button
          size="sm"
          disabled={pending}
          onClick={triggerSync}
          className="bg-teal-600 hover:bg-teal-700"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-1" />
          )}
          Şimdi Sync Et
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* SOL — AD GRUPLARI */}
          <Card>
            <CardContent className="p-0">
              <div className="p-3 border-b">
                <h3 className="font-semibold mb-2 text-sm">
                  AD Grupları ({groups.length})
                </h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={groupSearch}
                    onChange={(e) => setGroupSearch(e.target.value)}
                    placeholder="Grup ara..."
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="max-h-[600px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Grup CN</TableHead>
                      <TableHead className="text-right">Kişi</TableHead>
                      <TableHead>Mapping</TableHead>
                      <TableHead className="text-right">Aksiyon</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGroups.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="py-6 text-center text-sm text-muted-foreground"
                        >
                          Eşleşen grup yok
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredGroups.map((g) => (
                        <TableRow key={g.groupCN}>
                          <TableCell className="font-mono text-xs">
                            {g.groupCN}
                          </TableCell>
                          <TableCell className="text-right text-xs tabular-nums">
                            {g.userCount}
                          </TableCell>
                          <TableCell>
                            {g.hasMapping ? (
                              <Badge
                                variant="outline"
                                className={
                                  g.mappingActive
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : 'bg-gray-100 text-gray-600'
                                }
                              >
                                {g.mappedRoleName}
                                {!g.mappingActive && ' (pasif)'}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {!g.hasMapping && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={pending}
                                onClick={() => {
                                  setCreateTarget(g)
                                  setCreateOpen(true)
                                }}
                              >
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                Map
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* SAĞ — MEVCUT MAPPINGLER */}
          <Card>
            <CardContent className="p-0">
              <div className="p-3 border-b flex items-center justify-between">
                <h3 className="font-semibold text-sm">
                  Mevcut Mappingler ({mappings.length})
                </h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setCreateTarget(null)
                    setCreateOpen(true)
                  }}
                  disabled={pending}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Yeni
                </Button>
              </div>
              <div className="max-h-[600px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Grup CN</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead className="text-right">Etkili</TableHead>
                      <TableHead>Aktif</TableHead>
                      <TableHead className="text-right">Aksiyon</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappings.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="py-6 text-center text-sm text-muted-foreground"
                        >
                          Henüz mapping yok
                        </TableCell>
                      </TableRow>
                    ) : (
                      mappings.map((m) => (
                        <TableRow
                          key={m.id}
                          className={!m.isActive ? 'opacity-60' : ''}
                        >
                          <TableCell className="font-mono text-xs">
                            {m.groupCN}
                          </TableCell>
                          <TableCell className="text-sm">
                            {m.role.name}
                            <div className="text-xs text-muted-foreground font-mono">
                              {m.role.slug}
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-xs tabular-nums">
                            {m.affectedUserCount}
                          </TableCell>
                          <TableCell>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() =>
                                patchMapping(m.id, { isActive: !m.isActive })
                              }
                              className={`text-xs px-2 py-1 rounded border ${
                                m.isActive
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                  : 'bg-gray-50 border-gray-200 text-gray-600'
                              } disabled:opacity-50`}
                            >
                              {m.isActive ? 'Aktif' : 'Pasif'}
                            </button>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={pending}
                                onClick={() => setEditTarget(m)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={pending}
                                onClick={() => deleteMapping(m.id, m.groupCN)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {createOpen && (
        <CreateMappingDialog
          allRoles={allRoles}
          unmappedGroups={groups.filter((g) => !g.hasMapping)}
          initialGroupCN={createTarget?.groupCN ?? ''}
          onClose={() => {
            setCreateOpen(false)
            setCreateTarget(null)
          }}
          onSave={createMapping}
          pending={pending}
        />
      )}

      {editTarget && (
        <EditMappingDialog
          mapping={editTarget}
          allRoles={allRoles}
          onClose={() => setEditTarget(null)}
          onSave={(data) => patchMapping(editTarget.id, data)}
          pending={pending}
        />
      )}

      {previewOpen && (
        <PreviewDialog
          onClose={() => setPreviewOpen(false)}
          pending={pending}
          setPending={setPending}
        />
      )}
    </div>
  )
}

/* ===================== Modals ===================== */

function CreateMappingDialog({
  allRoles,
  unmappedGroups,
  initialGroupCN,
  onClose,
  onSave,
  pending,
}: {
  allRoles: RoleSummary[]
  unmappedGroups: ADGroup[]
  initialGroupCN: string
  onClose: () => void
  onSave: (groupCN: string, roleId: string, description: string) => void
  pending: boolean
}) {
  const [groupCN, setGroupCN] = useState(initialGroupCN)
  const [roleId, setRoleId] = useState('')
  const [description, setDescription] = useState('')

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yeni Mapping</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium block mb-1">Grup CN</label>
            {initialGroupCN ? (
              <Input value={groupCN} readOnly className="font-mono text-xs" />
            ) : (
              <select
                value={groupCN}
                onChange={(e) => setGroupCN(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              >
                <option value="">— Eşlenmemiş grup seç —</option>
                {unmappedGroups.map((g) => (
                  <option key={g.groupCN} value={g.groupCN}>
                    {g.groupCN} ({g.userCount} kişi)
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Rol</label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            >
              <option value="">— Rol seç —</option>
              {allRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.slug})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">
              Açıklama (opsiyonel)
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Bu eşlemenin amacı..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={pending}>
              İptal
            </Button>
            <Button
              disabled={pending || !groupCN || !roleId}
              onClick={() => onSave(groupCN, roleId, description)}
              className="bg-teal-600 hover:bg-teal-700"
            >
              Kaydet
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function EditMappingDialog({
  mapping,
  allRoles,
  onClose,
  onSave,
  pending,
}: {
  mapping: Mapping
  allRoles: RoleSummary[]
  onClose: () => void
  onSave: (data: {
    roleId?: string
    isActive?: boolean
    description?: string | null
  }) => void
  pending: boolean
}) {
  const [roleId, setRoleId] = useState(mapping.role.id)
  const [description, setDescription] = useState(mapping.description ?? '')

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mapping Düzenle — {mapping.groupCN}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium block mb-1">Rol</label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            >
              {allRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.slug})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Açıklama</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={pending}>
              İptal
            </Button>
            <Button
              disabled={pending}
              onClick={() => onSave({ roleId, description })}
              className="bg-teal-600 hover:bg-teal-700"
            >
              Kaydet
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function PreviewDialog({
  onClose,
  pending,
  setPending,
}: {
  onClose: () => void
  pending: boolean
  setPending: (b: boolean) => void
}) {
  const [email, setEmail] = useState('')
  const [result, setResult] = useState<PreviewResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setError(null)
    setResult(null)
    setPending(true)
    try {
      const res = await fetch('/api/admin/ldap-group-mappings/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Hata')
      } else {
        setResult(json)
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Mapping Test (Preview)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && email) run()
              }}
              placeholder="user@ilerigroup.com"
            />
            <Button disabled={pending || !email} onClick={run}>
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Önizle'
              )}
            </Button>
          </div>

          {error && (
            <div className="text-sm text-red-700 p-2 bg-red-50 border border-red-200 rounded">
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-3 text-sm">
              <div className="p-3 bg-muted rounded">
                <div className="font-medium">
                  {result.user.name ?? '—'}
                  {!result.user.isActive && (
                    <Badge variant="outline" className="ml-2 text-[10px]">
                      Pasif
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  {result.user.email}
                </div>
                <div className="text-xs mt-1">
                  AD Grupları:{' '}
                  <span className="font-mono">
                    {result.user.groups.length === 0
                      ? '—'
                      : result.user.groups.join(', ')}
                  </span>
                </div>
              </div>

              <div>
                <div className="font-medium mb-1">
                  Eşleşen mapping'ler ({result.matchingMappings.length})
                </div>
                {result.matchingMappings.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic">
                    Aktif mapping eşleşmesi yok
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {result.matchingMappings.map((m) => (
                      <Badge
                        key={`${m.groupCN}-${m.roleSlug}`}
                        variant="outline"
                        className="font-normal text-xs"
                      >
                        <span className="font-mono">{m.groupCN}</span>
                        <span className="mx-1">→</span>
                        <span>{m.roleName}</span>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="font-medium mb-1">
                  Mevcut roller ({result.currentRoles.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {result.currentRoles.map((r) => (
                    <Badge
                      key={`${r.slug}-${r.source}`}
                      variant="outline"
                      className={
                        r.source === 'azure_ad'
                          ? 'bg-blue-50 text-blue-800 border-blue-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }
                    >
                      {r.name}{' '}
                      <span className="text-[10px] ml-1">
                        ({r.source})
                      </span>
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={onClose}>
              Kapat
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
