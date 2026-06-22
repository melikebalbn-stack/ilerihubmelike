'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Lock, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { SymbolGlyph } from './SymbolGlyph'

export interface SymbolRow {
  id: string
  key: string
  nameTr: string
  nameEn: string
  svgContent: string
  displayOrder: number
  active: boolean
  isSystem: boolean
}

interface Props {
  initialSymbols: SymbolRow[]
}

interface FormState {
  key: string
  nameTr: string
  nameEn: string
  svgContent: string
  displayOrder: number
  active: boolean
}

const EMPTY_FORM: FormState = {
  key: '',
  nameTr: '',
  nameEn: '',
  svgContent: '',
  displayOrder: 0,
  active: true,
}

export function SymbolsAdminClient({ initialSymbols }: Props) {
  const router = useRouter()
  const [rows, setRows] = useState<SymbolRow[]>(initialSymbols)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<SymbolRow | null>(null)
  const [deleting, setDeleting] = useState<SymbolRow | null>(null)
  const [, startTransition] = useTransition()

  function refreshAfter() {
    startTransition(() => router.refresh())
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500">
          {rows.length} kayıt ({rows.filter((r) => r.isSystem).length} standart /{' '}
          {rows.filter((r) => !r.isSystem).length} özel)
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-[#1B4F72] hover:bg-[#1B4F72]/90"
        >
          <Plus className="h-4 w-4 mr-2" /> Yeni Sembol
        </Button>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">Glyph</TableHead>
              <TableHead>Anahtar</TableHead>
              <TableHead>TR</TableHead>
              <TableHead>EN</TableHead>
              <TableHead className="w-20 text-center">Sıra</TableHead>
              <TableHead className="w-32">Durum</TableHead>
              <TableHead className="w-24 text-right">İşlem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-slate-500 py-10">
                  Sembol bulunamadı
                </TableCell>
              </TableRow>
            ) : (
              rows.map((s) => (
                <TableRow key={s.id} className={!s.active ? 'opacity-60' : ''}>
                  <TableCell>
                    <SymbolGlyph svg={s.svgContent} className="h-7 w-7 text-slate-700" />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{s.key}</TableCell>
                  <TableCell>{s.nameTr}</TableCell>
                  <TableCell className="text-slate-500">{s.nameEn}</TableCell>
                  <TableCell className="text-center tabular-nums">{s.displayOrder}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {s.isSystem ? (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                          <Lock className="h-3 w-3 mr-1" /> Standart
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200">
                          Özel
                        </Badge>
                      )}
                      {!s.active && (
                        <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200">
                          Pasif
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing(s)}
                        title="Düzenle"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={s.isSystem}
                        onClick={() => setDeleting(s)}
                        title={s.isSystem ? 'Standart sembol silinemez' : 'Sil'}
                        className={!s.isSystem ? 'text-red-600 hover:text-red-700 hover:bg-red-50' : ''}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(s) => {
          setRows((prev) => [...prev, s].sort(sortFn))
          refreshAfter()
        }}
      />

      {editing && (
        <EditDialog
          symbol={editing}
          onOpenChange={(o) => !o && setEditing(null)}
          onUpdated={(s) => {
            setRows((prev) => prev.map((r) => (r.id === s.id ? s : r)).sort(sortFn))
            setEditing(null)
            refreshAfter()
          }}
        />
      )}

      {deleting && (
        <DeleteDialog
          symbol={deleting}
          onOpenChange={(o) => !o && setDeleting(null)}
          onDeleted={(id) => {
            setRows((prev) =>
              prev.map((r) => (r.id === id ? { ...r, active: false } : r)),
            )
            setDeleting(null)
            refreshAfter()
          }}
        />
      )}
    </>
  )
}

function sortFn(a: SymbolRow, b: SymbolRow): number {
  if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1
  return a.displayOrder - b.displayOrder
}

// ════════════════════════════════════════════════════════════
// CREATE DIALOG
// ════════════════════════════════════════════════════════════

function CreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onCreated: (s: SymbolRow) => void
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/quality/symbols', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: form.key,
          nameTr: form.nameTr,
          nameEn: form.nameEn,
          svgContent: form.svgContent,
          displayOrder: form.displayOrder,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Oluşturma başarısız')
      onCreated(json.symbol)
      toast.success(`"${json.symbol.nameTr}" oluşturuldu`)
      setForm(EMPTY_FORM)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Oluşturma başarısız')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Yeni Sembol</DialogTitle>
            <DialogDescription>
              Özel (custom) sembol oluşturur. SVG içeriği 24×24 viewBox için
              hazırlanmış path/circle/line element gövdesi olmalıdır.
            </DialogDescription>
          </DialogHeader>

          <FormFields
            form={form}
            setForm={setForm}
            keyDisabled={false}
            svgDisabled={false}
            activeVisible={false}
          />

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              İptal
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-[#1B4F72] hover:bg-[#1B4F72]/90"
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Oluştur
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ════════════════════════════════════════════════════════════
// EDIT DIALOG
// ════════════════════════════════════════════════════════════

function EditDialog({
  symbol,
  onOpenChange,
  onUpdated,
}: {
  symbol: SymbolRow
  onOpenChange: (o: boolean) => void
  onUpdated: (s: SymbolRow) => void
}) {
  const [form, setForm] = useState<FormState>({
    key: symbol.key,
    nameTr: symbol.nameTr,
    nameEn: symbol.nameEn,
    svgContent: symbol.svgContent,
    displayOrder: symbol.displayOrder,
    active: symbol.active,
  })
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        nameTr: form.nameTr,
        nameEn: form.nameEn,
        displayOrder: form.displayOrder,
      }
      if (!symbol.isSystem) {
        body.svgContent = form.svgContent
        body.active = form.active
      }

      const res = await fetch(`/api/quality/symbols/${symbol.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Güncelleme başarısız')
      onUpdated(json.symbol)
      toast.success(`"${json.symbol.nameTr}" güncellendi`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Güncelleme başarısız')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Sembolü Düzenle
              {symbol.isSystem && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                  <Lock className="h-3 w-3 mr-1" /> Standart
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {symbol.isSystem
                ? 'Standart sembollerin glyph ve durumu kilitlidir; yalnızca etiket ve sıralama değiştirilebilir.'
                : 'Özel sembol — tüm alanlar düzenlenebilir.'}
            </DialogDescription>
          </DialogHeader>

          <FormFields
            form={form}
            setForm={setForm}
            keyDisabled
            svgDisabled={symbol.isSystem}
            activeVisible={!symbol.isSystem}
          />

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              İptal
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-[#1B4F72] hover:bg-[#1B4F72]/90"
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Kaydet
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ════════════════════════════════════════════════════════════
// DELETE (soft-delete) DIALOG
// ════════════════════════════════════════════════════════════

function DeleteDialog({
  symbol,
  onOpenChange,
  onDeleted,
}: {
  symbol: SymbolRow
  onOpenChange: (o: boolean) => void
  onDeleted: (id: string) => void
}) {
  const [submitting, setSubmitting] = useState(false)

  async function handleDelete() {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/quality/symbols/${symbol.id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Silme başarısız')
      onDeleted(symbol.id)
      toast.success(`"${symbol.nameTr}" pasifleştirildi`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Silme başarısız')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sembolü pasifleştir?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>
                <strong>{symbol.nameTr}</strong> ({symbol.key}) pasifleştirilecek.
                Mevcut şablon ve raporlardaki referanslar etkilenmeyecek; yalnızca
                yeni şablon karakterlerinde seçilemez olacak.
              </p>
              <p className="text-slate-500">Hard-delete uygulanmaz.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>İptal</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleDelete()
            }}
            disabled={submitting}
            className="bg-red-600 hover:bg-red-700"
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Pasifleştir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ════════════════════════════════════════════════════════════
// SHARED FORM FIELDS
// ════════════════════════════════════════════════════════════

function FormFields({
  form,
  setForm,
  keyDisabled,
  svgDisabled,
  activeVisible,
}: {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  keyDisabled: boolean
  svgDisabled: boolean
  activeVisible: boolean
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3 items-end">
        <div className="col-span-2 space-y-1">
          <Label htmlFor="symbol-key">Anahtar (key)</Label>
          <Input
            id="symbol-key"
            value={form.key}
            onChange={(e) => setForm((p) => ({ ...p, key: e.target.value }))}
            disabled={keyDisabled}
            placeholder="ornek-kod (a-z, 0-9, _-)"
            maxLength={48}
            className="font-mono text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="symbol-order">Sıra</Label>
          <Input
            id="symbol-order"
            type="number"
            min={0}
            max={9999}
            value={form.displayOrder}
            onChange={(e) =>
              setForm((p) => ({ ...p, displayOrder: Number(e.target.value) || 0 }))
            }
            className="tabular-nums"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="symbol-name-tr">TR adı</Label>
          <Input
            id="symbol-name-tr"
            value={form.nameTr}
            onChange={(e) => setForm((p) => ({ ...p, nameTr: e.target.value }))}
            maxLength={120}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="symbol-name-en">EN adı</Label>
          <Input
            id="symbol-name-en"
            value={form.nameEn}
            onChange={(e) => setForm((p) => ({ ...p, nameEn: e.target.value }))}
            maxLength={120}
            required
          />
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label htmlFor="symbol-svg">SVG içerik (24×24 viewBox)</Label>
          {form.svgContent && (
            <div className="rounded border border-slate-200 bg-slate-50 p-1">
              <SymbolGlyph svg={form.svgContent} className="h-7 w-7 text-slate-700" />
            </div>
          )}
        </div>
        <Textarea
          id="symbol-svg"
          value={form.svgContent}
          onChange={(e) => setForm((p) => ({ ...p, svgContent: e.target.value }))}
          disabled={svgDisabled}
          rows={6}
          maxLength={8000}
          placeholder='<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.5"/>'
          className="font-mono text-xs"
          required
        />
        <p className="text-[11px] text-slate-500">
          Yalnızca SVG iç içerik. <code>currentColor</code> stroke kullan — renk
          parent text rengiyle eşleşir.
        </p>
      </div>

      {activeVisible && (
        <div className="flex items-center justify-between rounded border border-slate-200 px-3 py-2">
          <div>
            <Label className="font-normal">Aktif</Label>
            <p className="text-[11px] text-slate-500">
              Kapalıysa şablon karakter seçicide görünmez.
            </p>
          </div>
          <Switch
            checked={form.active}
            onCheckedChange={(v) => setForm((p) => ({ ...p, active: v }))}
          />
        </div>
      )}
    </div>
  )
}
