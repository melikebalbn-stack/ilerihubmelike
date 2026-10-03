'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MIN_TARIH, enIleriTarihTR } from '@/lib/servis-yonetimi/tarih-kurallari'

// A3 — atama kayıtlarının başlangıç/bitiş (+ neden/açıklama) düzenleme diyaloğu.
// Dört panel (varsayılan araç, varsayılan şoför, servis sorumlusu, personel
// ataması) AYNI bileşeni kullanır. Kayıt silinmez; her değişiklik tarihçede eski →
// yeni olarak görünür. Hata, diyalog AÇIKKEN kullanıcının gördüğü yerde (içeride)
// gösterilir.

export type TarihDuzenleDegerleri = {
  baslangicTarihi?: string
  bitisTarihi: string
  neden?: string
  aciklama?: string
}

const gun = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '')

export function TarihDuzenleDialog({
  baslik,
  ozet,
  baslangic,
  bitis,
  neden,
  aciklama,
  baslangicDuzenlenebilir = true,
  nedenGoster = false,
  aciklamaGoster = false,
  onKaydet,
  onKapat,
}: {
  baslik: string
  /** Hangi kaydın düzenlendiği (salt okunur satır): "SABAH_GIDIS — 41P0145 (ANA)" */
  ozet: string
  baslangic: string | null
  bitis: string | null
  neden?: string | null
  aciklama?: string | null
  baslangicDuzenlenebilir?: boolean
  nedenGoster?: boolean
  aciklamaGoster?: boolean
  /** Hata mesajı döner (diyalog açık kalır) ya da null (başarı → çağıran kapatır). */
  onKaydet: (degerler: TarihDuzenleDegerleri) => Promise<string | null>
  onKapat: () => void
}) {
  const [form, setForm] = useState({
    baslangicTarihi: gun(baslangic),
    bitisTarihi: gun(bitis),
    neden: neden ?? '',
    aciklama: aciklama ?? '',
  })
  const [hata, setHata] = useState<string | null>(null)
  const [kaydediyor, setKaydediyor] = useState(false)
  const enIleri = enIleriTarihTR()

  async function kaydet() {
    setHata(null)
    setKaydediyor(true)
    try {
      const mesaj = await onKaydet({
        ...(baslangicDuzenlenebilir ? { baslangicTarihi: form.baslangicTarihi } : {}),
        bitisTarihi: form.bitisTarihi,
        ...(nedenGoster ? { neden: form.neden } : {}),
        ...(aciklamaGoster ? { aciklama: form.aciklama } : {}),
      })
      if (mesaj) setHata(mesaj)
    } finally {
      setKaydediyor(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onKapat()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{baslik}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm font-medium">{ozet}</p>
          <p className="text-xs text-muted-foreground">
            Kayıt silinmez; değişiklik tarihçede eski → yeni olarak görünür. Bitiş tarihi boş bırakılırsa
            atama süresiz devam eder. Tarihler {MIN_TARIH} ile {enIleri} arasında olmalıdır.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="td-baslangic">Başlangıç{baslangicDuzenlenebilir ? ' *' : ''}</Label>
              <Input
                id="td-baslangic"
                type="date"
                min={MIN_TARIH}
                max={enIleri}
                value={form.baslangicTarihi}
                disabled={!baslangicDuzenlenebilir}
                onChange={(e) => setForm({ ...form, baslangicTarihi: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="td-bitis">Bitiş</Label>
              <Input
                id="td-bitis"
                type="date"
                min={form.baslangicTarihi || MIN_TARIH}
                max={enIleri}
                value={form.bitisTarihi}
                onChange={(e) => setForm({ ...form, bitisTarihi: e.target.value })}
              />
            </div>
          </div>
          {nedenGoster && (
            <div>
              <Label htmlFor="td-neden">Neden</Label>
              <Input id="td-neden" value={form.neden} onChange={(e) => setForm({ ...form, neden: e.target.value })} />
            </div>
          )}
          {aciklamaGoster && (
            <div>
              <Label htmlFor="td-aciklama">Açıklama</Label>
              <Input id="td-aciklama" value={form.aciklama} onChange={(e) => setForm({ ...form, aciklama: e.target.value })} />
            </div>
          )}
          {hata && <p role="alert" className="text-sm text-red-600">{hata}</p>}
        </div>
        <DialogFooter>
          <Button onClick={kaydet} disabled={kaydediyor}>Kaydet</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
