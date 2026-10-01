'use client'

import { useState } from 'react'
import { AlertTriangle, Check, Loader2, Printer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export interface EtiketPayload {
  stokKodu: string
  stokAdi: string
  miktar: number
  birim: string
  lot?: string
  girisTarihi: string
  kaynakBilgi: string
  lokasyon: string
  kaynakModul: string
}

/**
 * "Etiket Yazdır" — adet sorusu + kalıcı-barkod uyarısı + tekrar-basma koruması.
 * Her basım route'ta adet kadar AYRI IFS barkodu üretir (kalıcı). payload null ise pasif.
 */
export function EtiketYazdirButton({ payload, buyuk }: { payload: EtiketPayload | null; buyuk?: boolean }) {
  const [acik, setAcik] = useState(false)
  const [onayAcik, setOnayAcik] = useState(false)
  const [adet, setAdet] = useState('1')
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  const [basildi, setBasildi] = useState(false)

  const adetNum = Math.min(50, Math.max(1, Math.floor(Number(adet) || 1)))

  const diyaloguAc = () => {
    setHata(null)
    setAdet('1')
    setAcik(true)
  }

  const bas = async () => {
    if (!payload || yukleniyor) return
    setYukleniyor(true)
    setHata(null)
    try {
      const res = await fetch('/api/depo/etiket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, adet: adetNum }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        // Route'un mesajı (üretilen kalıcı ID'ler dahil) olduğu gibi gösterilir.
        setHata(data?.error ?? `Etiket üretilemedi (HTTP ${res.status})`)
        return
      }
      const url = URL.createObjectURL(await res.blob())
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
      setBasildi(true)
      setAcik(false)
    } catch {
      setHata('Bağlantı hatası — tekrar deneyin')
    } finally {
      setYukleniyor(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={!payload}
        onClick={() => (basildi ? setOnayAcik(true) : diyaloguAc())}
        className={cn(
          'w-full gap-2',
          buyuk ? 'min-h-14 rounded-2xl text-base' : 'min-h-10 rounded-xl text-sm',
          basildi && 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-50',
        )}
      >
        {basildi ? <Check className={buyuk ? 'h-5 w-5' : 'h-4 w-4'} /> : <Printer className={buyuk ? 'h-5 w-5' : 'h-4 w-4'} />}
        {basildi ? 'Basıldı' : 'Etiket Yazdır'}
      </Button>

      {/* Basım diyaloğu — adet + kalıcı-barkod uyarısı */}
      <Dialog open={acik} onOpenChange={(o) => { if (!yukleniyor) setAcik(o) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Etiket Yazdır</DialogTitle>
          </DialogHeader>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Kalıcı barkod üretilir</AlertTitle>
            <AlertDescription>
              Her etiket için IFS&apos;te benzersiz barkod numarası üretilir. Bu numaralar kalıcıdır, silinemez.
            </AlertDescription>
          </Alert>
          <div className="flex items-center gap-3">
            <label htmlFor="etiket-adet" className="text-sm font-medium">Adet</label>
            <Input
              id="etiket-adet"
              type="number"
              min={1}
              max={50}
              value={adet}
              onChange={(e) => setAdet(e.target.value)}
              disabled={yukleniyor}
              className="w-24"
            />
            <span className="text-xs text-muted-foreground">1–50</span>
          </div>
          {hata && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="whitespace-pre-wrap break-words">{hata}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAcik(false)} disabled={yukleniyor}>
              Vazgeç
            </Button>
            <Button type="button" onClick={bas} disabled={yukleniyor} className="gap-2">
              {yukleniyor && <Loader2 className="h-4 w-4 animate-spin" />}
              {yukleniyor ? `${adetNum} etiket üretiliyor…` : `${adetNum} etiket bas`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tekrar-basma onayı — kazara ikinci tıklama yeni barkod doğurmasın */}
      <AlertDialog open={onayAcik} onOpenChange={setOnayAcik}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tekrar bas?</AlertDialogTitle>
            <AlertDialogDescription>
              Yeni (kalıcı) barkod numarası üretilecek. Devam edilsin mi?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={diyaloguAc}>Devam</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
