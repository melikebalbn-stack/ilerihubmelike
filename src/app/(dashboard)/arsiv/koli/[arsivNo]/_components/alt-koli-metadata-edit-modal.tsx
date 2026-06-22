'use client'

/**
 * AltKoliMetadataEditModal — PATCH endpoint kısıtı nedeniyle dar kapsam.
 *
 * Sadece: aciklama, hazirlayan, evrakSayisi, gizlilikSeviyesi
 * Evrak türü / dönem / saklama süresini değiştirmek için "sil + yeniden ekle"
 * pattern'i kullanılmalı (info banner ile yönlendirme).
 */

import { useEffect, useState } from 'react'
import { Info } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

type Gizlilik = 'KamuyaAcik' | 'SirketIci' | 'Gizli' | 'CokGizli'

type Props = {
  open: boolean
  onClose: () => void
  onSaved: () => void
  altArsivNo: string
  initial: {
    aciklama: string | null
    hazirlayan: string | null
    evrakSayisi: number | null
    gizlilikSeviyesi: Gizlilik
  }
}

export function AltKoliMetadataEditModal({
  open,
  onClose,
  onSaved,
  altArsivNo,
  initial,
}: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [aciklama, setAciklama] = useState(initial.aciklama ?? '')
  const [hazirlayan, setHazirlayan] = useState(initial.hazirlayan ?? '')
  const [evrakSayisi, setEvrakSayisi] = useState<number | null>(
    initial.evrakSayisi
  )
  const [gizlilik, setGizlilik] = useState<Gizlilik>(initial.gizlilikSeviyesi)

  useEffect(() => {
    if (open) {
      setAciklama(initial.aciklama ?? '')
      setHazirlayan(initial.hazirlayan ?? '')
      setEvrakSayisi(initial.evrakSayisi)
      setGizlilik(initial.gizlilikSeviyesi)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, altArsivNo])

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {}
      if (aciklama !== (initial.aciklama ?? '')) {
        body.aciklama = aciklama || null
      }
      if (hazirlayan !== (initial.hazirlayan ?? '')) {
        body.hazirlayan = hazirlayan || null
      }
      if (evrakSayisi !== initial.evrakSayisi) {
        body.evrakSayisi = evrakSayisi
      }
      if (gizlilik !== initial.gizlilikSeviyesi) {
        body.gizlilikSeviyesi = gizlilik
      }

      if (Object.keys(body).length === 0) {
        toast.info('Hiçbir alan değişmedi')
        setSubmitting(false)
        onClose()
        return
      }

      const res = await fetch(`/api/arsiv/alt-koli/${altArsivNo}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await res.json()

      if (!res.ok) {
        toast.error(result.error || 'Güncelleme başarısız')
        setSubmitting(false)
        return
      }

      toast.success(`${altArsivNo} güncellendi`)
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{altArsivNo} — Düzenle</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800 flex gap-2">
            <Info size={16} className="flex-shrink-0 mt-0.5" />
            <span>
              Bu form sadece açıklama, hazırlayan, evrak sayısı ve gizlilik
              düzenler. Evrak türü, dönem veya saklama süresini değiştirmek
              için alt koliyi silip yeniden ekleyin.
            </span>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Açıklama
            </label>
            <textarea
              value={aciklama}
              onChange={(e) => setAciklama(e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Hazırlayan
              </label>
              <input
                type="text"
                value={hazirlayan}
                onChange={(e) => setHazirlayan(e.target.value)}
                maxLength={150}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Evrak Sayısı
              </label>
              <input
                type="number"
                min={0}
                value={evrakSayisi ?? ''}
                onChange={(e) => {
                  const raw = e.target.value
                  if (raw === '') setEvrakSayisi(null)
                  else {
                    const v = Number(raw)
                    setEvrakSayisi(
                      Number.isInteger(v) && v >= 0 ? v : null
                    )
                  }
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Gizlilik Seviyesi
            </label>
            <select
              value={gizlilik}
              onChange={(e) => setGizlilik(e.target.value as Gizlilik)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
            >
              <option value="KamuyaAcik">Kamuya Açık</option>
              <option value="SirketIci">Şirket İçi</option>
              <option value="Gizli">Gizli</option>
              <option value="CokGizli">Çok Gizli</option>
            </select>
          </div>
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
            {submitting ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
