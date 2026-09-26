'use client'

// MASTER Madde 47 — Servis firması performans raporu (Adım 5E).
// Dışa aktarım 5F'de.
//
// 🔴 EKRANDA YÜZDE/ORAN YOK (Ders 79). Şikâyet kendi kendine bildirilen
// veridir; kaç sefer yapıldığı bilinmediği için paydası yoktur. Çubuklar
// görsel karşılaştırma için var, üzerlerinde yazan değer MUTLAK SAYI.
// Tek istisna ortalama kapanış süresi — onun paydası var ve kartta
// AÇIKÇA yazıyor ("N kapanan kayıt üzerinden").
//
// Kart/grafik deseni emsalden: forms/toplu-kart-okutamama/_components/
// kpi-section.tsx (StatKart + recharts BarChart). Yeni kütüphane
// getirilmedi — recharts zaten bağımlılıklarda.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { SIKAYET_DURUM_ETIKETLERI } from '@/lib/servis-yonetimi/sikayet-durum'

const NAVY = '#1B4F72'
const KIRILIM_RENK = ['#2563eb', '#0891b2', '#7c3aed', '#059669', '#94a3b8', '#d97706']

type Durum = keyof typeof SIKAYET_DURUM_ETIKETLERI

type Kpi = {
  toplamSikayet: number
  reddedilenSayisi: number
  durumKirilim: { durum: Durum; adet: number }[]
  kategoriKirilim: { kategori: string; adet: number }[]
  durakKirilim: { durakId: string | null; adet: number }[]
  ortalamaKapanisGunu: number | null
  kapananKayitSayisi: number
  yenidenAcilanSayisi: number
}

type Secenek = { id: string; kod?: string | null; ad: string }

const KATEGORI_ETIKET: Record<string, string> = {
  GEC_GELME: 'Geç gelme', DURAGA_UGRAMAMA: 'Durağa uğramama', SURUCU_DAVRANISI: 'Sürücü davranışı',
  TEHLIKELI_KULLANIM: 'Tehlikeli kullanım', HIZ_IHLALI: 'Hız ihlali', TEMIZLIK: 'Temizlik',
  KLIMA_ISITMA: 'Klima / ısıtma', EMNIYET_KEMERI: 'Emniyet kemeri', ARAC_ARIZASI: 'Araç arızası',
  FAZLA_YOLCU: 'Fazla yolcu', YANLIS_GUZERGAH: 'Yanlış güzergâh', SAAT_UYUMSUZLUGU: 'Saat uyumsuzluğu',
  DIGER: 'Diğer',
}

function etiket(s: Secenek): string {
  return s.kod ? `${s.kod} — ${s.ad}` : s.ad
}

/** Emsaldeki StatKart — `alt` yuvası paydayı taşır. */
function StatKart({ baslik, deger, alt }: { baslik: string; deger: string | number; alt?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{baslik}</div>
        <div className="mt-1 text-2xl font-semibold" style={{ color: NAVY }}>{deger}</div>
        {alt && <div className="mt-0.5 text-xs text-muted-foreground">{alt}</div>}
      </CardContent>
    </Card>
  )
}

