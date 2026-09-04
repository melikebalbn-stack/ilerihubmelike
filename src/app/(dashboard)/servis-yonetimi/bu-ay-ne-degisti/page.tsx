'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

// FAZ 1B-EK Madde 31 — "Bu Ay Ne Değişti?" ekranı, Adım 3 (UI, son adım).
// Adım 2'deki GET /api/servis-yonetimi/bu-ay-ne-degisti'yi çağırır, sade bir
// liste/kart ekranı (grafik/recharts YOK — bir özet listesi yeterli).

const AY_ADLARI = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
]

type PersonelOzeti = { personnelId: string; adSoyad: string; sicilNo: string | null; bolum: string }
type YeniServisKullanicisi = PersonelOzeti & { guzergahKod: string; guzergahAd: string; tarih: string }
type ServistenAyrilan = PersonelOzeti & { guzergahKod: string; guzergahAd: string; tarih: string }
type ServisDegistiren = PersonelOzeti & {
  eskiGuzergahKod: string
  eskiGuzergahAd: string
  yeniGuzergahKod: string
  yeniGuzergahAd: string
  tarih: string
}
type DurakDegistiren = PersonelOzeti & {
  guzergahKod: string
  guzergahAd: string
  eskiDurakKod: string | null
  eskiDurakAd: string | null
  yeniDurakKod: string | null
  yeniDurakAd: string | null
  tarih: string
}
type VardiyaDegistiren = PersonelOzeti & { guzergahKod: string; guzergahAd: string; tarih: string }
type AracDegisenServis = { guzergahKod: string; guzergahAd: string; dilimKod: string; eskiPlaka: string | null; yeniPlaka: string; tarih: string }
type SoforDegisenServis = { guzergahKod: string; guzergahAd: string; dilimKod: string; eskiAdSoyad: string | null; yeniAdSoyad: string; tarih: string }

type BuAyNeDegistiSonucu = {
  yil: number
  ay: number
  yeniServisKullanicilari: YeniServisKullanicisi[]
  servistenAyrilanlar: ServistenAyrilan[]
  servisDegistirenler: ServisDegistiren[]
  durakDegistirenler: DurakDegistiren[]
  aracDegisenServisler: AracDegisenServis[]
  soforDegisenServisler: SoforDegisenServis[]
  adresDegisiklikleri: { kapsamDisi: boolean; not: string }
  vardiyaDegistirenler: VardiyaDegistiren[]
  yeniKapasiteRiskleri: null
  bosalanKapasite: null
}

function tarihGoster(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('tr-TR')
}

function BosListe({ mesaj }: { mesaj: string }) {
  return <p className="text-sm text-muted-foreground">{mesaj}</p>
}

