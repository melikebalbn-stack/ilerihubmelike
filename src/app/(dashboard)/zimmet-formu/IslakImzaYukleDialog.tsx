'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

// Tetikleyici artık dışarıda (ZimmetListesi.tsx'teki "⋯ Daha fazla" menüsünde) -
// bu bileşen sadece dialogun kendisi, open/onOpenChange dışarıdan kontrol edilir.
export function IslakImzaYukleDialog({
  open,
  onOpenChange,
  zimmetId,
  onUploaded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  zimmetId: string
  onUploaded: () => void
}) {
  const [dosya, setDosya] = useState<File | null>(null)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen)
    if (!nextOpen) {
      setDosya(null)
      setHata(null)
    }
  }

  async function handleYukle() {
    if (!dosya) return
    setYukleniyor(true)
    setHata(null)
    try {
      const formData = new FormData()
      formData.set('file', dosya)
      const res = await fetch(`/api/zimmet-formu/${zimmetId}/islak-imza-yukle`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string })
        throw new Error((data as { error?: string }).error || 'Belge yüklenemedi')
      }
      toast.success('Belge yüklendi')
      handleOpenChange(false)
      onUploaded()
    } catch (err) {
      setHata(err instanceof Error ? err.message : 'Belge yüklenemedi')
    } finally {
      setYukleniyor(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Islak imza belgesi yükle</DialogTitle>
          <DialogDescription>
            Taranmış zimmet formunu PDF, JPG veya PNG olarak yükleyin (max 10MB).
          </DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => setDosya(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
        />

        {hata && <p className="text-sm text-rose-600">{hata}</p>}

        <DialogFooter>
          <Button
            type="button"
            disabled={!dosya || yukleniyor}
            onClick={handleYukle}
            className="bg-[#1B4F72] text-white hover:bg-[#1B4F72]/90"
          >
            {yukleniyor ? 'Yükleniyor...' : 'Yükle'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
