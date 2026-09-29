'use client'

// MASTER Madde 46 — Şikâyet listesi (Adım 5A).
//
// SALT LİSTE: oluşturma butonu ve durum geçişi aksiyonları BU ADIMDA YOK
// (Adım 5B). Ekranda ikinci bir filtreleme YAPILMAZ — filtreler uca
// gönderilir, sorgu katmanı süzer (rule 6).
//
// 🔴 Durum RENKLE DEĞİL ETİKETLE ayrılır; renk yalnız destektir. Renk körü
// bir kullanıcı ya da gri basılmış bir çıktı da durumu okuyabilmeli.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, Plus } from 'lucide-react'
// 🔴 Geçiş matrisi ve durum etiketleri TEK KAYNAK: Adım 1'in durum makinesi.
// Ekranda ikinci bir hedef listesi ya da etiket sözlüğü YAZILMADI (rule 6).
// Dosya prisma'dan yalnız TİP alıyor, istemciye güvenle gider.
import {
  izinliHedefler,
  SIKAYET_DURUM_ETIKETLERI,
  SIKAYET_KATEGORI_ETIKETLERI,
  sikayetKategoriEtiketi,
  SIKAYET_KAYNAK_ETIKETLERI,
} from '@/lib/servis-yonetimi/sikayet-durum'
// Paylaşılan tarihçe dialogu — 13 tanım modeliyle AYNI bileşen (rule 6).
import { ServisGecmisDialog, GecmisButonu } from '../_components/ServisGecmisDialog'
import { SikayetciSecici } from './_components/SikayetciSecici'

type Durum = 'ACIK' | 'AKSIYON_ALINDI' | 'KAPANDI' | 'REDDEDILDI'

type SikayetSatiri = {
  id: string
  no: number
  tarih: string
  bildirimTarihi: string
  kategori: string
  durum: Durum
  kaynak: string
  guzergahId: string
  durakId: string | null
  durak: { id: string; kod: string; ad: string } | null
  sikayetciPersonnelId?: string | null
  sikayetci?: { id: string; sicilNo: string | null; adSoyad: string; bolum: string | null } | null
  sorumlu?: { id: string; sicilNo: string | null; adSoyad: string; bolum: string | null } | null
}

type Secenek = { id: string; kod?: string | null; ad: string }

/** Durum etiketleri — Adım 1'deki TEK KAYNAK'tan. Renk YALNIZ destek. */
const DURUM_ETIKET = SIKAYET_DURUM_ETIKETLERI

/**
 * Geçiş BUTONU etiketi — hedef duruma göre EYLEM dili.
 * Hangi hedeflerin görüneceğini bu sözlük DEĞİL, izinliHedefler() belirler;
 * burası yalnız metin.
 */
const GECIS_BUTON_ETIKET: Record<Durum, string> = {
  ACIK: 'Yeniden aç',
  AKSIYON_ALINDI: 'Aksiyon alındı',
  KAPANDI: 'Kapat',
  REDDEDILDI: 'Reddet',
}

const DURUM_RENK: Record<Durum, string> = {
  ACIK: 'bg-amber-100 text-amber-900',
  AKSIYON_ALINDI: 'bg-blue-100 text-blue-900',
  KAPANDI: 'bg-green-100 text-green-900',
  REDDEDILDI: 'bg-slate-200 text-slate-800',
}


function gunMetni(deger: string | null | undefined): string {
  if (!deger) return '-'
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(deger)
  return m ? m[1] : deger
}

function etiket(s: Secenek): string {
  return s.kod ? `${s.kod} — ${s.ad}` : s.ad
}