/** Yatay kırılım grafiği. dataKey MUTLAK SAYI — yüzde hesaplanmaz. */
function KirilimKarti({ baslik, veri }: { baslik: string; veri: { label: string; sayi: number }[] }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{baslik}</CardTitle></CardHeader>
      <CardContent>
        {veri.length === 0 ? (
          <p className="text-sm text-muted-foreground">Bu dönemde kayıt yok.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(120, veri.length * 34)}>
            <BarChart data={veri} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} fontSize={12} />
              <YAxis type="category" dataKey="label" width={150} tickLine={false} axisLine={false} fontSize={12} />
              <Tooltip formatter={(v: number) => [`${v} kayıt`, '']} />
              <Bar dataKey="sayi" name="Kayıt" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                {veri.map((_, i) => <Cell key={i} fill={KIRILIM_RENK[i % KIRILIM_RENK.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        {/* Grafik okunamazsa diye sayılar metin olarak da veriliyor. */}
        <ul className="mt-2 space-y-0.5">
          {veri.map(v => (
            <li key={v.label} className="flex justify-between text-xs text-muted-foreground">
              <span>{v.label}</span>
              <span className="font-medium text-foreground">{v.sayi}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

export default function SikayetRaporPage() {
  const { data: session } = useSession()
  const permissions = session?.user?.permissions || []
  const canView = permissions.includes('servis.sikayet.view')

  const [firmaId, setFirmaId] = useState('')
  const [guzergahId, setGuzergahId] = useState('')
  const [bildirimBaslangic, setBildirimBaslangic] = useState('')
  const [bildirimBitis, setBildirimBitis] = useState('')

  const [firmalar, setFirmalar] = useState<Secenek[]>([])
  const [guzergahlar, setGuzergahlar] = useState<Secenek[]>([])
  const [duraklar, setDuraklar] = useState<Secenek[]>([])

  const [kpi, setKpi] = useState<Kpi | null>(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)

  const sorguDizesi = useMemo(() => {
    const p = new URLSearchParams()
    if (firmaId) p.set('firmaId', firmaId)
    if (guzergahId) p.set('guzergahId', guzergahId)
    if (bildirimBaslangic) p.set('bildirimBaslangic', bildirimBaslangic)
    if (bildirimBitis) p.set('bildirimBitis', bildirimBitis)
    return p.toString()
  }, [firmaId, guzergahId, bildirimBaslangic, bildirimBitis])

  useEffect(() => {
    if (!canView) return
    let iptal = false
    ;(async () => {
      for (const [url, kur] of [
        ['/api/servis-yonetimi/firma?durum=aktif', setFirmalar],
        ['/api/servis-yonetimi/guzergah?durum=aktif', setGuzergahlar],
        ['/api/servis-yonetimi/durak?durum=aktif', setDuraklar],
      ] as const) {
        try {
          const res = await fetch(url)
          const json = await res.json()
          if (!iptal && res.ok && json.ok) kur(json.data ?? [])
        } catch {
          // Seçenek listesi alınamazsa seçici boş kalır; rapor yine çalışır.
        }
      }
    })()
    return () => { iptal = true }
  }, [canView])

  const yukle = useCallback(async () => {
    setYukleniyor(true)
    setHata(null)
    try {
      const res = await fetch(`/api/servis-yonetimi/sikayet/kpi${sorguDizesi ? `?${sorguDizesi}` : ''}`)
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setHata(json.message || 'Performans özeti alınamadı.')
        setKpi(null)
        return
      }
      setKpi(json.data)
    } catch {
      setHata('Performans özeti alınırken beklenmeyen bir hata oluştu.')
      setKpi(null)
    } finally {
      setYukleniyor(false)
    }
  }, [sorguDizesi])

  useEffect(() => {
    if (!canView) return
    yukle()
  }, [canView, yukle])

  const durakAdi = useCallback(
    (id: string | null) => {
      if (!id) return 'Durak belirtilmemiş'
      const d = duraklar.find(x => x.id === id)
      return d ? etiket(d) : id
    },
    [duraklar],
  )

  if (!canView) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Servis Firma Performansı</h1>
        <p className="mt-2 text-sm text-muted-foreground">Bu sayfayı görüntüleme yetkiniz yok.</p>
      </div>
    )
  }

  const acikSayisi = kpi?.durumKirilim.find(d => d.durum === 'ACIK')?.adet ?? 0
  const kayitVar = Boolean(kpi && (kpi.toplamSikayet > 0 || kpi.reddedilenSayisi > 0))

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Servis Firma Performansı</h1>
        <p className="text-sm text-muted-foreground">
          Şikâyet kayıtlarından türetilen ölçüler. Tüm değerler kayıt sayısıdır.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Filtreler</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="r-firma">Firma</Label>
            <select id="r-firma" value={firmaId} onChange={e => setFirmaId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">Tümü</option>
              {firmalar.map(f => <option key={f.id} value={f.id}>{etiket(f)}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="r-guzergah">Güzergâh</Label>
            <select id="r-guzergah" value={guzergahId} onChange={e => setGuzergahId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">Tümü</option>
              {guzergahlar.map(g => <option key={g.id} value={g.id}>{etiket(g)}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="r-baslangic">Bildirim başlangıç</Label>
            <input id="r-baslangic" type="date" value={bildirimBaslangic}
              onChange={e => setBildirimBaslangic(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <Label htmlFor="r-bitis">Bildirim bitiş</Label>
            <input id="r-bitis" type="date" value={bildirimBitis}
              onChange={e => setBildirimBitis(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
        </CardContent>
      </Card>

      {yukleniyor ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : hata ? (
        <p className="text-sm text-red-600">{hata}</p>
      ) : !kayitVar ? (
        <p className="text-sm text-muted-foreground">Bu dönemde kayıt yok.</p>
      ) : kpi ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatKart baslik="Toplam şikâyet" deger={kpi.toplamSikayet} alt="Reddedilenler hariç" />
            <StatKart baslik="Reddedilen" deger={kpi.reddedilenSayisi} alt="Toplama dahil değil" />
            <StatKart baslik="Açık" deger={acikSayisi} />
            <StatKart
              baslik="Ortalama kapanış"
              deger={kpi.ortalamaKapanisGunu === null ? '—' : `${kpi.ortalamaKapanisGunu} gün`}
              // 🔴 PAYDA kartın üstünde: paydasız bir ortalama, tek kayıttan
              // hesaplanmış olsa bile otoriter görünür.
              alt={`${kpi.kapananKayitSayisi} kapanan kayıt üzerinden`}
            />
            <StatKart baslik="Yeniden açılan" deger={kpi.yenidenAcilanSayisi} />
          </div>

          {/* İleride "toplam tutmuyor" diye hata sanılmasın. */}
          <p className="text-xs text-muted-foreground">
            Reddedilen şikâyetler firma performansına sayılmaz.
          </p>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <KirilimKarti
              baslik="Durum kırılımı"
              veri={kpi.durumKirilim.map(d => ({ label: SIKAYET_DURUM_ETIKETLERI[d.durum] ?? d.durum, sayi: d.adet }))}
            />
            <KirilimKarti
              baslik="Kategori kırılımı"
              veri={kpi.kategoriKirilim.map(k => ({ label: KATEGORI_ETIKET[k.kategori] ?? k.kategori, sayi: k.adet }))}
            />
            <KirilimKarti
              baslik="Durak kırılımı"
              veri={kpi.durakKirilim.map(d => ({ label: durakAdi(d.durakId), sayi: d.adet }))}
            />
          </div>
        </>
      ) : null}
    </div>
  )
}
