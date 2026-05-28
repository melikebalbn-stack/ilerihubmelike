'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { TemplateMetaForm, type TemplateMetaValue } from './TemplateMetaForm'
import {
  CharacteristicsBuilder,
  makeEmptyChar,
  type TemplateCharRow,
} from './CharacteristicsBuilder'
import type { SymbolOption } from './SymbolPicker'

export interface InitialTemplate {
  id: string | null // null = yeni
  formNo: string
  partName: string
  drawingNo: string
  revision: string
  department: string | null
  notes: string | null
  active: boolean
  reportCount: number
  characteristics: Array<{
    id?: string
    orderIndex: number
    department: string | null
    inspectionTool: string | null
    sampleFreq: string | null
    critical: boolean
    symbolId: string | null
    charName: string
    nominal: string | null
    maxValue: string | null
    minValue: string | null
    hasNumericRange: boolean
  }>
}

interface Props {
  initial: InitialTemplate
  symbols: SymbolOption[]
  canDeactivate?: boolean
}

export function TemplateFormClient({ initial, symbols, canDeactivate = false }: Props) {
  const router = useRouter()
  const isEdit = initial.id !== null

  const [meta, setMeta] = useState<TemplateMetaValue>({
    formNo: initial.formNo || 'F18.8511',
    partName: initial.partName,
    drawingNo: initial.drawingNo,
    revision: initial.revision || 'A',
    department: initial.department,
    notes: initial.notes,
  })

  const [chars, setChars] = useState<TemplateCharRow[]>(() =>
    initial.characteristics.length > 0
      ? initial.characteristics.map((c) => ({
          _key: `init-${c.id ?? c.orderIndex}`,
          ...c,
        }))
      : [makeEmptyChar(1)],
  )

  const [errors, setErrors] = useState<Partial<Record<keyof TemplateMetaValue, string>>>({})
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!dirty) return
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  function validate(): boolean {
    const next: Partial<Record<keyof TemplateMetaValue, string>> = {}
    if (!meta.formNo.trim()) next.formNo = 'Zorunlu'
    if (!meta.partName.trim()) next.partName = 'Zorunlu'
    if (!meta.drawingNo.trim()) next.drawingNo = 'Zorunlu'
    if (!meta.revision.trim()) next.revision = 'Zorunlu'
    setErrors(next)
    if (chars.length === 0) {
      toast.error('En az 1 karakter eklenmeli')
      return false
    }
    for (const c of chars) {
      if (!c.charName.trim()) {
        toast.error(`Sıra ${c.orderIndex}: karakter adı zorunlu`)
        return false
      }
    }
    return Object.keys(next).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setSaving(true)
    try {
      const body = {
        formNo: meta.formNo.trim(),
        partName: meta.partName.trim(),
        drawingNo: meta.drawingNo.trim(),
        revision: meta.revision.trim(),
        department: meta.department,
        notes: meta.notes,
        characteristics: chars.map((c) => ({
          orderIndex: c.orderIndex,
          department: c.department,
          inspectionTool: c.inspectionTool,
          sampleFreq: c.sampleFreq,
          critical: c.critical,
          symbolId: c.symbolId,
          charName: c.charName.trim(),
          nominal: c.nominal ? c.nominal.replace(',', '.') : null,
          maxValue: c.maxValue ? c.maxValue.replace(',', '.') : null,
          minValue: c.minValue ? c.minValue.replace(',', '.') : null,
          hasNumericRange: c.hasNumericRange,
        })),
      }

      const url = isEdit
        ? `/api/quality/templates/${initial.id}`
        : '/api/quality/templates'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json?.error || 'Kaydetme başarısız')
      }

      setDirty(false)
      toast.success(isEdit ? 'Şablon güncellendi' : 'Şablon oluşturuldu')

      const id = isEdit ? initial.id : json.template?.id
      if (!isEdit && id) router.push(`/kalite/sablonlar/${id}`)
      else router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate() {
    if (!initial.id) return
    setSaving(true)
    try {
      const res = await fetch(`/api/quality/templates/${initial.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error || 'Pasifleştirme başarısız')
      }
      toast.success('Şablon pasifleştirildi')
      router.push('/kalite/sablonlar')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  function markDirty<T>(setter: (v: T) => void): (v: T) => void {
    return (v) => {
      setDirty(true)
      setter(v)
    }
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-3 text-slate-500">
            <Link href="/kalite/sablonlar">
              <ArrowLeft className="h-4 w-4 mr-1" /> Şablonlar
            </Link>
          </Button>
          <h1 className="text-2xl font-bold text-[#1B4F72] mt-1">
            {isEdit ? meta.partName || 'Şablon Düzenle' : 'Yeni Şablon'}
          </h1>
          {isEdit && (
            <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
              {initial.active ? (
                <Badge variant="default" className="bg-emerald-600">Aktif</Badge>
              ) : (
                <Badge variant="outline">Pasif</Badge>
              )}
              {initial.reportCount > 0 && (
                <span>
                  • Bu şablon <strong>{initial.reportCount}</strong> rapor üretti
                </span>
              )}
            </div>
          )}
        </div>
        {isEdit && initial.active && canDeactivate && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={saving}>
                Pasifleştir
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Şablon pasifleştirilsin mi?</AlertDialogTitle>
                <AlertDialogDescription>
                  Bu şablon {initial.reportCount > 0 ? `${initial.reportCount} rapor üretti — ` : ''}
                  pasifleştirilse de eski raporlar (snapshot) etkilenmez. Sadece bundan
                  sonra yeni rapor oluşturulamaz.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>İptal</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeactivate}>
                  Evet, pasifleştir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {isEdit && initial.reportCount > 0 && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <strong>Bilgi:</strong> Bu şablonu güncellersen, mevcut raporlar etkilenmez
          (her rapor karakterleri snapshot olarak tutar). Değişiklik sadece bundan
          sonra oluşturulacak raporları etkiler.
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Şablon Bilgileri</CardTitle>
        </CardHeader>
        <CardContent>
          <TemplateMetaForm value={meta} onChange={markDirty(setMeta)} errors={errors} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Karakteristikler</CardTitle>
        </CardHeader>
        <CardContent>
          <CharacteristicsBuilder
            value={chars}
            onChange={markDirty(setChars)}
            symbols={symbols}
          />
        </CardContent>
      </Card>

      <div className="fixed bottom-0 inset-x-0 bg-white border-t shadow-lg z-20">
        <div className="container mx-auto px-6 py-3 flex items-center justify-end gap-3 max-w-7xl">
          <Button asChild variant="outline" disabled={saving}>
            <Link href="/kalite/sablonlar">Vazgeç</Link>
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="bg-[#1B4F72] hover:bg-[#1B4F72]/90"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isEdit ? 'Kaydet' : 'Şablonu Kaydet'}
          </Button>
        </div>
      </div>
    </div>
  )
}