export default function SikayetListesiPage() {
  const { data: session } = useSession()
  const permissions = session?.user?.permissions || []
  const canView = permissions.includes('servis.sikayet.view')
  const canManage = permissions.includes('servis.sikayet.manage')
  // Tarihçe AYRI eksen: modülün mevcut servis.history anahtarı kullanılıyor,
  // şikâyete özgü yeni bir anahtar açılmadı.
  const canHistory = permissions.includes('servis.history')

  const [guzergahId, setGuzergahId] = useState('')
  const [durakId, setDurakId] = useState('')
  const [durum, setDurum] = useState('')
  const [kategori, setKategori] = useState('')
  const [kaynak, setKaynak] = useState('')
  const [bildirimBaslangic, setBildirimBaslangic] = useState('')
  const [bildirimBitis, setBildirimBitis] = useState('')

  const [guzergahlar, setGuzergahlar] = useState<Secenek[]>([])
  const [duraklar, setDuraklar] = useState<Secenek[]>([])

  const [satirlar, setSatirlar] = useState<SikayetSatiri[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)

  // ── Oluşturma formu ──
  const [formAcik, setFormAcik] = useState(false)
  const [formHata, setFormHata] = useState<string | null>(null)
  const [gonderiliyor, setGonderiliyor] = useState(false)
  // 🔴 kaynak ÖN SEÇİLİ DEĞİL: şemada default yok ve bu bilinçli. Ön seçili
  // gelseydi kullanıcı düşünmeden onaylar, "İV" sanılan kayıtlar personel
  // şikâyeti gibi görünürdü. Boş kalırsa uç zaten 400 döner.
  const [fKaynak, setFKaynak] = useState('')
  const [fGuzergah, setFGuzergah] = useState('')
  const [fKategori, setFKategori] = useState('')
  const [fTarih, setFTarih] = useState('')
  const [fBildirim, setFBildirim] = useState('')
  const [fAciklama, setFAciklama] = useState('')
  const [fSikayetci, setFSikayetci] = useState('')
  const [fDurak, setFDurak] = useState('')
  const [fPlanlananSaat, setFPlanlananSaat] = useState('')
  const [fTermin, setFTermin] = useState('')

  // ── Durum geçişi ──
  const [gecisKaydi, setGecisKaydi] = useState<SikayetSatiri | null>(null)
  const [gecisHedef, setGecisHedef] = useState<Durum | null>(null)
  const [gecisAksiyon, setGecisAksiyon] = useState('')
  const [gecisNot, setGecisNot] = useState('')
  const [gecisHata, setGecisHata] = useState<string | null>(null)
  const [gecisGonderiliyor, setGecisGonderiliyor] = useState(false)

  // ── Tarihçe dialogu ──
  const [gecmisKaydi, setGecmisKaydi] = useState<SikayetSatiri | null>(null)

  const sorguDizesi = useMemo(() => {
    const p = new URLSearchParams()
    if (guzergahId) p.set('guzergahId', guzergahId)
    if (durakId) p.set('durakId', durakId)
    if (durum) p.set('durum', durum)
    if (kategori) p.set('kategori', kategori)
    if (kaynak) p.set('kaynak', kaynak)
    if (bildirimBaslangic) p.set('bildirimBaslangic', bildirimBaslangic)
    if (bildirimBitis) p.set('bildirimBitis', bildirimBitis)
    return p.toString()
  }, [guzergahId, durakId, durum, kategori, kaynak, bildirimBaslangic, bildirimBitis])

  useEffect(() => {
    if (!canView) return
    let iptal = false
    ;(async () => {
      for (const [url, kur] of [
        ['/api/servis-yonetimi/guzergah?durum=aktif', setGuzergahlar],
        ['/api/servis-yonetimi/durak?durum=aktif', setDuraklar],
      ] as const) {
        try {
          const res = await fetch(url)
          const json = await res.json()
          if (!iptal && res.ok && json.ok) kur(json.data ?? [])
        } catch {
          // Seçenek listesi alınamazsa seçici boş kalır; ekran çökmez.
        }
      }
    })()
    return () => {
      iptal = true
    }
  }, [canView])

  const yukle = useCallback(async () => {
    setYukleniyor(true)
    setHata(null)
    try {
      const res = await fetch(`/api/servis-yonetimi/sikayet${sorguDizesi ? `?${sorguDizesi}` : ''}`)
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setHata(json.message || 'Şikâyet listesi alınamadı.')
        setSatirlar([])
        return
      }
      setSatirlar(json.data ?? [])
    } catch {
      setHata('Şikâyet listesi alınırken beklenmeyen bir hata oluştu.')
      setSatirlar([])
    } finally {
      setYukleniyor(false)
    }
  }, [sorguDizesi])

  useEffect(() => {
    if (!canView) return
    yukle()
  }, [canView, yukle])

  function formuSifirla() {
    setFKaynak(''); setFGuzergah(''); setFKategori(''); setFTarih('')
    setFBildirim(''); setFAciklama(''); setFSikayetci(''); setFDurak('')
    setFPlanlananSaat(''); setFTermin(''); setFormHata(null)
  }

  // 🔴 DOĞRULAMA EKRANDA TEKRAR EDİLMEZ. Zorunluluk işaretleri yalnız
  // kullanıcı kolaylığı; asıl otorite uç. Uçtan gelen 400 mesajı OLDUĞU GİBİ
  // gösterilir — Adım 1/2'nin yol gösteren metni kendi cümlemizle
  // değiştirilmez.
  async function sikayetGonder() {
    setGonderiliyor(true)
    setFormHata(null)
    try {
      const res = await fetch('/api/servis-yonetimi/sikayet', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          guzergahId: fGuzergah,
          kaynak: fKaynak,
          kategori: fKategori,
          tarih: fTarih,
          bildirimTarihi: fBildirim,
          aciklama: fAciklama,
          sikayetciPersonnelId: fSikayetci || null,
          durakId: fDurak || null,
          planlananSaat: fPlanlananSaat || null,
          termin: fTermin || null,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setFormHata(json.message || 'Şikâyet kaydedilemedi.')
        return
      }
      formuSifirla()
      setFormAcik(false)
      await yukle()
    } catch {
      setFormHata('Şikâyet kaydedilirken beklenmeyen bir hata oluştu.')
    } finally {
      setGonderiliyor(false)
    }
  }

  async function gecisGonder() {
    if (!gecisKaydi || !gecisHedef) return
    setGecisGonderiliyor(true)
    setGecisHata(null)
    try {
      const bugun = new Date().toISOString().slice(0, 10)
      const govde: Record<string, unknown> = { durum: gecisHedef }
      if (gecisHedef === 'AKSIYON_ALINDI') {
        govde.aksiyon = gecisAksiyon
        govde.aksiyonTarihi = bugun
      }
      if (gecisHedef === 'KAPANDI' || gecisHedef === 'REDDEDILDI') {
        govde.kapanisTarihi = bugun
        govde.kapanisNotu = gecisNot || null
      }

      const res = await fetch(`/api/servis-yonetimi/sikayet/${gecisKaydi.id}/durum`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(govde),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setGecisHata(json.message || 'Durum güncellenemedi.')
        return
      }
      setGecisKaydi(null); setGecisHedef(null); setGecisAksiyon(''); setGecisNot('')
      await yukle()
    } catch {
      setGecisHata('Durum güncellenirken beklenmeyen bir hata oluştu.')
    } finally {
      setGecisGonderiliyor(false)
    }
  }

  // 🔴 "Yetki yok" hâli, "kayıt yok" hâlinden AYRI ve ilk sırada.
  if (!canView) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Servis Şikâyetleri</h1>
        <p className="mt-2 text-sm text-muted-foreground">Bu sayfayı görüntüleme yetkiniz yok.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Servis Şikâyetleri</h1>
          <p className="text-sm text-muted-foreground">
            Servis kullanımına dair şikâyet ve uygunsuzluk kayıtları.
          </p>
        </div>
        {/* Oluşturma yalnız servis.sikayet.manage ile görünür. */}
        {canManage && (
          <Button size="sm" onClick={() => setFormAcik(a => !a)}>
            <Plus className="mr-2 h-4 w-4" />
            Yeni Şikâyet
          </Button>
        )}
      </div>

      {canManage && formAcik && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Yeni Şikâyet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <Label htmlFor="f-kaynak">Kaynak *</Label>
                <select
                  id="f-kaynak" value={fKaynak} onChange={e => setFKaynak(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {/* 🔴 Ön seçili değer YOK — bilinçli. */}
                  <option value="">Seçiniz</option>
                  {Object.entries(SIKAYET_KAYNAK_ETIKETLERI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="f-guzergah">Güzergâh *</Label>
                <select
                  id="f-guzergah" value={fGuzergah} onChange={e => setFGuzergah(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Seçiniz</option>
                  {guzergahlar.map(g => <option key={g.id} value={g.id}>{etiket(g)}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="f-kategori">Kategori *</Label>
                <select
                  id="f-kategori" value={fKategori} onChange={e => setFKategori(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Seçiniz</option>
                  {Object.entries(SIKAYET_KATEGORI_ETIKETLERI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="f-tarih">Olay tarihi *</Label>
                <input id="f-tarih" type="date" value={fTarih} onChange={e => setFTarih(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <Label htmlFor="f-bildirim">Bildirim tarihi *</Label>
                <input id="f-bildirim" type="date" value={fBildirim} onChange={e => setFBildirim(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                {/* 🔴 Zorunluluk işareti KAYNAĞA göre değişir: çalışan kendi
                    bildirdiyse kimlik zaten biliniyor. Kural uçta da var. */}
                <SikayetciSecici
                  value={fSikayetci}
                  zorunlu={fKaynak === 'PERSONEL'}
                  onChange={(personnelId) => setFSikayetci(personnelId)}
                />
              </div>
              <div>
                <Label htmlFor="f-durak">Durak</Label>
                <select
                  id="f-durak" value={fDurak} onChange={e => setFDurak(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Yok</option>
                  {duraklar.map(d => <option key={d.id} value={d.id}>{etiket(d)}</option>)}
                </select>
              </div>
              <div>
                {/* Otomatik doldurma YOK (Melih kararı) — İV elle girer. */}
                <Label htmlFor="f-saat">Planlanan saat</Label>
                <input id="f-saat" value={fPlanlananSaat} onChange={e => setFPlanlananSaat(e.target.value)}
                  placeholder="07:15"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <Label htmlFor="f-termin">Termin</Label>
                <input id="f-termin" type="date" value={fTermin} onChange={e => setFTermin(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <Label htmlFor="f-aciklama">Açıklama *</Label>
              <textarea
                id="f-aciklama" value={fAciklama} onChange={e => setFAciklama(e.target.value)} rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>

            {/* Uçtan gelen mesaj OLDUĞU GİBİ — yeniden yazılmaz. */}
            {formHata && <p className="text-sm text-red-600">{formHata}</p>}

            <div className="flex gap-2">
              <Button size="sm" onClick={sikayetGonder} disabled={gonderiliyor}>
                {gonderiliyor ? 'Kaydediliyor…' : 'Kaydet'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setFormAcik(false); formuSifirla() }}>
                Vazgeç
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {canManage && gecisKaydi && gecisHedef && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              #{gecisKaydi.no} → {DURUM_ETIKET[gecisHedef]}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {gecisHedef === 'AKSIYON_ALINDI' && (
              <div>
                <Label htmlFor="g-aksiyon">Aksiyon *</Label>
                <textarea id="g-aksiyon" rows={2} value={gecisAksiyon} onChange={e => setGecisAksiyon(e.target.value)}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
            )}
            {(gecisHedef === 'REDDEDILDI' || gecisHedef === 'KAPANDI') && (
              <div>
                <Label htmlFor="g-not">
                  Kapanış notu {gecisHedef === 'REDDEDILDI' ? '* (ret gerekçesi)' : '(opsiyonel)'}
                </Label>
                <textarea id="g-not" rows={2} value={gecisNot} onChange={e => setGecisNot(e.target.value)}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
            )}
            {gecisHedef === 'ACIK' && (
              <p className="text-sm text-muted-foreground">
                Kayıt yeniden açılacak. Kapanış tarihi ve notu temizlenir; aksiyon kaydı korunur.
              </p>
            )}

            {gecisHata && <p className="text-sm text-red-600">{gecisHata}</p>}

            <div className="flex gap-2">
              <Button size="sm" onClick={gecisGonder} disabled={gecisGonderiliyor}>
                {gecisGonderiliyor ? 'Uygulanıyor…' : 'Uygula'}
              </Button>
              <Button size="sm" variant="outline"
                onClick={() => { setGecisKaydi(null); setGecisHedef(null); setGecisHata(null) }}>
                Vazgeç
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Filtreler</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="filtre-guzergah">Güzergâh</Label>
            <select
              id="filtre-guzergah" value={guzergahId} onChange={e => setGuzergahId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Tümü</option>
              {guzergahlar.map(g => <option key={g.id} value={g.id}>{etiket(g)}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="filtre-durak">Durak</Label>
            <select
              id="filtre-durak" value={durakId} onChange={e => setDurakId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Tümü</option>
              {duraklar.map(d => <option key={d.id} value={d.id}>{etiket(d)}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="filtre-durum">Durum</Label>
            <select
              id="filtre-durum" value={durum} onChange={e => setDurum(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Tümü</option>
              {(Object.keys(DURUM_ETIKET) as Durum[]).map(d => (
                <option key={d} value={d}>{DURUM_ETIKET[d]}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="filtre-kategori">Kategori</Label>
            <select
              id="filtre-kategori" value={kategori} onChange={e => setKategori(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Tümü</option>
              {Object.entries(SIKAYET_KATEGORI_ETIKETLERI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="filtre-kaynak">Kaynak</Label>
            <select
              id="filtre-kaynak" value={kaynak} onChange={e => setKaynak(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Tümü</option>
              {Object.entries(SIKAYET_KAYNAK_ETIKETLERI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="filtre-baslangic">Bildirim başlangıç</Label>
            <input
              id="filtre-baslangic" type="date" value={bildirimBaslangic}
              onChange={e => setBildirimBaslangic(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <Label htmlFor="filtre-bitis">Bildirim bitiş</Label>
            <input
              id="filtre-bitis" type="date" value={bildirimBitis}
              onChange={e => setBildirimBitis(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {yukleniyor ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : hata ? (
        // 🔴 Hata hâli — "kayıt yok" ile karıştırılmasın.
        <p className="text-sm text-red-600">{hata}</p>
      ) : satirlar.length === 0 ? (
        // 🔴 Boş liste hâli — yetki yok ve hata hâllerinden AYRI metin.
        <p className="text-sm text-muted-foreground">
          Bu filtrelerle eşleşen şikâyet kaydı yok.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No</TableHead>
              <TableHead>Olay tarihi</TableHead>
              <TableHead>Bildirim tarihi</TableHead>
              <TableHead>Güzergâh</TableHead>
              <TableHead>Durak</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead>Şikâyetçi</TableHead>
              <TableHead>Sorumlu</TableHead>
              {(canManage || canHistory) && <TableHead>İşlem</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {satirlar.map(s => (
              <TableRow key={s.id}>
                <TableCell className="font-mono">{s.no}</TableCell>
                <TableCell>{gunMetni(s.tarih)}</TableCell>
                <TableCell>{gunMetni(s.bildirimTarihi)}</TableCell>
                <TableCell>{s.guzergahId}</TableCell>
                <TableCell>{s.durak ? `${s.durak.kod} — ${s.durak.ad}` : '-'}</TableCell>
                <TableCell>{sikayetKategoriEtiketi(s.kategori)}</TableCell>
                <TableCell>
                  {/* Etiket metni tek başına yeterli; renk yalnız destek. */}
                  <Badge className={DURUM_RENK[s.durum]} variant="secondary">
                    {DURUM_ETIKET[s.durum] ?? s.durum}
                  </Badge>
                </TableCell>
                <TableCell>{s.sikayetci?.adSoyad ?? '-'}</TableCell>
                <TableCell>{s.sorumlu?.adSoyad ?? '-'}</TableCell>
                {(canManage || canHistory) && (
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {canHistory && <GecmisButonu onClick={() => setGecmisKaydi(s)} />}
                      {/* 🔴 Hedefler MATRİSTEN geliyor (Adım 1). Ekranda ikinci
                          bir liste yok: kapalı bir kayıtta "Kapat" butonu
                          ÜRETİLEMEZ, çünkü izinliHedefler onu döndürmez. */}
                      {canManage && izinliHedefler(s.durum).map(hedef => (
                        <Button
                          key={hedef} size="sm" variant="outline"
                          onClick={() => {
                            setGecisKaydi(s); setGecisHedef(hedef)
                            setGecisAksiyon(''); setGecisNot(''); setGecisHata(null)
                          }}
                        >
                          {GECIS_BUTON_ETIKET[hedef]}
                        </Button>
                      ))}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {canHistory && gecmisKaydi && (
        <ServisGecmisDialog
          open={Boolean(gecmisKaydi)}
          onOpenChange={a => { if (!a) setGecmisKaydi(null) }}
          baslik={`#${gecmisKaydi.no} — Şikâyet geçmişi`}
          hedefTipi="SIKAYET"
          hedefId={gecmisKaydi.id}
        />
      )}
    </div>
  )
}
