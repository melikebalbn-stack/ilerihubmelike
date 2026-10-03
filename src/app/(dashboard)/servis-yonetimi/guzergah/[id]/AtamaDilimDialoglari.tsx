'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { DilimOnizlemeSonucu, KapasiteEtkisiSatiri } from '@/lib/servis-yonetimi/atama-dilim'
import type { SeferDilimi } from './types'
import { jsonIstek, servisIstek } from '../../_lib/servis-istek'

// Personel atamasına sefer dilimi ekleme/çıkarma (B5): tek atama + toplu "Dilim Ata".
// Sunucu kuralları atama-dilim.ts'tedir; burada yalnız seçim, uyarı ve onay akışı var.

export const DILIMSIZ_ROZET_METNI = 'Dilim yok'

export type AtamaDilimSatiri = {
  id: string
  personnel: { adSoyad: string }
  dilimler: { dilimId: string; dilim: { id: string; kod: string; ad: string } }[]
}

function etkiMetni(e: KapasiteEtkisiSatiri): string {
  const koltuk = e.koltuk === null ? 'araç yok' : `koltuk ${e.koltuk}`
  return `${e.dilimKod}: personel ${e.once} → ${e.sonra} / ${koltuk}`
}

function AsimUyarisi({ satirlar, onay, onOnay }: { satirlar: KapasiteEtkisiSatiri[]; onay: boolean; onOnay: (v: boolean) => void }) {
  return (
    <div role="alert" className="space-y-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/20">
      <p className="flex items-center gap-2 font-medium">
        <AlertTriangle className="h-4 w-4" /> Kapasite aşılacak
      </p>
      <ul className="list-disc pl-5">
        {satirlar.map((e) => (
          <li key={e.dilimId}>{etkiMetni(e)} (+{e.fazla} kişi fazla)</li>
        ))}
      </ul>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={onay} onChange={(e) => onOnay(e.target.checked)} />
        Aşımı biliyorum, devam et
      </label>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tek atama: Dilim Düzenle
// ---------------------------------------------------------------------------
export function DilimDuzenleDialog({
  atama, dilimler, onKapat, onKaydedildi,
}: {
  atama: AtamaDilimSatiri
  /** Aktif sefer dilimleri. */
  dilimler: SeferDilimi[]
  onKapat: () => void
  onKaydedildi: () => void
}) {
  const baslangic = useMemo(() => atama.dilimler.map((d) => d.dilimId), [atama])
  const [secili, setSecili] = useState<string[]>(baslangic)
  const [hata, setHata] = useState<string | null>(null)
  const [uyari, setUyari] = useState<{ kod: 'ASIM_ONAYI_GEREKLI' | 'DILIMSIZ_ONAYI_GEREKLI'; mesaj: string; etki: KapasiteEtkisiSatiri[] } | null>(null)
  const [onay, setOnay] = useState(false)
  const [kaydediyor, setKaydediyor] = useState(false)

  // Pasif bir dilim bağlıysa checkbox listesinde yoktur; değişiklik hesabında KORUNUR (çıkarılmaz).
  const aktifIdler = dilimler.map((d) => d.id)
  const ekle = secili.filter((id) => !baslangic.includes(id))
  const cikar = baslangic.filter((id) => aktifIdler.includes(id) && !secili.includes(id))
  const degisti = ekle.length > 0 || cikar.length > 0
  const kalanSayisi = baslangic.length - cikar.length + ekle.length

  function degistir(id: string, isaretli: boolean) {
    setSecili((s) => (isaretli ? [...s, id] : s.filter((x) => x !== id)))
    setUyari(null)
    setOnay(false)
    setHata(null)
  }

  async function kaydet(onayli: boolean) {
    setKaydediyor(true)
    setHata(null)
    const sonuc = await servisIstek(
      `/api/servis-yonetimi/guzergah-personel-atama/${atama.id}/dilimler`,
      jsonIstek('PATCH', {
        ekle, cikar,
        asimOnayi: onayli && uyari?.kod === 'ASIM_ONAYI_GEREKLI' ? true : undefined,
        dilimsizOnayi: onayli && uyari?.kod === 'DILIMSIZ_ONAYI_GEREKLI' ? true : undefined,
      }),
      'Sefer dilimleri güncellenemedi.',
    )
    setKaydediyor(false)
    if (sonuc.ok) {
      onKaydedildi()
      return
    }
    const json = sonuc.json as { kod?: string; ayrinti?: { etki?: KapasiteEtkisiSatiri[] } } | null
    if (sonuc.status === 409 && (json?.kod === 'ASIM_ONAYI_GEREKLI' || json?.kod === 'DILIMSIZ_ONAYI_GEREKLI')) {
      setUyari({ kod: json.kod, mesaj: sonuc.mesaj, etki: json.ayrinti?.etki ?? [] })
      setOnay(false)
      return
    }
    setHata(sonuc.mesaj)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onKapat()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Sefer Dilimlerini Düzenle — {atama.personnel.adSoyad}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Dilim ekleme/çıkarma tarihçeye işlenir (önceki ve sonraki dilim listesi). Dilimsiz atama kapasiteye girmez.
          </p>
          <div className="space-y-1">
            {dilimler.map((d) => (
              <label key={d.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={secili.includes(d.id)} onChange={(e) => degistir(d.id, e.target.checked)} />
                {d.kod} ({d.yon === 'GIDIS' ? 'Gidiş' : 'Dönüş'})
              </label>
            ))}
          </div>
          {kalanSayisi === 0 && degisti && (
            <p role="alert" className="text-sm text-amber-700">
              Bu değişiklikle atamanın hiç sefer dilimi kalmayacak; kapasiteye girmeyecek.
            </p>
          )}
          {uyari?.kod === 'ASIM_ONAYI_GEREKLI' && <AsimUyarisi satirlar={uyari.etki} onay={onay} onOnay={setOnay} />}
          {uyari?.kod === 'DILIMSIZ_ONAYI_GEREKLI' && (
            <div role="alert" className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <p>{uyari.mesaj}</p>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={onay} onChange={(e) => setOnay(e.target.checked)} />
                Atamanın dilimsiz kalmasını onaylıyorum
              </label>
            </div>
          )}
          {hata && <p role="alert" className="text-sm text-red-600">{hata}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onKapat}>Vazgeç</Button>
          <Button onClick={() => kaydet(!!uyari)} disabled={!degisti || kaydediyor || (!!uyari && !onay)}>
            {uyari ? 'Onayla ve Uygula' : 'Kaydet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Toplu: Dilim Ata (mod: ekle) — önizleme + onay
// ---------------------------------------------------------------------------
export function TopluDilimAtaDialog({
  guzergahId, atamalar, dilimler, onKapat, onTamam,
}: {
  guzergahId: string
  atamalar: AtamaDilimSatiri[]
  dilimler: SeferDilimi[]
  onKapat: () => void
  onTamam: (sonuc: { degisen: number; degismeyen: number }) => void
}) {
  const [secili, setSecili] = useState<string[]>([])
  const [onizleme, setOnizleme] = useState<DilimOnizlemeSonucu | null>(null)
  const [onizlemeHatasi, setOnizlemeHatasi] = useState<string | null>(null)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [asimOnayi, setAsimOnayi] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  const [uyguluyor, setUyguluyor] = useState(false)
  const atamaIdleri = useMemo(() => atamalar.map((a) => a.id), [atamalar])

  useEffect(() => {
    setOnizleme(null)
    setOnizlemeHatasi(null)
    setAsimOnayi(false)
    if (secili.length === 0) return
    let iptal = false
    setYukleniyor(true)
    void servisIstek(
      `/api/servis-yonetimi/guzergah/${guzergahId}/personel-atama/dilim-onizle`,
      jsonIstek('POST', { atamaIdleri: atamaIdleri, dilimIdleri: secili }),
      'Önizleme alınamadı.',
    ).then((s) => {
      if (iptal) return
      setYukleniyor(false)
      if (s.ok) setOnizleme((s.json as { data: DilimOnizlemeSonucu }).data)
      else setOnizlemeHatasi(s.mesaj)
    })
    return () => { iptal = true }
  }, [secili, atamaIdleri, guzergahId])

  async function uygula() {
    setUyguluyor(true)
    setHata(null)
    const s = await servisIstek(
      `/api/servis-yonetimi/guzergah/${guzergahId}/personel-atama/dilim-ata`,
      jsonIstek('POST', { atamaIdleri: atamaIdleri, dilimIdleri: secili, asimOnayi }),
      'Dilimler atanamadı.',
    )
    setUyguluyor(false)
    if (s.ok) {
      onTamam((s.json as { data: { degisen: number; degismeyen: number } }).data)
      return
    }
    setHata(s.mesaj)
  }

  const secilenKodlar = dilimler.filter((d) => secili.includes(d.id)).map((d) => d.kod).join(', ')
  const uygulanabilir = !!onizleme && onizleme.degisecek > 0 && (!onizleme.asimVar || asimOnayi) && !uyguluyor

  return (
    <Dialog open onOpenChange={(o) => !o && onKapat()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Dilim Ata — {atamalar.length} atama</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Seçilen atamalara aşağıdaki sefer dilimleri EKLENİR (mevcut dilimler korunur). İşlem tek seferde uygulanır;
            bir atama başarısız olursa hiçbiri uygulanmaz. Her atama için tarihçe yazılır.
          </p>
          <div className="space-y-1">
            {dilimler.map((d) => (
              <label key={d.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={secili.includes(d.id)}
                  onChange={(e) => setSecili((s) => (e.target.checked ? [...s, d.id] : s.filter((x) => x !== d.id)))}
                />
                {d.kod} ({d.yon === 'GIDIS' ? 'Gidiş' : 'Dönüş'})
              </label>
            ))}
          </div>
          {secili.length === 0 && <p className="text-sm text-muted-foreground">Önizleme için en az bir dilim seçin.</p>}
          {yukleniyor && <p className="text-sm text-muted-foreground">Önizleme hesaplanıyor...</p>}
          {onizlemeHatasi && <p role="alert" className="text-sm text-red-600">{onizlemeHatasi}</p>}
          {onizleme && (
            <div className="space-y-2 rounded-md border p-3 text-sm" data-testid="dilim-onizleme">
              <p>
                <strong>{onizleme.atamaSayisi} atama</strong>, dilim: <strong>{secilenKodlar}</strong>
                {onizleme.zatenVar > 0 && ` (${onizleme.zatenVar} atamada zaten var, değişmeyecek)`}
              </p>
              <p className="font-medium">Kapasite etkisi:</p>
              <ul className="list-disc pl-5">
                {onizleme.etki.map((e) => (
                  <li key={e.dilimId} className={e.asim ? 'text-red-700' : undefined}>
                    {etkiMetni(e)}{e.asim ? ` — AŞIM +${e.fazla}` : ''}
                  </li>
                ))}
              </ul>
              {onizleme.degisecek === 0 && (
                <p role="alert" className="text-amber-700">Seçilen atamaların hepsinde bu dilimler zaten var; değişiklik yok.</p>
              )}
              {onizleme.asimVar && (
                <AsimUyarisi satirlar={onizleme.etki.filter((e) => e.asim)} onay={asimOnayi} onOnay={setAsimOnayi} />
              )}
            </div>
          )}
          {hata && <p role="alert" className="text-sm text-red-600">{hata}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onKapat}>Vazgeç</Button>
          <Button onClick={uygula} disabled={!uygulanabilir}>Uygula</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Dilim sütunu: bağlı dilimler ya da "Dilim yok" rozeti. */
export function DilimSutunu({ dilimler }: { dilimler: { dilim: { kod: string } }[] }) {
  if (dilimler.length === 0) {
    return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">{DILIMSIZ_ROZET_METNI}</Badge>
  }
  return <>{dilimler.map((d) => d.dilim.kod).join(', ')}</>
}
