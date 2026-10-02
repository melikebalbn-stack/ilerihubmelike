'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { etkinlikKontrolAcikMi } from '@/lib/quality/fif-termin'

export type BekleyenTalep = { id: string; istenenHedefTarih: string; mevcutHedefTarih: string | null; neden: string; talepEdenAd: string }

type Props = {
  fifId: string
  fifDurum: string
  faaliyet: {
    id: string
    sira: number
    /** Kayıtlı hedef tarih (YYYY-MM-DD) — boşsa sonuç girişi/ek termin yok. */
    kayitliHedef: string
    kapali: boolean
    sorumluUserId: string
    /** Son girilen sonuç (YT ise satır açık, KSS tekrar sonuç girebilir). */
    sonuc: string | null
    etkinlikPlanTarihi: string | null
    etkinlikUygun: boolean | null
  }
  bekleyenTalep: BekleyenTalep | null
  aktifKullaniciId: string | null
  isKss: boolean
  /** FİF iptal vb. — hiçbir işlem gösterilmez. */
  kilitli: boolean
}

const trTarih = (t: string) => new Date(t).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })
const mavi = 'bg-[#1B4F72] hover:bg-[#1B4F72]/90'

/**
 * Faaliyet satırı işlemleri (Paket 3b-2) — formdan BAĞIMSIZ, anında sunucuya gider:
 *  · Satırın SORUMLUSU: "Ek Termin İste" (formu düzenleyemese de). Paket 4: satır
 *    sorumlusu artık KAPATAMAZ.
 *  · KSS: açık satırda "Sonuç Gir" — K (Tamamlandı → satır kapanır) / YT (Yapılamadı →
 *    satır açık kalır, açıklama zorunlu); bekleyen ek termin talebine Onayla / Reddet;
 *    kapatılmış satırda plan − 7 günden itibaren "Etkinlik Kontrolü" (Uygun / Etkin
 *    değil → satır yeniden açılır).
 * Kurallar sunucuda da aynen uygulanır; buradaki koşullar yalnız butonu gösterir.
 */
