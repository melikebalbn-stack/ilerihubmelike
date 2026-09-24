'use client'

/**
 * /raporlar — 40+ raporda kullanılabilir liste: arama (kod/ad/açıklama/kategori/veri seti, tr-TR),
 * tür/durum/kategori çipleri, "Son çalıştırdıklarım" (rapor_calistirma), favoriler (localStorage,
 * kullanıcı bazlı anahtar — migration yok), kategoriye göre gruplu kart veya tek satırlık liste görünümü.
 */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Clock, Database, FileBarChart2, FileSearch, LayoutGrid, List, Loader2, Plus, Search, Star, X } from 'lucide-react'
import { RozetLink } from './rozet-link'
import { apiGet, hataMetni } from './api'
import { TUR_ADI } from '@/lib/rapor/tur-adlari'

const NAVY = '#1B4F72'

interface Sablon {
  id: string
  kod: string
  ad: string
  aciklama: string | null
  durum: 'TASLAK' | 'YAYINDA' | 'ARSIV'
  tur: 'etkilesimli' | 'belge'
  kategori: string | null
  veriSetiAd: string
  guncellenme: string
}
interface ListeCevabi { sablonlar: Sablon[]; tasarlayabilir: boolean; sonCalistirdiklarim: { id: string; olusturma: string }[]; kategoriler: string[]; kullaniciId: string }

const DURUM_ETIKET: Record<Sablon['durum'], { metin: string; sinif: string }> = {
  YAYINDA: { metin: 'Yayında', sinif: 'bg-green-100 text-green-800 hover:bg-green-100' },
  TASLAK: { metin: 'Taslak', sinif: 'bg-amber-100 text-amber-800 hover:bg-amber-100' },
  ARSIV: { metin: 'Arşiv', sinif: 'bg-gray-100 text-gray-700 hover:bg-gray-100' },
}
const KATEGORISIZ = 'Diğer'
const tarihMetni = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const kucult = (s: string) => s.toLocaleLowerCase('tr-TR')

/** localStorage güvenli okuma/yazma (gizli pencere / engelli depolama → sessiz). */
function depoOku<T>(anahtar: string, varsayilan: T): T { try { const v = localStorage.getItem(anahtar); return v ? (JSON.parse(v) as T) : varsayilan } catch { return varsayilan } }
function depoYaz(anahtar: string, deger: unknown) { try { localStorage.setItem(anahtar, JSON.stringify(deger)) } catch { /* yoksay */ } }

function Cip({ aktif, onClick, children, renk }: { aktif: boolean; onClick: () => void; children: React.ReactNode; renk?: string }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors ${aktif ? 'border-[#1B4F72] bg-[#DCEDF5] text-[#1B4F72] font-medium' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'} ${renk ?? ''}`}>{children}{aktif && <X className="h-3 w-3" />}</button>
  )
}

