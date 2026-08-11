'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle2, Download, FileUp, Info, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type Onizleme = {
  mod: 'onizleme' | 'uygula'
  secilenSayfa: string
  hamSatir: number
  okunanSatir: number
  gecerliSatir: number
  hataliSatir: number
  kayitSayisi: number
  satirSayisi: number
  gruplar: { ilkRow: number; isEmriNo: string; mamulUrunKodu: string; satirSayisi: number }[]
  hatalar: { row: number; message: string }[]
  uyarilar: { row: number; message: string }[]
}

/**
 * Uygunsuzluk Excel içe aktarım — RmaImportDialog deseni (önizleme → uygula).
 *
 * Önizlemede kaç BAŞLIK / kaç SATIR oluşacağı grup dökümüyle birlikte gösterilir;
 * başlık alanı çatışmaları UYARI olarak listelenir (hata değil, aktarımı durdurmaz).
 */
export function UygunsuzlukImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onImported: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState<false | 'onizleme' | 'uygula'>(false)
  const [onizleme, setOnizleme] = useState<Onizleme | null>(null)
  const [tolerans, setTolerans] = useState(false)

  function handleClose(v: boolean) {
    if (busy) return
    if (!v) {
      setFile(null)
      setOnizleme(null)
      if (inputRef.current) inputRef.current.value = ''
    }
    onOpenChange(v)
  }

  async function gonder(mod: 'onizleme' | 'uygula') {
    if (!file) return
    setBusy(mod)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const qs = new URLSearchParams({ mod })
      if (tolerans) qs.set('bolumKoduToleransi', '1')
      const res = await fetch(`/api/quality/uygunsuzluk/import?${qs}`, {
        method: 'POST',
        body: fd,
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        // Sunucu hata listesini de döndürüyorsa ekranda göster.
        if (json && Array.isArray(json.hatalar)) setOnizleme(json)
        throw new Error(json?.error || 'İşlem başarısız')
      }
      if (mod === 'onizleme') {
        setOnizleme(json)
        if (json.hatalar.length === 0) {
          toast.success(`${json.kayitSayisi} kayıt / ${json.satirSayisi} satır hazır`)
        } else {
          toast.warning(`${json.hatalar.length} hata bulundu — düzeltip tekrar deneyin`)
        }
      } else {
        toast.success(`${json.kayitSayisi} kayıt aktarıldı`)
        handleClose(false)
        onImported()
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem başarısız')
    } finally {
      setBusy(false)
    }
  }

  const hataVar = !!onizleme && onizleme.hatalar.length > 0
  const yuklenebilir = !!onizleme && onizleme.hatalar.length === 0 && onizleme.kayitSayisi > 0

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Excel&apos;den Uygunsuzluk Yükle</DialogTitle>
          <DialogDescription>
            Yalnız EKLER — mevcut kayıtları güncellemez, silmez. Önce önizleyin; hata varsa
            hiçbir şey yazılmaz.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* RmaImportDialog deseni: <a> yerine window.location — Next'in
              no-html-link-for-pages kuralı API yoluna <a> ile gitmeyi reddediyor. */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.location.href = '/api/quality/uygunsuzluk/import-sablon'
            }}
          >
            <Download className="h-4 w-4 mr-1" /> Şablonu indir
          </Button>

          <div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null)
                setOnizleme(null)
              }}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border file:border-slate-200 file:bg-slate-50 file:px-3 file:py-1.5 file:text-sm"
            />
          </div>

          {/* Bölüm kodu toleransı — kaynak dosyada HATA KODU sütunu bölüm koduyla
              doldurulmuşsa göçü bloke etmemek için. Varsayılan KAPALI. */}
          <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={tolerans}
              onChange={(e) => {
                setTolerans(e.target.checked)
                setOnizleme(null)
              }}
              className="mt-0.5"
            />
            <span>
              HATA KODU sütununda bölüm kodu varsa satırı reddetme
              <span className="block text-[11px] text-slate-500">
                Alan boş bırakılır ve uyarı üretilir — satır aktarılmaya devam eder.
              </span>
            </span>
          </label>

          {onizleme && (
            <div className="space-y-3">
              <div className="rounded-md border bg-slate-50 p-3 text-sm space-y-1">
                <div className="text-xs text-slate-500">
                  Sayfa: <strong className="font-quality-mono">{onizleme.secilenSayfa}</strong>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1">
                  <span>
                    Ham satır: <strong className="tabular-nums">{onizleme.hamSatir}</strong>
                  </span>
                  <span>
                    Okunan satır: <strong className="tabular-nums">{onizleme.okunanSatir}</strong>
                  </span>
                  <span>
                    Geçerli satır:{' '}
                    <strong className="tabular-nums">{onizleme.gecerliSatir}</strong>
                  </span>
                  <span className={onizleme.hataliSatir > 0 ? 'text-red-700' : undefined}>
                    Hatalı satır: <strong className="tabular-nums">{onizleme.hataliSatir}</strong>
                  </span>
                  <span>
                    Oluşacak kayıt:{' '}
                    <strong className="tabular-nums">{onizleme.kayitSayisi}</strong>
                  </span>
                  <span>
                    Oluşacak satır:{' '}
                    <strong className="tabular-nums">{onizleme.satirSayisi}</strong>
                  </span>
                </div>
              </div>

              {/* Grup dökümü — hangi iş emri kaç satıra toplandı */}
              {onizleme.gruplar.length > 0 && (
                <div className="rounded-md border overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 border-b text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Gruplama ({onizleme.gruplar.length} kayıt)
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                    {onizleme.gruplar.map((g, i) => (
                      <div key={i} className="px-3 py-1.5 text-sm flex items-center gap-3">
                        <span className="font-quality-mono text-xs text-slate-400 w-12 shrink-0">
                          s{g.ilkRow}
                        </span>
                        <span className="font-quality-mono text-xs">{g.isEmriNo}</span>
                        <span className="min-w-0 flex-1 truncate text-slate-600">
                          {g.mamulUrunKodu}
                        </span>
                        <span className="text-xs text-slate-500 shrink-0">
                          {g.satirSayisi} satır
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Uyarılar — HATA DEĞİL */}
              {onizleme.uyarilar?.length > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-amber-200 text-xs font-semibold text-amber-800 uppercase tracking-wide flex items-center gap-1">
                    <Info className="h-3 w-3" /> Uyarı ({onizleme.uyarilar.length}) — aktarımı
                    durdurmaz
                  </div>
                  <div className="max-h-40 overflow-y-auto divide-y divide-amber-100">
                    {onizleme.uyarilar.map((u, i) => (
                      <div key={i} className="px-3 py-1.5 text-sm text-amber-900">
                        <span className="font-quality-mono text-xs mr-2">satır {u.row}</span>
                        {u.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Hatalar */}
              {hataVar ? (
                <div className="rounded-md border border-red-200 bg-red-50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-red-200 text-xs font-semibold text-red-800 uppercase tracking-wide flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Hata ({onizleme.hatalar.length}) —
                    düzeltilmeden aktarılamaz
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-red-100">
                    {onizleme.hatalar.map((h, i) => (
                      <div key={i} className="px-3 py-1.5 text-sm text-red-900">
                        <span className="font-quality-mono text-xs mr-2">satır {h.row}</span>
                        {h.message}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Hata yok — aktarıma hazır
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={!!busy}>
            Kapat
          </Button>
          <Button variant="outline" onClick={() => gonder('onizleme')} disabled={!file || !!busy}>
            {busy === 'onizleme' && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Önizle
          </Button>
          <Button
            onClick={() => gonder('uygula')}
            disabled={!yuklenebilir || !!busy}
            className="bg-[#1B4F72] hover:bg-[#1B4F72]/90"
          >
            {busy === 'uygula' ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <FileUp className="h-4 w-4 mr-1" />
            )}
            Aktar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
