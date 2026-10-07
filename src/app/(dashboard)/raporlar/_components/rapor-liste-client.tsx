'use client'

/**
 * /raporlar — rapor kataloğu.
 *
 * 07.10.2026 yeniden düzen (Melih onayı, maket üzerinden):
 * - Varsayılan görünüm LİSTE. Kart ikinci seçenek; 40 rapora çıkınca kart düzeni
 *   ekranı üç boy uzatıyordu.
 * - Favoriler / Son kullandıklarım / Tümü artık üst üste bölüm DEĞİL, SEKME.
 *   Önceki düzende aynı rapor üç kez görünebiliyordu (favori + son koşu + kategori).
 * - Kategori çip sırası yerine sol panelde sabit liste (sayılarla); kategoriler
 *   lib/rapor/kategoriler üzerinden kanonik ada eşlenir.
 * - Satırda raporun kendi bilgisi var: son çalıştırma + sahip. Kod en sağda, soluk.
 * - Taslaklar (yalnız tasarımcıya gelir) ayrı, kapalı bir bölümde; yayındaki
 *   raporlara karışmıyor.
 *
 * Favoriler hâlâ localStorage'da (kullanıcı bazlı anahtar) — DB'ye taşınması
 * şema değişikliği gerektiriyor, ayrı iş.
 */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  ChevronDown, ChevronRight, Clock, Database, FileBarChart2, FileSearch, LayoutGrid,
  List, Loader2, Play, Plus, Search, Star,
} from 'lucide-react'
import { RozetLink } from './rozet-link'
import { apiGet, hataMetni } from './api'
import { TUR_ADI } from '@/lib/rapor/tur-adlari'

const NAVY = '#1B4F72'
const TUM_KATEGORILER = '__tum__'

interface Sablon {
  id: string
  kod: string
  ad: string
  aciklama: string | null
  durum: 'TASLAK' | 'YAYINDA' | 'ARSIV'
  tur: 'etkilesimli' | 'belge'
  kategori: string
  veriSetiAd: string
  guncellenme: string
  sahip: string | null
  sonCalistirma: string | null
}
interface ListeCevabi {
  sablonlar: Sablon[]
  tasarlayabilir: boolean
  sonCalistirdiklarim: { id: string; olusturma: string }[]
  kategoriler: string[]
  kullaniciId: string
}

type Sekme = 'tumu' | 'favori' | 'son'

const kucult = (s: string) => s.toLocaleLowerCase('tr-TR')

