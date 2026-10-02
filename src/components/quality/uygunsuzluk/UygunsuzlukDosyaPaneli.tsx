'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { FileText, Loader2, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface UygunsuzlukDosya {
  id: string
  dosyaAdi: string
  dosyaUrl: string
  dosyaBoyutu: number | null
  yuklemeTarihi: string
}

function boyutGoster(b: number | null): string {
  if (!b) return ''
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

/** Uygunsuzluk kaydına döküman eki yükleme/listeleme/silme. rma/[id]/foto deseni (genel döküman). */
export function UygunsuzlukDosyaPaneli({
  uygunsuzlukId,
  initialDosyalar,
  canManage,
}: {
  uygunsuzlukId: string
  initialDosyalar: UygunsuzlukDosya[]
  canManage: boolean
}) {
  const [dosyalar, setDosyalar] = useState<UygunsuzlukDosya[]>(initialDosyalar)
  const [yukleniyor, setYukleniyor] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function dosyaSec(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    setYukleniyor(true)
    try {
      const formData = new FormData()
      for (const f of Array.from(files)) formData.append('files', f)
      const res = await fetch(`/api/quality/uygunsuzluk/${uygunsuzlukId}/dosya`, {
        method: 'POST',
        body: formData,
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || 'Yüklenemedi')
      setDosyalar(json.dosyalar ?? [])
      toast.success('Döküman yüklendi')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Hata')
    } finally {
      setYukleniyor(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function sil(dosyaId: string) {
    const onceki = dosyalar
    setDosyalar((prev) => prev.filter((d) => d.id !== dosyaId))
    const res = await fetch(`/api/quality/uygunsuzluk/dosya/${dosyaId}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Silinemedi')
      setDosyalar(onceki)
    }
  }

  return (
    <div className="rounded-md border bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Döküman Ekleri</span>
        {canManage && (
          <Button variant="outline" size="sm" disabled={yukleniyor} onClick={() => inputRef.current?.click()}>
            {yukleniyor ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
            Dosya Ekle
          </Button>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={dosyaSec}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
        />
      </div>
      {dosyalar.length === 0 ? (
        <p className="text-sm text-slate-400">Henüz döküman eklenmemiş</p>
      ) : (
        <div className="space-y-2">
          {dosyalar.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
              <a
                href={d.dosyaUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-[#1B4F72] hover:underline truncate"
              >
                <FileText className="h-4 w-4 shrink-0" />
                <span className="truncate">{d.dosyaAdi}</span>
              </a>
              <div className="flex items-center gap-2 shrink-0 text-xs text-slate-400">
                <span>{boyutGoster(d.dosyaBoyutu)}</span>
                {canManage && (
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-600" onClick={() => sil(d.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
