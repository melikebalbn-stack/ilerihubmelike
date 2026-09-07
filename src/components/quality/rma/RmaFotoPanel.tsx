'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * RMA/SMA fotoğraf paneli — çoklu görsel yükleme/silme (KAL-KYT-16 revizyonu).
 *
 * YALNIZ mevcut kayıtta gösterilir; /yeni ekranında "önce kaydedin" notu çıkar
 * (kayıt id'si olmadan dosya ilişkilendirilemez).
 *
 * Görseller /api/files/... üzerinden OTURUM KONTROLLÜ servis edilir; doğrudan
 * statik URL yok. Yükleme/silme yalnız canManage (rma.manage / kalite ekibi).
 */
export interface RmaFotoOzet {
  id: string
  dosyaYolu: string
  dosyaAdi: string
  mimeType: string
  createdAt: string
}

interface Props {
  rmaKayitId: string
  initial: RmaFotoOzet[]
  canManage: boolean
}

export function RmaFotoPanel({ rmaKayitId, initial, canManage }: Props) {
  const [fotolar, setFotolar] = useState<RmaFotoOzet[]>(initial)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [silinenId, setSilinenId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function dosyaSecildi(e: React.ChangeEvent<HTMLInputElement>) {
    const secilen = Array.from(e.target.files ?? [])
    // input'u hemen sıfırla: aynı dosya arka arkaya seçilebilsin.
    e.target.value = ''
    if (secilen.length === 0) return

    const fd = new FormData()
    for (const f of secilen) fd.append('files', f)

    setYukleniyor(true)
    try {
      const res = await fetch(`/api/quality/rma/${rmaKayitId}/foto`, { method: 'POST', body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error ?? `Yüklenemedi (HTTP ${res.status})`)
      }
      const json = await res.json()
      setFotolar(json.fotolar ?? [])
      toast.success(`${secilen.length} fotoğraf yüklendi`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fotoğraf yüklenemedi')
    } finally {
      setYukleniyor(false)
    }
  }

  async function sil(id: string) {
    setSilinenId(id)
    try {
      const res = await fetch(`/api/quality/rma/foto/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error ?? `Silinemedi (HTTP ${res.status})`)
      }
      setFotolar((p) => p.filter((f) => f.id !== id))
      toast.success('Fotoğraf silindi')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fotoğraf silinemedi')
    } finally {
      setSilinenId(null)
    }
  }

  return (
    <div className="rounded-md border bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-slate-700">Fotoğraflar ({fotolar.length})</h2>
        {canManage && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={dosyaSecildi}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={yukleniyor}
              onClick={() => inputRef.current?.click()}
            >
              {yukleniyor ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Yükleniyor…</>
              ) : (
                <><ImagePlus className="h-4 w-4 mr-1" />Fotoğraf Ekle</>
              )}
            </Button>
          </>
        )}
      </div>

      {fotolar.length === 0 ? (
        <p className="text-sm text-slate-500">
          Henüz fotoğraf yok.{canManage ? ' Görsel dosyası ekleyebilirsiniz (en fazla 10MB).' : ''}
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {fotolar.map((f) => (
            <div key={f.id} className="group relative rounded-md border border-slate-200 overflow-hidden">
              <a href={f.dosyaYolu} target="_blank" rel="noopener noreferrer" title={f.dosyaAdi}>
                <Image
                  src={f.dosyaYolu}
                  alt={f.dosyaAdi}
                  width={240}
                  height={160}
                  unoptimized
                  className="h-28 w-full object-cover bg-slate-50"
                />
              </a>
              <div className="px-2 py-1 text-[11px] text-slate-500 truncate" title={f.dosyaAdi}>
                {f.dosyaAdi}
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={() => sil(f.id)}
                  disabled={silinenId === f.id}
                  aria-label={`${f.dosyaAdi} sil`}
                  className="absolute top-1 right-1 rounded bg-white/90 p-1 text-red-600 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-red-50 disabled:opacity-60"
                >
                  {silinenId === f.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Trash2 className="h-4 w-4" />}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
