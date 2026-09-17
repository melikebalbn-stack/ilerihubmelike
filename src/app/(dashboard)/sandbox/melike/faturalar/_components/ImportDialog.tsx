'use client'

import { useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download, Upload } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}

interface ImportResult {
  total: number
  created: number
  skipped: number
  errored: number
  results: { row: number; invoiceNumber?: string; status: string; message?: string }[]
}

export function ImportDialog({ open, onOpenChange, onImported }: Props) {
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/sandbox/melike/faturalar/import', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'İçe aktarma başarısız')
        return
      }
      setResult(data)
      onImported()
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setResult(null); setError(null) } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[#1B4F72]">Excel İçe / Dışa Aktar</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-2">
            <a href="/api/sandbox/melike/faturalar/export">
              <Button variant="outline" size="sm">
                <Download className="mr-1.5 h-3.5 w-3.5" /> Tüm Faturaları İndir
              </Button>
            </a>
            <a href="/api/sandbox/melike/faturalar/export?template=1">
              <Button variant="outline" size="sm">
                <Download className="mr-1.5 h-3.5 w-3.5" /> Boş Şablon İndir
              </Button>
            </a>
            <a href="/api/sandbox/melike/faturalar/export?type=summary">
              <Button variant="outline" size="sm">
                <Download className="mr-1.5 h-3.5 w-3.5" /> KPI Özet İndir
              </Button>
            </a>
          </div>
          <p className="text-xs text-muted-foreground/80">
            "KPI Özet" her ay + bölüm için ayrı satır verir: € tutar, ₺ tutar, ciro (€) ve cironun oranı — sayısal,
            yuvarlanmamış. KPI dosyana çekmek için bunu kullan.
          </p>

          <div>
            <p className="mb-2 text-xs text-muted-foreground">
              Şablondaki (veya indirdiğin fatura listesindeki) başlıkları koru: <strong>Tarih, Firma, Fatura No,
              Tutar</strong> zorunlu; Para Birimi (varsayılan TRY) ve Bölüm (varsayılan Genel) opsiyonel. €
              karşılığı içe aktarımda otomatik yeniden hesaplanır.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              disabled={uploading}
              className="block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-[#EAF1F6] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#1B4F72]"
            />
            {uploading && <p className="mt-2 text-xs text-muted-foreground">Yükleniyor ve TCMB kurları hesaplanıyor...</p>}
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          {result && (
            <div className="rounded-md border bg-muted/40 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[#1B4F72]">
                <Upload className="h-3.5 w-3.5" />
                {result.total} satırdan {result.created} kaydedildi, {result.skipped} atlandı, {result.errored} hatalı
              </div>
              {result.results.some((r) => r.status !== 'created') && (
                <div className="max-h-48 space-y-1 overflow-y-auto text-xs">
                  {result.results
                    .filter((r) => r.status !== 'created')
                    .map((r) => (
                      <div key={r.row} className="flex items-start gap-1.5">
                        <span className="font-mono text-muted-foreground">Satır {r.row}</span>
                        <span className={r.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}>
                          {r.invoiceNumber ? `(${r.invoiceNumber}) ` : ''}
                          {r.message}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