export default function BuAyNeDegistiPage() {
  const { data: session } = useSession()
  const permissions = session?.user?.permissions || []
  const canView = permissions.includes('servis.view')

  const simdi = new Date()
  const [yil, setYil] = useState(simdi.getFullYear())
  const [ay, setAy] = useState(simdi.getMonth() + 1)
  const [veri, setVeri] = useState<BuAyNeDegistiSonucu | null>(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)

  const yukle = useCallback(async () => {
    setYukleniyor(true)
    setHata(null)
    try {
      const res = await fetch(`/api/servis-yonetimi/bu-ay-ne-degisti?yil=${yil}&ay=${ay}`)
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setHata(json.message || 'Rapor alınamadı.')
        return
      }
      setVeri(json.data)
    } catch {
      setHata('Rapor alınırken beklenmeyen bir hata oluştu.')
    } finally {
      setYukleniyor(false)
    }
  }, [yil, ay])

  useEffect(() => {
    if (canView) yukle()
  }, [canView, yukle])

  if (!canView) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Bu sayfayı görüntüleme yetkiniz yok.</p>
      </div>
    )
  }

  const yilSecenekleri = [simdi.getFullYear() - 1, simdi.getFullYear(), simdi.getFullYear() + 1]

  const hicDegisiklikYok =
    !!veri &&
    veri.yeniServisKullanicilari.length === 0 &&
    veri.servistenAyrilanlar.length === 0 &&
    veri.servisDegistirenler.length === 0 &&
    veri.durakDegistirenler.length === 0 &&
    veri.aracDegisenServisler.length === 0 &&
    veri.soforDegisenServisler.length === 0 &&
    veri.vardiyaDegistirenler.length === 0

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Bu Ay Ne Değişti?</h1>
        <p className="text-sm text-muted-foreground">
          Seçilen ay içinde servis-yönetimi modülünde gerçekleşen değişikliklerin özeti.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="bund-yil" className="text-sm">Yıl</label>
        <select
          id="bund-yil"
          value={yil}
          onChange={(e) => setYil(Number(e.target.value))}
          className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          {yilSecenekleri.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <label htmlFor="bund-ay" className="text-sm">Ay</label>
        <select
          id="bund-ay"
          value={ay}
          onChange={(e) => setAy(Number(e.target.value))}
          className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          {AY_ADLARI.map((ad, index) => (
            <option key={ad} value={index + 1}>{ad}</option>
          ))}
        </select>
      </div>

      {hata && <p className="text-sm text-red-600">{hata}</p>}
      {yukleniyor && <p className="text-sm text-muted-foreground">Yükleniyor...</p>}

      {!yukleniyor && veri && (
        <>
          {hicDegisiklikYok && (
            <p className="text-sm text-muted-foreground border border-dashed rounded-md p-6 text-center">
              {AY_ADLARI[ay - 1]} {yil} için servis-yönetimi modülünde kayıtlı bir değişiklik yok.
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Yeni Servis Kullanıcıları</CardTitle></CardHeader>
              <CardContent>
                {veri.yeniServisKullanicilari.length === 0 ? (
                  <BosListe mesaj="Bu ay yeni servis kullanıcısı yok." />
                ) : (
                  <ul className="space-y-1 text-sm">
                    {veri.yeniServisKullanicilari.map((k) => (
                      <li key={k.personnelId}>
                        {k.adSoyad} ({k.sicilNo ?? '-'}, {k.bolum}) — {k.guzergahKod} — {k.guzergahAd}, {tarihGoster(k.tarih)}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Servisten Ayrılanlar</CardTitle></CardHeader>
              <CardContent>
                {veri.servistenAyrilanlar.length === 0 ? (
                  <BosListe mesaj="Bu ay servisten ayrılan yok." />
                ) : (
                  <ul className="space-y-1 text-sm">
                    {veri.servistenAyrilanlar.map((k) => (
                      <li key={k.personnelId}>
                        {k.adSoyad} ({k.sicilNo ?? '-'}, {k.bolum}) — {k.guzergahKod} — {k.guzergahAd}, {tarihGoster(k.tarih)}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Servis Değiştirenler</CardTitle></CardHeader>
              <CardContent>
                {veri.servisDegistirenler.length === 0 ? (
                  <BosListe mesaj="Bu ay servis değiştiren yok." />
                ) : (
                  <ul className="space-y-1 text-sm">
                    {veri.servisDegistirenler.map((k) => (
                      <li key={k.personnelId}>
                        {k.adSoyad} ({k.sicilNo ?? '-'}, {k.bolum}) — {k.eskiGuzergahKod} → {k.yeniGuzergahKod}, {tarihGoster(k.tarih)}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Durak Değiştirenler</CardTitle></CardHeader>
              <CardContent>
                {veri.durakDegistirenler.length === 0 ? (
                  <BosListe mesaj="Bu ay durak değiştiren yok." />
                ) : (
                  <ul className="space-y-1 text-sm">
                    {veri.durakDegistirenler.map((k) => (
                      <li key={k.personnelId}>
                        {k.adSoyad} ({k.sicilNo ?? '-'}, {k.bolum}) — {k.guzergahKod}: {k.eskiDurakKod ?? '-'} → {k.yeniDurakKod ?? '-'}, {tarihGoster(k.tarih)}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Araç Değiştiren Servisler</CardTitle></CardHeader>
              <CardContent>
                {veri.aracDegisenServisler.length === 0 ? (
                  <BosListe mesaj="Bu ay araç değişikliği yok." />
                ) : (
                  <ul className="space-y-1 text-sm">
                    {veri.aracDegisenServisler.map((k, i) => (
                      <li key={i}>
                        {k.guzergahKod} — {k.dilimKod}: {k.eskiPlaka ?? '-'} → {k.yeniPlaka}, {tarihGoster(k.tarih)}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Sürücü Değiştiren Servisler</CardTitle></CardHeader>
              <CardContent>
                {veri.soforDegisenServisler.length === 0 ? (
                  <BosListe mesaj="Bu ay sürücü değişikliği yok." />
                ) : (
                  <ul className="space-y-1 text-sm">
                    {veri.soforDegisenServisler.map((k, i) => (
                      <li key={i}>
                        {k.guzergahKod} — {k.dilimKod}: {k.eskiAdSoyad ?? '-'} → {k.yeniAdSoyad}, {tarihGoster(k.tarih)}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Vardiya Değiştirenler</CardTitle></CardHeader>
              <CardContent>
                {veri.vardiyaDegistirenler.length === 0 ? (
                  <BosListe mesaj="Bu ay vardiya değişikliği yok." />
                ) : (
                  <ul className="space-y-1 text-sm">
                    {veri.vardiyaDegistirenler.map((k) => (
                      <li key={k.personnelId}>
                        {k.adSoyad} ({k.sicilNo ?? '-'}, {k.bolum}) — {k.guzergahKod} — {k.guzergahAd}, {tarihGoster(k.tarih)}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="opacity-60 bg-muted/30">
              <CardHeader><CardTitle className="text-base">Adres Değişiklikleri</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Badge variant="secondary">Kapsam dışı</Badge>
                <p className="text-sm text-muted-foreground">{veri.adresDegisiklikleri.not}</p>
              </CardContent>
            </Card>

            <Card className="opacity-60 bg-muted/30">
              <CardHeader><CardTitle className="text-base">Kapasite Riskleri / Boşalan Kapasite</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Badge variant="secondary">Devre dışı</Badge>
                <p className="text-sm text-muted-foreground">Kapasite motoru main&apos;e girdiğinde eklenecek.</p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
