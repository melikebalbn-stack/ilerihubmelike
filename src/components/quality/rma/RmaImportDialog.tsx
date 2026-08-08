'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle2, Download, FileUp, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface MusteriOzet {
  musteriKodu: string
  musteriAd: string
  kayit: number
  satir: number
}
interface Onizleme {
  mod: 'onizleme' | 'uygula'
  kayitSayisi: number
  satirSayisi: number
  musteriOzet: MusteriOzet[]
  hatalar: { row: number; message: string }[]
}

export function RmaImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onImported: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState<false | 'onizleme' | 'uygula'>(false)
  const [onizleme, setOnizleme] = useState<Onizleme | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setFile(null)
    setOnizleme(null)
    setBusy(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleClose(v: boolean) {
    if (busy) return
    if (!v) reset()
    onOpenChange(v)
  }

  function pickFile(f: File | null) {
    setFile(f)
    setOnizleme(null) // yeni dosya → önizleme sıfırlanır
  }

  async function gonder(mod: 'onizleme' | 'uygula') {
    if (!file) return
    setBusy(mod)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/quality/rma/import?mod=${mod}`, { method: 'POST', body: fd })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        // Doğrulama sonucu (özet+hata) döndüyse göster; değilse tek mesaj.
        if (json && Array.isArray(json.hatalar)) setOnizleme(json)
        toast.error(json?.error ?? `Aktarım hatası (HTTP ${res.status})`)
        return
      }
      if (mod === 'onizleme') {
        setOnizleme(json)
        if (json.hatalar.length === 0) toast.success(`${json.kayitSayisi} kayıt / ${json.satirSayisi} satır hazır`)
        else toast.warning(`${json.hatalar.length} hata bulundu — düzeltip tekrar deneyin`)
      } else {
        const aralik = json.noAralik ? ` (No ${json.noAralik.min}–${json.noAralik.max})` : ''
        toast.success(`${json.olusturulan} kayıt oluşturuldu${aralik}`)
        reset()
        onOpenChange(false)
        onImported()
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Beklenmeyen hata')
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
          <DialogTitle>Excel&apos;den RMA/SMA Yükle</DialogTitle>
          <DialogDescription>
            Yalnız yeni kayıt ekler. Önce şablonu doldurun, önizleyin; hata yoksa yükleyin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Şablon + dosya seçimi */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.location.href = '/api/quality/rma/import-sablon'
              }}
            >
              <Download className="h-4 w-4 mr-1" /> Şablon indir
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              className="text-sm file:mr-2 file:rounded-md file:border file:border-slate-300 file:bg-slate-50 file:px-3 file:py-1.5 file:text-sm"
            />
          </div>

          {file && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <FileUp className="h-4 w-4" /> {file.name} ({(file.size / 1024).toFixed(0)} KB)
            </div>
          )}

          {/* Önizleme özeti */}
          {onizleme && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-4 rounded-md border bg-slate-50 p-3 text-sm">
                <span><b>{onizleme.kayitSayisi}</b> kayıt</span>
                <span><b>{onizleme.satirSayisi}</b> ürün satırı</span>
                <span className={hataVar ? 'text-red-600 font-semibold' : 'text-green-700'}>
                  {onizleme.hatalar.length} hata
                </span>
              </div>

              {onizleme.musteriOzet.length > 0 && (
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="px-2 py-1 text-left font-semibold text-slate-600">Müşteri</th>
                        <th className="px-2 py-1 text-right font-semibold text-slate-600">Kayıt</th>
                        <th className="px-2 py-1 text-right font-semibold text-slate-600">Satır</th>
                      </tr>
                    </thead>
                    <tbody>
                      {onizleme.musteriOzet.map((m) => (
                        <tr key={m.musteriKodu} className="border-b last:border-0">
                          <td className="px-2 py-1">
                            <span className="font-mono text-slate-500">{m.musteriKodu}</span> {m.musteriAd}
                          </td>
                          <td className="px-2 py-1 text-right tabular-nums">{m.kayit}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{m.satir}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {hataVar ? (
                <div className="rounded-md border border-red-200 bg-red-50 p-3">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-red-700 mb-2">
                    <AlertTriangle className="h-4 w-4" /> Hatalar ({onizleme.hatalar.length})
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-red-700/70">
                          <th className="px-2 py-1 text-left w-20">Excel Satır</th>
                          <th className="px-2 py-1 text-left">Hata</th>
                        </tr>
                      </thead>
                      <tbody>
                        {onizleme.hatalar.map((h, i) => (
                          <tr key={i} className="border-t border-red-100">
                            <td className="px-2 py-1 tabular-nums font-mono">{h.row}</td>
                            <td className="px-2 py-1 text-red-800">{h.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-sm text-green-700">
                  <CheckCircle2 className="h-4 w-4" /> Hata yok — yükleyebilirsiniz.
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => handleClose(false)} disabled={!!busy}>
            İptal
          </Button>
          <Button variant="outline" onClick={() => gonder('onizleme')} disabled={!file || !!busy}>
            {busy === 'onizleme' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            Önizle
          </Button>
          <Button
            onClick={() => gonder('uygula')}
            disabled={!yuklenebilir || !!busy}
            className="bg-[#1B4F72] hover:bg-[#1B4F72]/90"
          >
            {busy === 'uygula' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            Yükle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