/** "2 saat önce" / "3 gün önce" — mutlak tarih yerine, tazelik tek bakışta okunsun. */
function gecenSure(iso: string | null): string {
  if (!iso) return 'Hiç çalıştırılmadı'
  const fark = Date.now() - new Date(iso).getTime()
  const dk = Math.floor(fark / 60000)
  if (dk < 1) return 'Az önce'
  if (dk < 60) return `${dk} dakika önce`
  const saat = Math.floor(dk / 60)
  if (saat < 24) return `${saat} saat önce`
  const gun = Math.floor(saat / 24)
  if (gun === 1) return 'Dün'
  if (gun < 30) return `${gun} gün önce`
  const ay = Math.floor(gun / 30)
  if (ay < 12) return `${ay} ay önce`
  return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** localStorage güvenli okuma/yazma (gizli pencere / engelli depolama → sessiz). */
function depoOku<T>(anahtar: string, varsayilan: T): T { try { const v = localStorage.getItem(anahtar); return v ? (JSON.parse(v) as T) : varsayilan } catch { return varsayilan } }
function depoYaz(anahtar: string, deger: unknown) { try { localStorage.setItem(anahtar, JSON.stringify(deger)) } catch { /* yoksay */ } }

export default function RaporListeClient() {
  const [cevap, setCevap] = useState<ListeCevabi | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [arama, setArama] = useState('')
  const [sekme, setSekme] = useState<Sekme>('tumu')
  const [kategori, setKategori] = useState<string>(TUM_KATEGORILER)
  const [gorunum, setGorunum] = useState<'kart' | 'liste'>('liste')
  const [favoriler, setFavoriler] = useState<Set<string>>(new Set())
  const [taslakAcik, setTaslakAcik] = useState(false)

  useEffect(() => {
    apiGet<ListeCevabi>('/api/raporlar')
      .then((d) => setCevap(d))
      .catch((e) => { setHata(hataMetni(e)); setCevap({ sablonlar: [], tasarlayabilir: false, sonCalistirdiklarim: [], kategoriler: [], kullaniciId: '' }) })
    setGorunum(depoOku<'kart' | 'liste'>('raporlar.gorunum', 'liste'))
  }, [])
  const favAnahtar = cevap?.kullaniciId ? `raporlar.favori.${cevap.kullaniciId}` : null
  useEffect(() => { if (favAnahtar) setFavoriler(new Set(depoOku<string[]>(favAnahtar, []))) }, [favAnahtar])
  const favoriDegistir = (id: string) => setFavoriler((f) => {
    const n = new Set(f)
    if (n.has(id)) n.delete(id); else n.add(id)
    if (favAnahtar) depoYaz(favAnahtar, [...n])
    return n
  })
  const gorunumDegistir = (g: 'kart' | 'liste') => { setGorunum(g); depoYaz('raporlar.gorunum', g) }

  const tumSablonlar = useMemo(() => cevap?.sablonlar ?? [], [cevap])
  const yayinda = useMemo(() => tumSablonlar.filter((s) => s.durum === 'YAYINDA'), [tumSablonlar])
  const taslaklar = useMemo(() => tumSablonlar.filter((s) => s.durum !== 'YAYINDA'), [tumSablonlar])

  /** Son çalıştırdıklarım sırası — sekme için hem filtre hem sıralama kaynağı. */
  const sonSira = useMemo(
    () => new Map((cevap?.sonCalistirdiklarim ?? []).map((k, i) => [k.id, i])),
    [cevap],
  )

  /** Sekme → aday küme. Kategori ve arama bunun üstüne uygulanır. */
  const sekmeListesi = useMemo(() => {
    if (sekme === 'favori') return yayinda.filter((s) => favoriler.has(s.id))
    if (sekme === 'son') return yayinda.filter((s) => sonSira.has(s.id)).sort((a, b) => (sonSira.get(a.id) ?? 0) - (sonSira.get(b.id) ?? 0))
    return [...yayinda].sort((a, b) => {
      // Son çalıştırmaya göre: hiç çalıştırılmamışlar en sonda, sonra ada göre.
      const at = a.sonCalistirma ? new Date(a.sonCalistirma).getTime() : -1
      const bt = b.sonCalistirma ? new Date(b.sonCalistirma).getTime() : -1
      if (at !== bt) return bt - at
      return a.ad.localeCompare(b.ad, 'tr-TR')
    })
  }, [sekme, yayinda, favoriler, sonSira])

  const filtreli = useMemo(() => {
    const q = kucult(arama.trim())
    return sekmeListesi.filter((s) =>
      (kategori === TUM_KATEGORILER || s.kategori === kategori) &&
      (!q || [s.kod, s.ad, s.aciklama ?? '', s.kategori, s.veriSetiAd, s.sahip ?? ''].some((m) => kucult(m).includes(q))))
  }, [sekmeListesi, arama, kategori])

  /** Sol paneldeki sayılar sekmeye göre — "Üretim 3" o sekmede gerçekten 3 rapor demek. */
  const kategoriSayilari = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of sekmeListesi) m.set(s.kategori, (m.get(s.kategori) ?? 0) + 1)
    return m
  }, [sekmeListesi])

  const kategoriler = cevap?.kategoriler ?? []
  const tasarlayabilir = cevap?.tasarlayabilir ?? false
  const sekmeSayilari: Record<Sekme, number> = {
    tumu: yayinda.length,
    favori: yayinda.filter((s) => favoriler.has(s.id)).length,
    son: yayinda.filter((s) => sonSira.has(s.id)).length,
  }

  const yildiz = (s: Sablon) => (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); favoriDegistir(s.id) }}
      className={`shrink-0 rounded p-1 transition-colors ${favoriler.has(s.id) ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}`}
      title={favoriler.has(s.id) ? 'Favoriden çıkar' : 'Favorilere ekle'}
      aria-label={favoriler.has(s.id) ? 'Favoriden çıkar' : 'Favorilere ekle'}
    >
      <Star className="h-4 w-4" fill={favoriler.has(s.id) ? 'currentColor' : 'none'} />
    </button>
  )

  const satir = (s: Sablon) => (
    <div key={s.id} className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0 hover:bg-slate-50">
      {yildiz(s)}
      <div className="min-w-0 flex-1">
        <Link href={`/raporlar/${s.id}`} className="font-medium hover:underline" style={{ color: NAVY }}>{s.ad}</Link>
        {s.aciklama && <p className="truncate text-sm text-muted-foreground">{s.aciklama}</p>}
      </div>
      <Badge variant="secondary" className="hidden shrink-0 font-normal sm:inline-flex">{s.kategori}</Badge>
      <div className="hidden w-32 shrink-0 text-right lg:block">
        <p className="text-xs text-slate-600">{gecenSure(s.sonCalistirma)}</p>
        {s.sahip && <p className="truncate text-[11px] text-muted-foreground">{s.sahip}</p>}
      </div>
      <span className="hidden w-16 shrink-0 text-right font-mono text-[11px] text-slate-300 xl:inline">{s.kod}</span>
      <Link
        href={`/raporlar/${s.id}`}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-slate-50"
        style={{ color: NAVY }}
      >
        <Play className="h-3.5 w-3.5 fill-current" />
        <span className="hidden sm:inline">Çalıştır</span>
      </Link>
    </div>
  )

  const kart = (s: Sablon) => (
    <Card key={s.id} className="h-full transition-shadow hover:shadow-md">
      <CardContent className="flex h-full flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/raporlar/${s.id}`} className="font-semibold leading-snug hover:underline" style={{ color: NAVY }}>{s.ad}</Link>
          {yildiz(s)}
        </div>
        {s.aciklama && <p className="line-clamp-2 flex-1 text-sm text-muted-foreground">{s.aciklama}</p>}
        <div className="flex items-center justify-between gap-2 pt-1">
          <Badge variant="secondary" className="font-normal">{s.kategori}</Badge>
          <span className="text-[11px] text-muted-foreground">{gecenSure(s.sonCalistirma)}</span>
        </div>
      </CardContent>
    </Card>
  )

  const sekmeDugmesi = (id: Sekme, etiket: string, ikon?: React.ReactNode) => (
    <button
      type="button"
      role="tab"
      aria-selected={sekme === id}
      onClick={() => setSekme(id)}
      className={`inline-flex items-center gap-2 border-b-2 px-4 py-2 text-sm transition-colors ${
        sekme === id ? 'border-[#1B4F72] font-semibold text-slate-900' : 'border-transparent text-muted-foreground hover:text-slate-700'
      }`}
    >
      {ikon}{etiket}
      <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ${sekme === id ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-500'}`}>{sekmeSayilari[id]}</span>
    </button>
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-3 text-xl font-bold tracking-tight lg:text-3xl">
            <FileBarChart2 className="h-6 w-6 lg:h-7 lg:w-7" style={{ color: NAVY }} />Raporlar
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Tanımlı raporları çalıştırın, yazdırın veya Excel olarak indirin</p>
        </div>
        {tasarlayabilir && (
          <div className="flex items-center gap-2">
            <RozetLink href="/raporlar/veri-setleri" icon={<Database className="h-3.5 w-3.5" />}>Veri setleri</RozetLink>
            <RozetLink href="/raporlar/tasarim/yeni" icon={<Plus className="h-3.5 w-3.5" />}>Yeni rapor</RozetLink>
          </div>
        )}
      </div>

      {cevap && tumSablonlar.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[240px] max-w-xl flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Rapor adı, açıklama ya da kod ara…" value={arama} onChange={(e) => setArama(e.target.value)} aria-label="Rapor ara" />
            </div>
            <div className="ml-auto flex items-center rounded-md border bg-white p-0.5" role="group" aria-label="Görünüm">
              <button type="button" onClick={() => gorunumDegistir('liste')} aria-pressed={gorunum === 'liste'} className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${gorunum === 'liste' ? 'bg-[#DCEDF5] text-[#1B4F72]' : 'text-slate-500'}`}><List className="h-3.5 w-3.5" />Liste</button>
              <button type="button" onClick={() => gorunumDegistir('kart')} aria-pressed={gorunum === 'kart'} className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${gorunum === 'kart' ? 'bg-[#DCEDF5] text-[#1B4F72]' : 'text-slate-500'}`}><LayoutGrid className="h-3.5 w-3.5" />Kart</button>
            </div>
          </div>

          <div role="tablist" aria-label="Rapor görünümü" className="flex gap-1 border-b">
            {sekmeDugmesi('tumu', 'Tümü')}
            {sekmeDugmesi('favori', 'Favorilerim', <Star className="h-3.5 w-3.5" />)}
            {sekmeDugmesi('son', 'Son kullandıklarım', <Clock className="h-3.5 w-3.5" />)}
          </div>
        </>
      )}

      {hata && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{hata}</div>}

      {!cevap ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Raporlar yükleniyor…</div>
      ) : tumSablonlar.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-2 py-14 text-center">
          <FileSearch className="h-10 w-10 text-muted-foreground/60" />
          <p className="font-medium">Henüz tanımlı rapor yok</p>
          <p className="max-w-md text-sm text-muted-foreground">{tasarlayabilir ? 'İlk raporu oluşturmak için "Yeni rapor" düğmesini kullanın.' : 'Rapor tasarımcıları bir rapor yayınladığında burada görünecek.'}</p>
        </CardContent></Card>
      ) : (
        <div className="flex flex-wrap items-start gap-6">
          {/* Sol: kategori paneli */}
          <nav aria-label="Kategoriler" className="w-full shrink-0 rounded-lg border bg-white p-2 sm:w-56">
            <p className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Kategori</p>
            <button
              type="button"
              onClick={() => setKategori(TUM_KATEGORILER)}
              className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm ${kategori === TUM_KATEGORILER ? 'bg-slate-100 font-semibold text-slate-900' : 'text-slate-700 hover:bg-slate-50'}`}
            >
              <span>Tüm raporlar</span>
              <span className="text-xs text-muted-foreground">{sekmeListesi.length}</span>
            </button>
            {kategoriler.map((k) => {
              const sayi = kategoriSayilari.get(k) ?? 0
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKategori(k)}
                  className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm ${
                    kategori === k ? 'bg-slate-100 font-semibold text-slate-900' : sayi === 0 ? 'text-slate-400 hover:bg-slate-50' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate">{k}</span>
                  <span className={`text-xs ${sayi === 0 ? 'text-slate-300' : 'text-muted-foreground'}`}>{sayi}</span>
                </button>
              )
            })}
          </nav>

          {/* Sağ: liste */}
          <div className="min-w-[280px] flex-1 space-y-3">
            <div className="flex items-baseline justify-between gap-2 px-1">
              <p className="text-sm text-muted-foreground">{filtreli.length} rapor</p>
              {sekme === 'tumu' && <p className="text-xs text-muted-foreground">Son çalıştırmaya göre sıralı</p>}
            </div>

            {filtreli.length === 0 ? (
              <Card><CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                <FileSearch className="h-10 w-10 text-muted-foreground/60" />
                <p className="font-medium">Bulunamadı</p>
                <p className="text-sm text-muted-foreground">
                  {sekme === 'favori' ? 'Henüz favori raporun yok — listedeki yıldıza basarak ekleyebilirsin.'
                    : sekme === 'son' ? 'Son çalıştırdığın rapor yok.'
                    : 'Arama/filtre ölçütlerine uyan rapor yok.'}
                </p>
              </CardContent></Card>
            ) : gorunum === 'liste' ? (
              <div className="rounded-lg border bg-white">{filtreli.map(satir)}</div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{filtreli.map(kart)}</div>
            )}

            {/* Taslaklar — yalnız tasarımcıda, yayındaki listeye karışmaz. */}
            {tasarlayabilir && taslaklar.length > 0 && (
              <div className="rounded-lg border border-dashed bg-white">
                <button
                  type="button"
                  onClick={() => setTaslakAcik((a) => !a)}
                  aria-expanded={taslakAcik}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm"
                >
                  {taslakAcik ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <span className="font-semibold text-slate-900">Taslaklar ({taslaklar.length})</span>
                  <span className="text-muted-foreground">— yalnız rapor tasarımcılarına görünür</span>
                </button>
                {taslakAcik && <div className="border-t">{taslaklar.map(satir)}</div>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