export function FifFaaliyetIslemleri({ fifId, fifDurum, faaliyet: f, bekleyenTalep, aktifKullaniciId, isKss, kilitli }: Props) {
  const router = useRouter()
  const [mesgul, setMesgul] = useState(false)
  const [hata, setHata] = useState<string | null>(null)

  // Ek termin talebi
  const [talepAcik, setTalepAcik] = useState(false)
  const [istenen, setIstenen] = useState('')
  const [neden, setNeden] = useState('')
  // KSS red notu
  const [redAcik, setRedAcik] = useState(false)
  const [redNotu, setRedNotu] = useState('')
  // KSS sonuç girişi (Paket 4)
  const [sonucAcik, setSonucAcik] = useState(false)
  const [sonucSecim, setSonucSecim] = useState<'K' | 'YT' | null>(null)
  const [sonucAciklama, setSonucAciklama] = useState('')
  // KSS etkinlik kontrolü
  const [etkAcik, setEtkAcik] = useState(false)
  const [etkUygun, setEtkUygun] = useState<boolean | null>(null)
  const [etkAciklama, setEtkAciklama] = useState('')
  const [etkYeniHedef, setEtkYeniHedef] = useState('')

  if (kilitli) return null

  const faaliyetAsamasi = fifDurum === 'FAALIYET'
  const satirSahibi = !!aktifKullaniciId && f.sorumluUserId === aktifKullaniciId
  const acikVeHedefli = faaliyetAsamasi && !f.kapali && !!f.kayitliHedef
  const sonucGirebilir = isKss && acikVeHedefli
  const terminIsteyebilir = satirSahibi && acikVeHedefli && !bekleyenTalep
  const talepKarari = isKss && !!bekleyenTalep
  const etkinlikKontrolu = isKss && f.kapali && f.etkinlikUygun !== true &&
    (fifDurum === 'FAALIYET' || fifDurum === 'ETKINLIK') && etkinlikKontrolAcikMi(f.etkinlikPlanTarihi, new Date())

  async function gonder(url: string, method: 'POST' | 'PATCH', govde: unknown, basari: string): Promise<boolean> {
    setMesgul(true); setHata(null)
    try {
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: govde ? JSON.stringify(govde) : undefined })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setHata(d.error ?? 'İşlem başarısız'); return false }
      toast.success(basari)
      router.refresh()
      return true
    } catch {
      setHata('Ağ hatası')
      return false
    } finally {
      setMesgul(false)
    }
  }

  const taban = `/api/kalite/fif/${fifId}/faaliyet/${f.id}`

  if (!sonucGirebilir && !terminIsteyebilir && !talepKarari && !etkinlikKontrolu) return null

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {talepKarari && bekleyenTalep && (
        <div className="w-full rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900 flex flex-wrap items-center gap-2">
          <span className="flex-1 min-w-[200px]">
            <b>Ek termin talebi</b> ({bekleyenTalep.talepEdenAd}):{' '}
            {bekleyenTalep.mevcutHedefTarih ? trTarih(bekleyenTalep.mevcutHedefTarih) : '—'} → <b>{trTarih(bekleyenTalep.istenenHedefTarih)}</b>
            {' · '}{bekleyenTalep.neden}
          </span>
          <Button type="button" size="sm" className={mavi} disabled={mesgul}
            onClick={() => gonder(`${taban}/ek-termin/${bekleyenTalep.id}`, 'PATCH', { karar: 'ONAYLANDI' }, 'Ek termin onaylandı')}>
            Onayla
          </Button>
          <Dialog open={redAcik} onOpenChange={setRedAcik}>
            <DialogTrigger asChild>
              <Button type="button" size="sm" variant="outline" className="text-red-600 border-red-300" disabled={mesgul}>Reddet</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ek termin talebini reddet</DialogTitle>
                <DialogDescription>Faaliyet #{f.sira} — red nedeni satır sorumlusuna bildirilir.</DialogDescription>
              </DialogHeader>
              <Textarea rows={3} value={redNotu} onChange={(e) => setRedNotu(e.target.value)} placeholder="Red nedeni (zorunlu)" />
              {hata && <p className="text-sm text-red-600">{hata}</p>}
              <DialogFooter>
                <Button variant="outline" onClick={() => setRedAcik(false)} disabled={mesgul}>Vazgeç</Button>
                <Button className={mavi} disabled={mesgul || !redNotu.trim()}
                  onClick={async () => {
                    if (await gonder(`${taban}/ek-termin/${bekleyenTalep.id}`, 'PATCH', { karar: 'REDDEDILDI', kararNotu: redNotu.trim() }, 'Ek termin reddedildi')) {
                      setRedAcik(false); setRedNotu('')
                    }
                  }}>Reddet</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {terminIsteyebilir && (
        <Dialog open={talepAcik} onOpenChange={(v) => { setTalepAcik(v); if (v) { setIstenen(''); setNeden(''); setHata(null) } }}>
          <DialogTrigger asChild>
            <Button type="button" size="sm" variant="outline" disabled={mesgul}>Ek Termin İste</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ek termin iste — faaliyet #{f.sira}</DialogTitle>
              <DialogDescription>
                Mevcut hedef: {trTarih(f.kayitliHedef)}. Yeni tarih KSS onayından sonra geçerli olur; ilk hedef tarih kayıtta kalır.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">İstenen hedef tarih *</Label>
                <Input type="date" className="mt-1 h-9" value={istenen} min={f.kayitliHedef} onChange={(e) => setIstenen(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Neden *</Label>
                <Textarea rows={3} className="mt-1" value={neden} onChange={(e) => setNeden(e.target.value)} placeholder="Ek süre gerekçesi" />
              </div>
              {hata && <p className="text-sm text-red-600">{hata}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTalepAcik(false)} disabled={mesgul}>Vazgeç</Button>
              <Button className={mavi} disabled={mesgul || !istenen || !neden.trim() || istenen <= f.kayitliHedef}
                onClick={async () => {
                  if (await gonder(`${taban}/ek-termin`, 'POST', { istenenHedefTarih: istenen, neden: neden.trim() }, 'Ek termin talebi KSS\'ye gönderildi')) {
                    setTalepAcik(false)
                  }
                }}>Talebi Gönder</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {sonucGirebilir && (
        <Dialog open={sonucAcik} onOpenChange={(v) => { setSonucAcik(v); if (v) { setSonucSecim(null); setSonucAciklama(''); setHata(null) } }}>
          <DialogTrigger asChild>
            <Button type="button" size="sm" className={mavi} disabled={mesgul}>Sonuç Gir</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sonuç gir — faaliyet #{f.sira}</DialogTitle>
              <DialogDescription>
                Hedef: {trTarih(f.kayitliHedef)}.{f.sonuc === 'YT' ? ' Önceki sonuç: Yapılamadı (YT).' : ''} &quot;Tamamlandı&quot;
                seçilirse satır bugünün tarihiyle sizin parafınızla kapanır
                {bekleyenTalep ? ' ve bekleyen ek termin talebi otomatik iptal edilir' : ''}. &quot;Yapılamadı&quot; seçilirse
                satır açık kalır. Satır sorumlusu bilgilendirilir. Kaydedilmemiş form değişiklikleri varsa önce Kaydet&apos;e basın.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Button type="button" variant={sonucSecim === 'K' ? 'default' : 'outline'} className={sonucSecim === 'K' ? mavi : ''} onClick={() => setSonucSecim('K')}>Tamamlandı (K)</Button>
                <Button type="button" variant={sonucSecim === 'YT' ? 'default' : 'outline'} className={sonucSecim === 'YT' ? 'bg-red-600 hover:bg-red-600/90' : ''} onClick={() => setSonucSecim('YT')}>Yapılamadı (YT)</Button>
              </div>
              <div>
                <Label className="text-xs">Açıklama{sonucSecim === 'YT' ? ' *' : ''}</Label>
                <Textarea rows={3} className="mt-1" value={sonucAciklama} onChange={(e) => setSonucAciklama(e.target.value)}
                  placeholder={sonucSecim === 'YT' ? 'Neden yapılamadı? (zorunlu)' : 'Not (opsiyonel)'} />
              </div>
              {hata && <p className="text-sm text-red-600">{hata}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSonucAcik(false)} disabled={mesgul}>Vazgeç</Button>
              <Button className={mavi}
                disabled={mesgul || sonucSecim === null || (sonucSecim === 'YT' && !sonucAciklama.trim())}
                onClick={async () => {
                  const govde = { sonuc: sonucSecim, aciklama: sonucAciklama.trim() || undefined }
                  if (await gonder(`${taban}/sonuc`, 'POST', govde, sonucSecim === 'K' ? 'Faaliyet kapatıldı' : 'Sonuç kaydedildi: yapılamadı (YT)')) setSonucAcik(false)
                }}>Kaydet</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {etkinlikKontrolu && (
        <Dialog open={etkAcik} onOpenChange={(v) => { setEtkAcik(v); if (v) { setEtkUygun(null); setEtkAciklama(''); setEtkYeniHedef(''); setHata(null) } }}>
          <DialogTrigger asChild>
            <Button type="button" size="sm" className={mavi} disabled={mesgul}>Etkinlik Kontrolü</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Etkinlik kontrolü — faaliyet #{f.sira}</DialogTitle>
              <DialogDescription>
                Plan tarihi: {f.etkinlikPlanTarihi ? trTarih(f.etkinlikPlanTarihi) : '—'}. &quot;Etkin değil&quot; seçilirse satır
                yeniden açılır ve yeni hedef tarihle sorumlusuna döner.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Button type="button" variant={etkUygun === true ? 'default' : 'outline'} className={etkUygun === true ? mavi : ''} onClick={() => setEtkUygun(true)}>Uygun (etkin)</Button>
                <Button type="button" variant={etkUygun === false ? 'default' : 'outline'} className={etkUygun === false ? 'bg-red-600 hover:bg-red-600/90' : ''} onClick={() => setEtkUygun(false)}>Etkin değil</Button>
              </div>
              <div>
                <Label className="text-xs">Açıklama{etkUygun === false ? ' *' : ''}</Label>
                <Textarea rows={3} className="mt-1" value={etkAciklama} onChange={(e) => setEtkAciklama(e.target.value)}
                  placeholder={etkUygun === false ? 'Neden etkin değil? (zorunlu)' : 'Not (opsiyonel)'} />
              </div>
              {etkUygun === false && (
                <div>
                  <Label className="text-xs">Yeni hedef tarih *</Label>
                  <Input type="date" className="mt-1 h-9" value={etkYeniHedef} onChange={(e) => setEtkYeniHedef(e.target.value)} />
                </div>
              )}
              {hata && <p className="text-sm text-red-600">{hata}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEtkAcik(false)} disabled={mesgul}>Vazgeç</Button>
              <Button className={mavi}
                disabled={mesgul || etkUygun === null || (etkUygun === false && (!etkAciklama.trim() || !etkYeniHedef))}
                onClick={async () => {
                  const govde = etkUygun
                    ? { uygun: true, aciklama: etkAciklama.trim() || null }
                    : { uygun: false, aciklama: etkAciklama.trim(), yeniHedefTarih: etkYeniHedef }
                  if (await gonder(`${taban}/etkinlik`, 'POST', govde, etkUygun ? 'Etkinlik onaylandı' : 'Faaliyet yeniden açıldı')) setEtkAcik(false)
                }}>Kaydet</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {hata && !talepAcik && !redAcik && !etkAcik && !sonucAcik && <p className="w-full text-right text-xs text-red-600">{hata}</p>}
    </div>
  )
}
