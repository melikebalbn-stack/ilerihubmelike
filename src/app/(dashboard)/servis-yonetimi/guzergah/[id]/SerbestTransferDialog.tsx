'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { KapasiteEtkisiSatiri } from '@/lib/servis-yonetimi/kapasite-asim'
import type { GuzergahDurak, SeferDilimi } from './types'
import { AsimUyarisi, etkiMetni } from './AtamaDilimDialoglari'
import { jsonIstek, servisIstek } from '../../_lib/servis-istek'
import { bugunTR } from '@/lib/servis-yonetimi/tarih-kurallari'

// SERBEST HEDEFLİ TRANSFER (C1): hedef güzergâh/durak/dilim önerilenlerle SINIRLI DEĞİL — herhangi aktif
// güzergâh + o güzergâhın durağı + aktif dilim seçilir. Hedefte kapasite etkisi önizlenir (C0), aşımda
// onay istenir. Eski atama transfer tarihiyle kapanır, yenisi açılır (tek transaction + tarihçe, sunucuda).
// Dilim zorunlu: dilimsiz atama üretilmez.

type GuzergahOzeti = { id: string; kod: string; ad: string; aktif: boolean }
const bugun = () => bugunTR() // Türkiye günü (UTC değil)

export function SerbestTransferDialog({
  atama, dilimler, onKapat, onTransferEdildi,
}: {
  atama: { id: string; guzergahId?: string; personnel: { adSoyad: string } }
  dilimler: SeferDilimi[]
  onKapat: () => void
  onTransferEdildi: () => void
}) {
  const [guzergahlar, setGuzergahlar] = useState<GuzergahOzeti[]>([])
  const [guzergahId, setGuzergahId] = useState('')
  const [duraklar, setDuraklar] = useState<GuzergahDurak[]>([])
  const [durakId, setDurakId] = useState('')
  const [dilimIdleri, setDilimIdleri] = useState<string[]>([])
  const [tarih, setTarih] = useState(bugun())
  const [etki, setEtki] = useState<KapasiteEtkisiSatiri[]>([])
  const [onizlemeHatasi, setOnizlemeHatasi] = useState<string | null>(null)
  const [asimOnayi, setAsimOnayi] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  const [uyguluyor, setUyguluyor] = useState(false)

  useEffect(() => {
    let iptal = false
    void servisIstek('/api/servis-yonetimi/guzergah?durum=aktif', undefined, 'Güzergâh listesi alınamadı.').then((s) => {
      if (iptal) return
      if (s.ok) setGuzergahlar(((s.json as { data?: GuzergahOzeti[] } | null)?.data ?? []).filter((g) => g.aktif))
      else setHata(s.mesaj)
    })
    return () => { iptal = true }
  }, [])

  useEffect(() => {
    setDurakId('')
    setDuraklar([])
    if (!guzergahId) return
    let iptal = false
    void servisIstek(`/api/servis-yonetimi/guzergah/${guzergahId}/durak`, undefined, 'Duraklar alınamadı.').then((s) => {
      if (iptal) return
      if (s.ok) setDuraklar(((s.json as { data?: GuzergahDurak[] } | null)?.data ?? []).filter((d) => d.aktif))
      else setHata(s.mesaj)
    })
    return () => { iptal = true }
  }, [guzergahId])

  const form = useMemo(
    () => ({ guzergahId, durakId: durakId || null, dilimIdleri, transferTarihi: tarih }),
    [guzergahId, durakId, dilimIdleri, tarih],
  )

  // Hedef/dilim/tarih değiştikçe sunucudan kapasite önizlemesi (yazmaz)
  useEffect(() => {
    setEtki([])
    setOnizlemeHatasi(null)
    setAsimOnayi(false)
    if (!guzergahId || dilimIdleri.length === 0 || !tarih) return
    let iptal = false
    void servisIstek(
      `/api/servis-yonetimi/guzergah-personel-atama/${atama.id}/transfer-onizle`,
      jsonIstek('POST', form),
      'Önizleme alınamadı.',
    ).then((s) => {
      if (iptal) return
      if (s.ok) setEtki((s.json as { data: { etki: KapasiteEtkisiSatiri[] } }).data.etki)
      else setOnizlemeHatasi(s.mesaj)
    })
    return () => { iptal = true }
  }, [form, guzergahId, dilimIdleri.length, tarih, atama.id])

  const asimlar = etki.filter((e) => e.asim)
  const uygulanabilir = !!guzergahId && dilimIdleri.length > 0 && !!tarih && etki.length > 0 && !onizlemeHatasi && (asimlar.length === 0 || asimOnayi) && !uyguluyor

  async function uygula() {
    setUyguluyor(true)
    setHata(null)
    const s = await servisIstek(
      `/api/servis-yonetimi/guzergah-personel-atama/${atama.id}/transfer`,
      jsonIstek('POST', { ...form, asimOnayi }),
      'Transfer gerçekleştirilemedi.',
    )
    setUyguluyor(false)
    if (s.ok) onTransferEdildi()
    else setHata(s.mesaj)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onKapat()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Başka Güzergâha Taşı — {atama.personnel.adSoyad}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Hedef, önerilenlerle sınırlı değildir: herhangi bir aktif güzergâh, durak ve sefer dilimi seçebilirsiniz.
            Eski atama transfer tarihiyle kapanır, yeni atama açılır; işlem tarihçeye yazılır.
          </p>
          <div>
            <Label htmlFor="st-guzergah">Hedef güzergâh *</Label>
            <select
              id="st-guzergah" value={guzergahId} onChange={(e) => { setGuzergahId(e.target.value); setDilimIdleri([]) }}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Güzergâh seçin</option>
              {guzergahlar.map((g) => <option key={g.id} value={g.id}>{g.kod} — {g.ad}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="st-durak">Hedef durak (opsiyonel)</Label>
            <select
              id="st-durak" value={durakId} onChange={(e) => setDurakId(e.target.value)} disabled={!guzergahId}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Belirli durak seçilmedi</option>
              {duraklar.map((d) => <option key={d.durakId} value={d.durakId}>{d.durak.kod} — {d.durak.ad}</option>)}
            </select>
          </div>
          <div>
            <Label>Sefer Dilimleri * (en az bir tane)</Label>
            <div className="space-y-1 pt-1">
              {dilimler.map((d) => (
                <label key={d.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox" checked={dilimIdleri.includes(d.id)}
                    onChange={(e) => setDilimIdleri((s) => (e.target.checked ? [...s, d.id] : s.filter((x) => x !== d.id)))}
                  />
                  {d.kod} ({d.yon === 'GIDIS' ? 'Gidiş' : 'Dönüş'})
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="st-tarih">Transfer Tarihi *</Label>
            <Input id="st-tarih" type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} />
            {tarih > bugun() && (
              <p className="pt-1 text-xs text-muted-foreground" data-testid="transfer-ileri-not">
                İleri tarihli transfer: eski atama geçiş gününe kadar aktif kalır, yeni atama {tarih} tarihinde başlar.
                Bugünün kapasitesini etkilemez.
              </p>
            )}
          </div>

          {etki.length > 0 && (
            <div className="space-y-1 rounded-md border p-3 text-sm" data-testid="transfer-etki">
              <p className="font-medium">Hedefte kapasite durumu:</p>
              <ul className="list-disc pl-5">
                {etki.map((e) => (
                  <li key={e.dilimId} className={e.asim ? 'text-red-700' : undefined}>{etkiMetni(e)}{e.asim ? ` — AŞIM +${e.fazla}` : ''}</li>
                ))}
              </ul>
            </div>
          )}
          {asimlar.length > 0 && <AsimUyarisi satirlar={asimlar} onay={asimOnayi} onOnay={setAsimOnayi} />}
          {onizlemeHatasi && <p role="alert" className="text-sm text-red-600">{onizlemeHatasi}</p>}
          {hata && <p role="alert" className="text-sm text-red-600">{hata}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onKapat}>Vazgeç</Button>
          <Button onClick={uygula} disabled={!uygulanabilir}>Transferi Uygula</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
