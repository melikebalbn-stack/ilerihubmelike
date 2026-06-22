'use client'

/**
 * AltKoliDeleteModal — Onay + "geri alınamaz" uyarısı.
 *
 * Hard delete: backend cascade siler ve ana koli imhaTarihi'ni recalc eder
 * (DELETE /api/arsiv/alt-koli/[altArsivNo] mevcut davranış).
 */

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

type Props = {
  open: boolean
  onClose: () => void
  onDeleted: () => void
  altArsivNo: string
  evrakTuruAdi: string
}

export function AltKoliDeleteModal({
  open,
  onClose,
  onDeleted,
  altArsivNo,
  evrakTuruAdi,
}: Props) {
  const [submitting, setSubmitting] = useState(false)

  async function handleDelete() {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/arsiv/alt-koli/${altArsivNo}`, {
        method: 'DELETE',
      })
      const result = await res.json()
      if (!res.ok) {
        toast.error(result.error || 'Silme başarısız')
        setSubmitting(false)
        return
      }
      toast.success(`${altArsivNo} silindi`)
      onDeleted()
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle size={20} className="text-rose-600" />
            Alt Koliyi Sil
          </DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-3">
          <p className="text-sm text-slate-700">
            <strong className="font-mono">{altArsivNo}</strong>{' '}
            <span className="text-slate-500">({evrakTuruAdi})</span> alt
            kolisini silmek üzeresiniz.
          </p>
          <div className="bg-rose-50 border border-rose-200 rounded-md p-3 text-sm text-rose-800">
            <strong>Bu işlem geri alınamaz.</strong> Alt koli kalıcı olarak
            silinecek. Aktivite log&apos;unda silme kaydı kalacaktır.
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
            onClick={handleDelete}
            disabled={submitting}
            className="px-4 py-2 bg-rose-600 text-white rounded-md text-sm font-medium hover:bg-rose-700 disabled:opacity-50"
          >
            {submitting ? 'Siliniyor...' : 'Evet, Sil'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
