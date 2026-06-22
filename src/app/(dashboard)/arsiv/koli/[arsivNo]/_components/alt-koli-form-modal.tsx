'use client'

/**
 * AltKoliFormModal — Sadece ekle modu.
 *
 * AltKoliRow component'ini reuse eder (showHarf=false ile). Dönem default
 * ana koli'den, kullanıcı override edebilir. EvrakTuruSelect içindeki pending
 * pattern POST endpoint'ine pendingEvrakTuru olarak gönderilir.
 *
 * Düzenleme için ayrı modal (AltKoliMetadataEditModal) kullanılır — PATCH
 * endpoint sadece metadata destekliyor.
 */

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import AltKoliRow, {
  type AltKoliFormData,
} from '@/app/(dashboard)/arsiv/_components/alt-koli-row'

type PendingEvrakTuru = {
  tempId: string
  ad: string
  varsayilanSaklamaYili: number
  yasalDayanak?: string | null
}

type Props = {
  open: boolean
  onClose: () => void
  onSaved: () => void
  arsivNo: string
  bolumId: number
  /** Ana koli dönem aralığı (yyyy-mm-dd veya ISO) — default değer için */
  anaKoliDonemBaslangic: string
  anaKoliDonemSonu: string
}

export function AltKoliFormModal({
  open,
  onClose,
  onSaved,
  arsivNo,
  bolumId,
  anaKoliDonemBaslangic,
  anaKoliDonemSonu,
}: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<
    Partial<Record<keyof AltKoliFormData, string>>
  >({})
  const [pendingEvrakTuru, setPendingEvrakTuru] =
    useState<PendingEvrakTuru | null>(null)

  function buildInitialData(): AltKoliFormData {
    return {
      uid:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `tmp-${Date.now()}`,
      harf: '',
      evrakTuru: null,
      donemBaslangic: anaKoliDonemBaslangic.split('T')[0],
      donemSonu: anaKoliDonemSonu.split('T')[0],
      saklamaSuresiYil: 10,
      _saklamaManuelOverride: false,
      aciklama: '',
      hazirlayan: '',
      evrakSayisi: null,
      gizlilikSeviyesi: 'SirketIci',
    }
  }

  const [data, setData] = useState<AltKoliFormData>(() => buildInitialData())

  useEffect(() => {
    if (open) {
      setData(buildInitialData())
      setErrors({})
      setPendingEvrakTuru(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function validate(): boolean {
    const e: Partial<Record<keyof AltKoliFormData, string>> = {}
    if (!data.evrakTuru) e.evrakTuru = 'Evrak türü zorunlu'
    if (
      !Number.isInteger(data.saklamaSuresiYil) ||
      data.saklamaSuresiYil < 1 ||
      data.saklamaSuresiYil > 100
    ) {
      e.saklamaSuresiYil = '1-100 yıl arası olmalı'
    }
    if (!data.donemBaslangic) e.donemBaslangic = 'Dönem başlangıcı zorunlu'
    if (!data.donemSonu) e.donemSonu = 'Dönem sonu zorunlu'
    if (
      data.donemBaslangic &&
      data.donemSonu &&
      data.donemSonu < data.donemBaslangic
    ) {
      e.donemSonu = 'Dönem sonu başlangıçtan önce olamaz'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) {
      toast.error('Form hatalı, kontrol edin')
      return
    }
    setSubmitting(true)
    try {
      const evrakField =
        data.evrakTuru!.kind === 'existing'
          ? { evrakTuruId: data.evrakTuru!.id }
          : {
              pendingEvrakTuru: {
                ad: data.evrakTuru!.ad,
                varsayilanSaklamaYili: data.evrakTuru!.varsayilanSaklamaYili,
                yasalDayanak: data.evrakTuru!.yasalDayanak ?? undefined,
              },
            }

      const body = {
        ...evrakField,
        saklamaSuresiYil: data.saklamaSuresiYil,
        donemBaslangic: data.donemBaslangic,
        donemSonu: data.donemSonu,
        aciklama: data.aciklama || null,
        hazirlayan: data.hazirlayan || null,
        evrakSayisi: data.evrakSayisi,
        gizlilikSeviyesi: data.gizlilikSeviyesi,
      }

      const res = await fetch(`/api/arsiv/koli/${arsivNo}/alt-koli`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await res.json()

      if (!res.ok) {
        toast.error(result.error || 'İşlem başarısız')
        setSubmitting(false)
        return
      }

      const altArsivNo = result.altKoli?.altArsivNo ?? ''
      if (result.yeniEvrakTuru) {
        toast.success(
          `${altArsivNo} eklendi — yeni evrak türü "${result.yeniEvrakTuru.ad}" eklendi`
        )
      } else {
        toast.success(`${altArsivNo} eklendi`)
      }

      onSaved()
    } catch {
      toast.error('Beklenmeyen hata')
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !submitting) onClose()
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Yeni Alt Koli Ekle</DialogTitle>
        </DialogHeader>

        <div className="py-2">
          <AltKoliRow
            data={data}
            onChange={setData}
            onRemove={() => {}}
            canRemove={false}
            bolumId={bolumId}
            errors={errors}
            pendingEvrakTurleri={pendingEvrakTuru ? [pendingEvrakTuru] : []}
            onCreateEvrakTuruPending={(d) => {
              const tempId =
                typeof crypto !== 'undefined' && 'randomUUID' in crypto
                  ? `temp-${crypto.randomUUID()}`
                  : `temp-${Date.now()}`
              setPendingEvrakTuru({
                tempId,
                ad: d.ad,
                varsayilanSaklamaYili: d.varsayilanSaklamaYili,
                yasalDayanak: d.yasalDayanak ?? null,
              })
              return tempId
            }}
            showHarf={false}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 border border-slate-300 rounded-md text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? 'Kaydediliyor...' : 'Ekle'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