export default function RaporListeClient() {
  const [cevap, setCevap] = useState<ListeCevabi | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [arama, setArama] = useState('')
  const [tur, setTur] = useState<'etkilesimli' | 'belge' | null>(null)
  const [durum, setDurum] = useState<'YAYINDA' | 'TASLAK' | null>(null)
  const [kategori, setKategori] = useState<string | null>(null)
  const [gorunum, setGorunum] = useState<'kart' | 'liste'>('kart')
  const [favoriler, setFavoriler] = useState<Set<string>>(new Set())

  useEffect(() => {
    apiGet<ListeCevabi>('/api/raporlar')
      .then((d) => setCevap(d))
      .catch((e) => { setHata(hataMetni(e)); setCevap({ sablonlar: [], tasarlayabilir: false, sonCalistirdiklarim: [], kategoriler: [], kullaniciId: '' }) })
    setGorunum(depoOku<'kart' | 'liste'>('raporlar.gorunum', 'kart'))
  }, [])
  // Favoriler kullanıcı bazlı anahtarda — kullanıcı kimliği listeyle gelir.
  const favAnahtar = cevap?.kullaniciId ? `raporlar.favori.${cevap.kullaniciId}` : null
  useEffect(() => { if (favAnahtar) setFavoriler(new Set(depoOku<string[]>(favAnahtar, []))) }, [favAnahtar])
  const favoriDegistir = (id: string) => setFavoriler((f) => { const n = new Set(f); n.has(id) ? n.delete(id) : n.add(id); if (favAnahtar) depoYaz(favAnahtar, [...n]); return n })
  const gorunumDegistir = (g: 'kart' | 'liste') => { setGorunum(g); depoYaz('raporlar.gorunum', g) }

  const sablonlar = useMemo(() => cevap?.sablonlar ?? [], [cevap])
  const filtreli = useMemo(() => {
    const q = kucult(arama.trim())
    return sablonlar.filter((s) =>
      (!tur || s.tur === tur) && (!durum || s.durum === durum) && (!kategori || (s.kategori ?? KATEGORISIZ) === kategori) &&
      (!q || [s.kod, s.ad, s.aciklama ?? '', s.kategori ?? '', s.veriSetiAd].some((m) => kucult(m).includes(q))))
  }, [sablonlar, arama, tur, durum, kategori])
  const filtreAktif = !!(arama.trim() || tur || durum || kategori)
  const temizle = () => { setArama(''); setTur(null); setDurum(null); setKategori(null) }

  const sablonMap = useMemo(() => new Map(sablonlar.map((s) => [s.id, s])), [sablonlar])
  const sonCalistirdiklarim = (cevap?.sonCalistirdiklarim ?? []).map((k) => ({ ...k, sablon: sablonMap.get(k.id)! })).filter((k) => k.sablon)
  const favoriListesi = filtreli.filter((s) => favoriler.has(s.id))
  const gruplar = useMemo(() => {
    const m = new Map<string, Sablon[]>()
    for (const s of filtreli) { const k = s.kategori ?? KATEGORISIZ; m.set(k, [...(m.get(k) ?? []), s]) }
    return [...m.entries()].sort(([a], [b]) => (a === KATEGORISIZ ? 1 : b === KATEGORISIZ ? -1 : a.localeCompare(b, 'tr-TR')))
  }, [filtreli])
  const kategoriler = useMemo(() => [...(cevap?.kategoriler ?? []), ...(sablonlar.some((s) => !s.kategori) ? [KATEGORISIZ] : [])], [cevap, sablonlar])

  const yildiz = (s: Sablon) => (
    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); favoriDegistir(s.id) }} className={`shrink-0 rounded p-0.5 transition-colors ${favoriler.has(s.id) ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}`} title={favoriler.has(s.id) ? 'Favoriden çıkar' : 'Favorilere ekle'} aria-label="Favori">
      <Star className="h-4 w-4" fill={favoriler.has(s.id) ? 'currentColor' : 'none'} />
    </button>
  )
  const rozetler = (s: Sablon) => (
    <span className="flex items-center gap-1 shrink-0">
      <Badge className={s.tur === 'etkilesimli' ? 'bg-[#DCEDF5] text-[#1B4F72] hover:bg-[#DCEDF5]' : 'bg-slate-100 text-slate-700 hover:bg-slate-100'}>{TUR_ADI[s.tur]}</Badge>
      {s.durum !== 'YAYINDA' && <Badge className={DURUM_ETIKET[s.durum].sinif}>{DURUM_ETIKET[s.durum].metin}</Badge>}
    </span>
  )
  const kart = (s: Sablon) => (
    <Link key={s.id} href={`/raporlar/${s.id}`} className="group focus:outline-none">
      <Card className="h-full transition-shadow group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-ring">
        <CardContent className="p-4 flex flex-col gap-2 h-full">
          <div className="flex items-start justify-between gap-2">
            <span className="font-mono text-xs text-muted-foreground">{s.kod}</span>
            <span className="flex items-center gap-1">{rozetler(s)}{yildiz(s)}</span>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold leading-snug" style={{ color: NAVY }}>{s.ad}</h3>
            {s.aciklama && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{s.aciklama}</p>}
          </div>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Database className="h-3 w-3" />{s.veriSetiAd} · {tarihMetni(s.guncellenme)}</p>
        </CardContent>
      </Card>
    </Link>
  )
  const satir = (s: Sablon) => (
    <Link key={s.id} href={`/raporlar/${s.id}`} className="flex items-center gap-3 px-3 py-1.5 border-b last:border-b-0 hover:bg-slate-50 text-sm">
      {yildiz(s)}
      <span className="font-mono text-xs text-muted-foreground w-24 shrink-0">{s.kod}</span>
      <span className="font-medium truncate" style={{ color: NAVY }}>{s.ad}</span>
      <span className="text-muted-foreground truncate hidden md:inline flex-1">{s.aciklama}</span>
      <span className="text-[11px] text-muted-foreground hidden lg:inline shrink-0">{s.veriSetiAd}</span>
      {rozetler(s)}
      <span className="text-[11px] text-muted-foreground w-20 text-right shrink-0">{tarihMetni(s.guncellenme)}</span>
    </Link>
  )
  const grupGoster = (baslik: React.ReactNode, liste: Sablon[], key: string) => (
    <section key={key} className="space-y-2">
      <h2 className="text-sm font-semibold text-slate-600 flex items-center gap-2">{baslik}<span className="font-normal text-muted-foreground">({liste.length})</span></h2>
      {gorunum === 'kart' ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{liste.map(kart)}</div> : <div className="rounded-lg border bg-white">{liste.map(satir)}</div>}
    </section>
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-3xl font-bold tracking-tight flex items-center gap-3"><FileBarChart2 className="h-6 w-6 lg:h-7 lg:w-7" style={{ color: NAVY }} />Raporlar</h1>
          <p className="text-sm text-muted-foreground mt-1">Tanımlı raporları çalıştırın, yazdırın veya Excel olarak indirin</p>
        </div>
        {cevap?.tasarlayabilir && (
          <div className="flex items-center gap-2">
            <RozetLink href="/raporlar/veri-setleri" icon={<Database className="h-3.5 w-3.5" />}>Veri setleri</RozetLink>
            <RozetLink href="/raporlar/tasarim/yeni" icon={<Plus className="h-3.5 w-3.5" />}>Yeni rapor</RozetLink>
          </div>
        )}
      </div>

      {/* Arama + çipler + görünüm */}
      {cevap && sablonlar.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[240px] max-w-xl">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-muted-foreground" />
              <Input className="pl-9" placeholder="Kod, ad, açıklama, kategori veya veri seti ara…" value={arama} onChange={(e) => setArama(e.target.value)} aria-label="Rapor ara" />
            </div>
            <div className="ml-auto flex items-center rounded-md border bg-white p-0.5" role="group" aria-label="Görünüm">
              <button type="button" onClick={() => gorunumDegistir('kart')} className={`rounded px-2 py-1 text-xs flex items-center gap-1 ${gorunum === 'kart' ? 'bg-[#DCEDF5] text-[#1B4F72]' : 'text-slate-500'}`} title="Kart görünümü"><LayoutGrid className="h-3.5 w-3.5" />Kart</button>
              <button type="button" onClick={() => gorunumDegistir('liste')} className={`rounded px-2 py-1 text-xs flex items-center gap-1 ${gorunum === 'liste' ? 'bg-[#DCEDF5] text-[#1B4F72]' : 'text-slate-500'}`} title="Liste görünümü"><List className="h-3.5 w-3.5" />Liste</button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground mr-1">Tür:</span>
            <Cip aktif={tur === 'etkilesimli'} onClick={() => setTur(tur === 'etkilesimli' ? null : 'etkilesimli')}>{TUR_ADI.etkilesimli}</Cip>
            <Cip aktif={tur === 'belge'} onClick={() => setTur(tur === 'belge' ? null : 'belge')}>{TUR_ADI.belge}</Cip>
            <span className="text-[11px] text-muted-foreground ml-2 mr-1">Durum:</span>
            <Cip aktif={durum === 'YAYINDA'} onClick={() => setDurum(durum === 'YAYINDA' ? null : 'YAYINDA')}>Yayında</Cip>
            {cevap.tasarlayabilir && <Cip aktif={durum === 'TASLAK'} onClick={() => setDurum(durum === 'TASLAK' ? null : 'TASLAK')}>Taslak</Cip>}
            {kategoriler.length > 0 && <span className="text-[11px] text-muted-foreground ml-2 mr-1">Kategori:</span>}
            {kategoriler.map((k) => <Cip key={k} aktif={kategori === k} onClick={() => setKategori(kategori === k ? null : k)}>{k}</Cip>)}
            {filtreAktif && <button type="button" onClick={temizle} className="text-xs text-[#1B4F72] hover:underline ml-2">Temizle</button>}
            <span className="ml-auto text-xs text-muted-foreground">{filtreli.length} / {sablonlar.length} rapor</span>
          </div>
        </div>
      )}

      {hata && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{hata}</div>}

      {!cevap ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Raporlar yükleniyor…</div>
      ) : sablonlar.length === 0 ? (
        <Card><CardContent className="py-14 flex flex-col items-center text-center gap-2">
          <FileSearch className="h-10 w-10 text-muted-foreground/60" />
          <p className="font-medium">Henüz tanımlı rapor yok</p>
          <p className="text-sm text-muted-foreground max-w-md">{cevap.tasarlayabilir ? 'İlk raporu oluşturmak için "Yeni rapor" düğmesini kullanın.' : 'Rapor tasarımcıları bir rapor yayınladığında burada görünecek.'}</p>
        </CardContent></Card>
      ) : filtreli.length === 0 ? (
        <Card><CardContent className="py-12 flex flex-col items-center text-center gap-2">
          <FileSearch className="h-10 w-10 text-muted-foreground/60" />
          <p className="font-medium">Bulunamadı</p>
          <p className="text-sm text-muted-foreground">Arama/filtre ölçütlerine uyan rapor yok. <button type="button" className="text-[#1B4F72] hover:underline" onClick={temizle}>Filtreleri temizle</button>{cevap.tasarlayabilir && <> ya da <Link href="/raporlar/tasarim/yeni" className="text-[#1B4F72] hover:underline">yeni rapor oluştur</Link></>}.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-6">
          {favoriListesi.length > 0 && grupGoster(<><Star className="h-4 w-4 text-amber-500" fill="currentColor" />Favoriler</>, favoriListesi, 'fav')}
          {!filtreAktif && sonCalistirdiklarim.length > 0 && grupGoster(<><Clock className="h-4 w-4 text-slate-500" />Son çalıştırdıklarım</>, sonCalistirdiklarim.map((k) => k.sablon), 'son')}
          {gruplar.map(([k, liste]) => grupGoster(k, liste, `kat:${k}`))}
        </div>
      )}
    </div>
  )
}
