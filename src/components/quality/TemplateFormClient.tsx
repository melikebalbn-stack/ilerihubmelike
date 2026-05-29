'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Save, Power } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { FormTopBar } from './FormTopBar'
import { CardNumbered } from './CardNumbered'
import { StickyFormFooter } from './StickyFormFooter'

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

export function TemplateFormClient({
  initial,
  symbols,
  canDeactivate = false,
}: Props) {
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

  // ════════ FormTopBar + StickyFormFooter content ════════

  const topBarMeta = [
    { label: 'Parça Adı', value: meta.partName || '—' },
    { label: 'Resim No', value: meta.drawingNo || '—' },
    { label: 'Revizyon', value: meta.revision || '—' },
  ]

  const topBarActions = (
    <>
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="text-white/90 hover:bg-white/10 hover:text-white border border-white/25"
      >
        <Link href="/kalite/sablonlar">
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Şablonlar
        </Link>
      </Button>
      {isEdit && initial.active && canDeactivate && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={saving}
              className="text-white/90 hover:bg-white/10 hover:text-white border border-white/25"
            >
              <Power className="h-3.5 w-3.5 mr-1.5" /> Pasifleştir
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Şablon pasifleştirilsin mi?</AlertDialogTitle>
              <AlertDialogDescription>
                Bu şablon{' '}
                {initial.reportCount > 0
                  ? `${initial.reportCount} rapor üretti — `
                  : ''}
                pasifleştirilse de eski raporlar (snapshot) etkilenmez. Sadece
                bundan sonra yeni rapor oluşturulamaz.
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
    </>
  )

  const footerStatus: React.ReactNode = saving
    ? 'Kaydediliyor...'
    : dirty
      ? 'Kaydedilmemiş değişiklik var'
      : isEdit
        ? 'Şablon güncel'
        : 'Yeni şablon — kaydetmek için aşağıdaki butona tıklayın'

  const footerActions = (
    <>
      <Button asChild variant="outline" disabled={saving} size="sm" className="h-9">
        <Link href="/kalite/sablonlar">Vazgeç</Link>
      </Button>
      <Button
        type="button"
        onClick={handleSubmit}
        disabled={saving}
        size="sm"
        className="bg-[#1B4F72] hover:bg-[#1B4F72]/90 h-9"
      >
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
        ) : (
          <Save className="h-3.5 w-3.5 mr-1.5" />
        )}
        {isEdit ? 'Kaydet' : 'Şablonu Kaydet'}
      </Button>
    </>
  )

  return (
    <div className="min-h-screen bg-slate-100 pb-20">
      <FormTopBar
        formNo={meta.formNo || 'F18.8511'}
        title={isEdit ? meta.partName || 'Şablon Düzenle' : 'Yeni Şablon'}
        subtitle="Measurement Template"
        meta={topBarMeta}
        actions={topBarActions}
      />

      <div className="mx-auto max-w-[1500px] px-6 pt-7 flex flex-col gap-4">
        {isEdit && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            {initial.active ? (
              <Badge variant="default" className="bg-emerald-600">
                Aktif
              </Badge>
            ) : (
              <Badge variant="outline">Pasif</Badge>
            )}
            {initial.reportCount > 0 && (
              <span>
                Bu şablon <strong>{initial.reportCount}</strong> rapor üretti
              </span>
            )}
          </div>
        )}

        {isEdit && initial.reportCount > 0 && (
          <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <strong>Bilgi:</strong> Bu şablonu güncellersen, mevcut raporlar
            etkilenmez (her rapor karakterleri snapshot olarak tutar).
            Değişiklik sadece bundan sonra oluşturulacak raporları etkiler.
          </div>
        )}

        {/* ═══ Card 1 — Şablon Bilgileri ═══ */}
        <CardNumbered
          number={1}
          title="Şablon Bilgileri"
          hint="Form no, parça kimliği ve revizyon"
        >
          <TemplateMetaForm
            value={meta}
            onChange={markDirty(setMeta)}
            errors={errors}
          />
        </CardNumbered>

        {/* ═══ Card 2 — Karakteristikler ═══ */}
        <CardNumbered
          number={2}
          title="Karakteristikler"
          hint={
            <span>
              Sol kutu kritik (<span className="text-amber-700 font-bold">*</span>) işareti ·
              Karakter alanından GD&amp;T sembolü seçilir
            </span>
          }
        >
          <CharacteristicsBuilder
            value={chars}
            onChange={markDirty(setChars)}
            symbols={symbols}
          />
        </CardNumbered>
      </div>

      <StickyFormFooter
        status={footerStatus}
        statusTone={saving ? 'saving' : dirty ? 'idle' : 'saved'}
        actions={footerActions}
      />
    </div>
  )
}
