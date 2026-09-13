'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Activity, AlertTriangle, Factory, Maximize, Minimize, Package, RefreshCw, Search, Signal } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const POLL_MS = 10_000

type Durum = 'calisiyor' | 'durusta' | 'bosta'
type DurumFiltre = 'tumu' | Durum
const DURUM_FILTRELER: { key: DurumFiltre; etiket: string }[] = [
  { key: 'tumu', etiket: 'Tümü' },
  { key: 'calisiyor', etiket: 'Çalışıyor' },
  { key: 'durusta', etiket: 'Duruşta' },
  { key: 'bosta', etiket: 'Boşta' },
]

type CanliOee = {
  availability: number | null
  performance: number | null
  quality: null
  oeeCanli: number | null
  durum: 'CANLI_KISMI' | 'PLANLI_YOK'
  planliSaniye: number
  durusSaniye: number
  uretilen: number
  idealGuvenilir: boolean
  ornekSayisi: number
}

// OEE renk eşiği (görsel, OeePano ile hizalı): ≥%85 yeşil, ≥%60 amber, <%60 kırmızı, null gri.
function oeeRenk(v: number | null): string {
  if (v == null) return '#94a3b8'
  if (v >= 0.85) return '#10b981'
  if (v >= 0.6) return '#d99b3c'
  return '#e11d48'
}
function oeeYuzde(v: number | null): string {
  return v == null ? '—' : `%${Math.round(v * 100)}`
}

// Inline SVG halka gösterge (shadcn'de gauge yok — SVG serbest). Responsive: dar kartta küçülür
// (width:100%, max 58px, aspect-ratio 1). viewBox sabit boyut üzerinden çizer, ölçek CSS ile.
function Halka({ deger, boyut = 58, kalinlik = 7, etiket }: { deger: number | null; boyut?: number; kalinlik?: number; etiket?: string }) {
  const r = (boyut - kalinlik) / 2
  const cevre = 2 * Math.PI * r
  const oran = deger == null ? 0 : Math.max(0, Math.min(1, deger))
  const renk = oeeRenk(deger)
  return (
    <div className="relative mx-auto flex aspect-square w-full items-center justify-center" style={{ maxWidth: boyut }}>
      <svg viewBox={`0 0 ${boyut} ${boyut}`} className="h-full w-full -rotate-90">
        <circle cx={boyut / 2} cy={boyut / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={kalinlik} />
        <circle
          cx={boyut / 2}
          cy={boyut / 2}
          r={r}
          fill="none"
          stroke={renk}
          strokeWidth={kalinlik}
          strokeLinecap="round"
          strokeDasharray={cevre}
          strokeDashoffset={cevre * (1 - oran)}
        />
      </svg>
      <div className="absolute flex flex-col items-center leading-none">
        <span className="text-[11px] font-bold" style={{ color: renk }}>{oeeYuzde(deger)}</span>
        {etiket ? <span className="mt-0.5 text-[8px] text-slate-400">{etiket}</span> : null}
      </div>
    </div>
  )
}

// Bir tezgahın 4 halkası (Kullan./Perf./Kalite/OEE). 4 eşit sütun grid — hücreler min-w-0 ile
// taşmayı keser, halkalar kartın içine sığar. Veri yoksa boş halka + tire. Güvenilirlik notu alt satır.
function OeeSerit({ c, tv, esik }: { c: CanliOee | null; tv: boolean; esik: number }) {
  return (
    <div className="mt-2 border-t pt-2">
      <div className="grid grid-cols-4 gap-1">
        <div className="min-w-0"><Halka deger={c?.availability ?? null} etiket="Kullan." /></div>
        <div className="min-w-0"><Halka deger={c?.performance ?? null} etiket="Perf." /></div>
        <div className="min-w-0"><Halka deger={null} etiket="Kalite" /></div>
        <div className="min-w-0"><Halka deger={c?.oeeCanli ?? null} etiket="OEE" /></div>
      </div>
      {c && !c.idealGuvenilir ? (
        <p className={`mt-1 text-right text-[8px] ${tv ? 'text-slate-500' : 'text-slate-400'}`} title="ideal çevrim güvenilirlik">
          {c.ornekSayisi}/{esik}
        </p>
      ) : null}
    </div>
  )
}

type Calisan = {
  adSoyad: string | null
  sicilNo: string | null
  ifsOrderNo: string | null
  ifsOperationNo: number | null
  ifsPartNo: string | null
  ifsPartDescription: string | null
  baslatildiAt: string
}
type Durus = { baslangicAt: string; sebep: string | null }
type Tezgah = {
  id: string
  kod: string
  ad: string
  masGrupAdi: string | null
  aktif: boolean
  sinyalli: boolean
  durum: Durum
  calisan: Calisan | null
  durus: Durus | null
  canliOee?: CanliOee | null
}
type Pano = {
  olusturuldu: string
  esik: number
  tezgahlar: Tezgah[]
  ozet: { kapananIs: number; toplamIyi: number; toplamHurda: number; aktifOperator: number; calisiyor: number; durusta: number; bosta: number }
  kuyruk: { bekleyen: number; enEskiBeklemeAt: string | null; hataliKayit: number }
}

type IsSatiri = {
  id: string
  ifsOrderNo: string | null
  ifsOperationNo: number | null
  ifsPartNo: string | null
  ifsPartDescription: string | null
  qtyComplete: number
  qtyScrap: number
  baslatildiAt: string | null
  bitirildiAt: string | null
  operator: string | null
  ifsQtyDue: number | null
  ifsDueDate: string | null
  ifsNeedDate: string | null
  ifsMachRunFactor: number | null
  ifsLaborRunFactor: number | null
  ifsRunTimeCode: string | null
}
type DurusSatiri = { id: string; sebep: string | null; yorum: string | null; baslangicAt: string; bitisAt: string | null; operator: string | null }
type Detay = {
  id: string
  kod: string
  ad: string
  masGrupAdi: string | null
  aktif: boolean
  sinyalli: boolean
  durum: Durum
  aktifIs: IsSatiri | null
  durus: Durus | null
  bugunKapanan: IsSatiri[]
  bugunDuruslar: DurusSatiri[]
  sureDagilimi: { calismaDk: number; durusDk: number; bostaDk: number; elapsedDk: number }
  uretim: { gerceklesen: number; planlanan: number | null }
}

/** ms → "1s 12dk" / "12dk" / "45sn". Canlı süre için. */
function sureBicim(ms: number): string {
  const dk = Math.floor(ms / 60000)
  if (dk < 1) return `${Math.floor(ms / 1000)}sn`
  if (dk < 60) return `${dk}dk`
  return `${Math.floor(dk / 60)}s ${dk % 60}dk`
}

export function IzlemeClient() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pano, setPano] = useState<Pano | null>(null)
  const [ilkYukleme, setIlkYukleme] = useState(true)
  const [hata, setHata] = useState(false)
  const [arama, setArama] = useState('')
  // Bölüm + durum filtresi URL query'de (?bolum=, ?durum=) — yenilenince korunur.
  const [bolum, setBolum] = useState<string>(searchParams.get('bolum') || 'hepsi')
  const durumIlk = searchParams.get('durum')
  const [durum, setDurum] = useState<DurumFiltre>(
    durumIlk === 'calisiyor' || durumIlk === 'durusta' || durumIlk === 'bosta' ? durumIlk : 'tumu',
  )
  const [tvModu, setTvModu] = useState(false)
  const [seciliId, setSeciliId] = useState<string | null>(null)
  // Süre etiketlerini her saniye tazelemek için (fetch'ten bağımsız).
  const [, tik] = useState(0)
  const tvRef = useRef<HTMLDivElement>(null)

  // Filtre seçimini URL'e yaz (varsayılanlar query'den düşer). bolum/durum tek yerde senkron.
  const filtreYaz = useCallback(
    (yeniBolum: string, yeniDurum: DurumFiltre) => {
      const p = new URLSearchParams()
      if (yeniBolum !== 'hepsi') p.set('bolum', yeniBolum)
      if (yeniDurum !== 'tumu') p.set('durum', yeniDurum)
      const qs = p.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [router, pathname],
  )
  const bolumSec = useCallback((b: string) => { setBolum(b); filtreYaz(b, durum) }, [filtreYaz, durum])
  const durumSec = useCallback((d: DurumFiltre) => { setDurum(d); filtreYaz(bolum, d) }, [filtreYaz, bolum])

  const yukle = useCallback(async () => {
    try {
      // Tek görünüm: çalışan künyesi + canlı OEE halkaları → her zaman oee=1.
      const res = await fetch('/api/ipro/izleme?oee=1', { cache: 'no-store' })
      const data = await res.json()
      if (res.ok && data?.ok) {
        setPano(data)
        setHata(false)
      } else {
        setHata(true)
      }
    } catch {
      setHata(true) // ağ hatası — poller ölmesin, bir sonraki tik'te tekrar dener
    } finally {
      setIlkYukleme(false)
    }
  }, [])

  // Polling — sekme gizliyken durur (gereksiz istek + pil).
  useEffect(() => {
    void yukle()
    let id: ReturnType<typeof setInterval> | null = null
    const baslat = () => {
      if (id) return
      id = setInterval(() => void yukle(), POLL_MS)
    }
    const durdur = () => {
      if (id) {
        clearInterval(id)
        id = null
      }
    }
    const gorunurluk = () => (document.hidden ? durdur() : (void yukle(), baslat()))
    baslat()
    document.addEventListener('visibilitychange', gorunurluk)
    return () => {
      durdur()
      document.removeEventListener('visibilitychange', gorunurluk)
    }
  }, [yukle])

  // Süre sayaçları için saniyelik tik.
  useEffect(() => {
    const id = setInterval(() => tik((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // TV modu = gerçek fullscreen (atölye TV'si). requestFullscreen üstteki shell'i
  // tamamen kapatır — fixed inset-0 tek başına ata containing-block'lardan beyaz
  // şerit bırakabiliyordu. Fullscreen reddedilirse fixed inset-0 fallback devrede.
  const tvAc = useCallback(() => {
    setTvModu(true)
    const el = tvRef.current
    if (el?.requestFullscreen) el.requestFullscreen().catch(() => {})
  }, [])
  const tvKapat = useCallback(() => {
    setTvModu(false)
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
  }, [])
  // Kullanıcı ESC/F11 ile fullscreen'den çıkarsa TV modunu da kapat (senkron kal).
  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement) setTvModu(false)
    }
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  // Bölümler + her birinin tezgah sayısı (dropdown'da yanında gösterilir). Kod sırası.
  const bolumler = useMemo(() => {
    const say = new Map<string, number>()
    pano?.tezgahlar.forEach((t) => {
      const b = t.masGrupAdi ?? '(grupsuz)'
      say.set(b, (say.get(b) ?? 0) + 1)
    })
    return [...say.entries()].map(([ad, sayi]) => ({ ad, sayi })).sort((a, b) => a.ad.localeCompare(b.ad, 'tr'))
  }, [pano])

  const gosterilen = useMemo(() => {
    if (!pano) return []
    const q = arama.trim().toLocaleLowerCase('tr')
    // Durum önceliği: DURUŞTA (kırmızı) → ÇALIŞIYOR (yeşil) → BOŞTA (gri).
    const oncelik: Record<Durum, number> = { durusta: 0, calisiyor: 1, bosta: 2 }
    return pano.tezgahlar
      .filter((t) => {
        if (bolum !== 'hepsi' && (t.masGrupAdi ?? '(grupsuz)') !== bolum) return false
        if (durum !== 'tumu' && t.durum !== durum) return false
        if (!q) return true
        return (
          t.kod.toLocaleLowerCase('tr').includes(q) ||
          t.ad.toLocaleLowerCase('tr').includes(q) ||
          (t.calisan?.adSoyad ?? '').toLocaleLowerCase('tr').includes(q)
        )
      })
      // Durum öncelikli, aynı durumda kod sırası (filtre/arama bu sıralamanın içinde).
      .sort((a, b) => oncelik[a.durum] - oncelik[b.durum] || a.kod.localeCompare(b.kod, 'tr'))
  }, [pano, arama, bolum, durum])

  return (
    <div
      ref={tvRef}
      className={tvModu ? 'ipro-izleme-tv fixed inset-0 z-50 overflow-auto bg-slate-950 p-6 text-slate-100' : ''}
    >
      {/* Gün özeti şeridi */}
      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl bg-slate-900 px-5 py-4 text-slate-100">
        <Activity className="h-6 w-6 text-emerald-400" />
        <Ozet etiket="Kapanan iş" deger={pano?.ozet.kapananIs ?? 0} />
        <Ozet etiket="İyi" deger={pano?.ozet.toplamIyi ?? 0} renk="text-emerald-300" />
        <Ozet etiket="Hurda" deger={pano?.ozet.toplamHurda ?? 0} renk="text-red-300" />
        <Ozet etiket="Aktif operatör" deger={pano?.ozet.aktifOperator ?? 0} />
        <div className="ml-auto flex items-center gap-2 text-sm text-slate-400">
          {hata && <span className="text-amber-400">bağlantı hatası — yeniden deneniyor</span>}
          <RefreshCw className="h-4 w-4" />
          {pano ? new Date(pano.olusturuldu).toLocaleTimeString('tr-TR') : '—'}
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-100 hover:bg-slate-800 hover:text-white"
            onClick={() => (tvModu ? tvKapat() : tvAc())}
            title="TV modu"
          >
            {tvModu ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Durum sayaç şeridi (Çalışıyor/Duruşta/Boşta) — her zaman görünür. */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <DurumSayac etiket="Çalışıyor" deger={pano?.ozet.calisiyor ?? 0} renk="text-emerald-300" />
        <DurumSayac etiket="Duruşta" deger={pano?.ozet.durusta ?? 0} renk="text-red-300" />
        <DurumSayac etiket="Boşta" deger={pano?.ozet.bosta ?? 0} renk="text-slate-400" />
      </div>

      {/* Araç çubuğu — TV modunda gizli. Bölüm + Durum açılır listeler + arama + sonuç sayacı. */}
      {!tvModu && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {/* Bölüm dropdown — trigger'da kısa (truncate), listede tam ad + tezgah sayısı */}
          <Select value={bolum} onValueChange={bolumSec}>
            <SelectTrigger className="h-9 w-[220px] gap-1" aria-label="Bölüm filtresi">
              <span className="shrink-0 text-slate-400">Bölüm:</span>
              <span className="min-w-0 flex-1 truncate text-left">
                <SelectValue />
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hepsi">Hepsi ({pano?.tezgahlar.length ?? 0})</SelectItem>
              {bolumler.map((b) => (
                <SelectItem key={b.ad} value={b.ad}>
                  {b.ad} ({b.sayi})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Durum dropdown */}
          <Select value={durum} onValueChange={(v) => durumSec(v as DurumFiltre)}>
            <SelectTrigger className="h-9 w-[170px] gap-1" aria-label="Durum filtresi">
              <span className="shrink-0 text-slate-400">Durum:</span>
              <span className="min-w-0 flex-1 truncate text-left">
                <SelectValue />
              </span>
            </SelectTrigger>
            <SelectContent>
              {DURUM_FILTRELER.map((d) => (
                <SelectItem key={d.key} value={d.key}>{d.etiket}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative min-w-[180px] flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input value={arama} onChange={(e) => setArama(e.target.value)} placeholder="Tezgah, ad veya operatör ara…" className="pl-8" />
          </div>

          <Badge variant="outline">{gosterilen.length} tezgah</Badge>
        </div>
      )}

      {/* Grid */}
      {ilkYukleme ? (
        <p className={`py-16 text-center text-sm ${tvModu ? 'text-slate-400' : 'text-slate-500'}`}>Yükleniyor…</p>
      ) : gosterilen.length === 0 ? (
        <div className={`py-16 text-center ${tvModu ? 'text-slate-400' : 'text-slate-500'}`}>
          <Factory className="mx-auto mb-3 h-10 w-10 opacity-40" />
          <p>Filtreye uyan tezgah yok.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {gosterilen.map((t) => (
            <Kart key={t.id} tezgah={t} tv={tvModu} esik={pano?.esik ?? 50} onClick={() => setSeciliId(t.id)} />
          ))}
        </div>
      )}

      {/* IFS kuyruk sağlığı — köşe şeridi, TV modunda gizli */}
      {!tvModu && pano && (
        <div className="mt-6 flex flex-wrap items-center gap-4 rounded-xl border px-5 py-3 text-sm">
          <AlertTriangle className={`h-4 w-4 ${pano.kuyruk.bekleyen > 0 || pano.kuyruk.hataliKayit > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
          <span className="font-medium text-slate-600">IFS kuyruğu</span>
          <span>bekleyen: <strong>{pano.kuyruk.bekleyen}</strong></span>
          <span>en eski: {pano.kuyruk.enEskiBeklemeAt ? new Date(pano.kuyruk.enEskiBeklemeAt).toLocaleString('tr-TR') : '—'}</span>
          <span className={pano.kuyruk.hataliKayit > 0 ? 'text-red-600' : ''}>hata: <strong>{pano.kuyruk.hataliKayit}</strong></span>
          <span className="ml-auto text-xs text-slate-400">planlama için değil — kuyruk erken uyarısı</span>
        </div>
      )}

      {/* Kart detay dialog — TV modunda da açılabilir; portal body'ye gider. OEE bileşenleri pano'dan. */}
      <DetayDialog
        tezgahId={seciliId}
        canliOee={pano?.tezgahlar.find((t) => t.id === seciliId)?.canliOee ?? null}
        esik={pano?.esik ?? 50}
        onClose={() => setSeciliId(null)}
      />
    </div>
  )
}

function DurumSayac({ etiket, deger, renk }: { etiket: string; deger: number; renk: string }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-center">
      <div className={`text-3xl font-bold ${renk}`}>{deger}</div>
      <div className="mt-0.5 text-xs uppercase tracking-wider text-slate-400">{etiket}</div>
    </div>
  )
}

function Ozet({ etiket, deger, renk = '' }: { etiket: string; deger: number; renk?: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`text-2xl font-bold ${renk}`}>{deger}</span>
      <span className="text-sm text-slate-400">{etiket}</span>
    </div>
  )
}

function Kart({ tezgah, tv, esik, onClick }: { tezgah: Tezgah; tv: boolean; esik: number; onClick: () => void }) {
  const c = tezgah.calisan
  const durum = tezgah.durum
  const sure = c ? sureBicim(Date.now() - new Date(c.baslatildiAt).getTime()) : null
  const durusSure = tezgah.durus ? sureBicim(Date.now() - new Date(tezgah.durus.baslangicAt).getTime()) : null

  // Renk mantığı: çalışıyor=yeşil, duruşta=kırmızı, boşta=gri. TV (dark) için ayrı tonlar.
  const kenar =
    durum === 'calisiyor'
      ? 'border-emerald-500/70 bg-emerald-50 dark:bg-emerald-950/40'
      : durum === 'durusta'
        ? 'border-red-500/70 bg-red-50 dark:bg-red-950/40'
        : tv
          ? 'border-slate-700 bg-slate-900'
          : 'border-slate-200 bg-slate-50'
  const tvYesil = tv && durum === 'calisiyor' ? 'bg-emerald-900/40 border-emerald-500/70' : ''
  const tvKirmizi = tv && durum === 'durusta' ? 'bg-red-900/40 border-red-500/70' : ''
  const nokta = durum === 'calisiyor' ? 'bg-emerald-500' : durum === 'durusta' ? 'bg-red-500' : 'bg-slate-300'
  // Metin: TV'de her durumda açık renk (okunurluk). Işıklı zeminde koyu.
  const anaMetin = tv ? 'text-slate-100' : 'text-slate-900'
  const altMetin = tv ? 'text-slate-300' : 'text-slate-500'

  // Tek görünüm: çalışan künyesi (durum) + canlı OEE halka şeridi.
  const kunye =
    durum === 'calisiyor' && c ? (
      <div className="mt-2 space-y-1">
        <p className={`truncate text-sm font-medium ${anaMetin}`}>{c.adSoyad ?? c.sicilNo ?? '—'}</p>
        <Satir etiket="İş emri" deger={c.ifsOrderNo ?? '—'} tv={tv} />
        <Satir etiket="Operasyon" deger={c.ifsOperationNo != null ? String(c.ifsOperationNo) : '—'} tv={tv} />
        <Satir etiket="Malzeme" deger={c.ifsPartDescription ?? c.ifsPartNo ?? '—'} tv={tv} baslik={c.ifsPartNo ?? undefined} />
        <Satir etiket="Duruş" deger="—" tv={tv} />
        <p className="pt-0.5 text-xs font-semibold text-emerald-500">{sure}</p>
      </div>
    ) : durum === 'durusta' ? (
      <div className="mt-2 space-y-1">
        <p className="text-sm font-semibold text-red-500">DURUŞTA</p>
        <Satir etiket="Sebep" deger={tezgah.durus?.sebep ?? '—'} tv={tv} />
        <p className="pt-0.5 text-xs font-semibold text-red-500">{durusSure}</p>
      </div>
    ) : (
      <p className={`mt-2 text-sm ${altMetin}`}>boşta</p>
    )

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition-colors hover:ring-2 hover:ring-[#1B4F72]/40 ${kenar} ${tvYesil} ${tvKirmizi}`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-lg font-bold ${anaMetin}`}>{tezgah.kod}</span>
        <span className="flex items-center gap-1">
          {tezgah.sinyalli && <Signal className={`h-3.5 w-3.5 ${altMetin}`} />}
          <span className={`h-2.5 w-2.5 rounded-full ${nokta}`} />
        </span>
      </div>
      <p className={`truncate text-xs ${altMetin}`}>{tezgah.ad}</p>

      {kunye}
      <OeeSerit c={tezgah.canliOee ?? null} tv={tv} esik={esik} />
    </button>
  )
}

/** Etiketli tek satır — "İş emri: 12345". Uzun değer kırpılır, tam metin title'da. */
function Satir({ etiket, deger, tv, baslik }: { etiket: string; deger: string; tv: boolean; baslik?: string }) {
  return (
    <p className={`flex gap-1 text-xs ${tv ? 'text-slate-300' : 'text-slate-600'}`} title={baslik}>
      <span className={tv ? 'text-slate-500' : 'text-slate-400'}>{etiket}:</span>
      <span className="truncate font-medium">{deger}</span>
    </p>
  )
}

function dkBicim(dk: number): string {
  if (dk < 1) return '0dk'
  if (dk < 60) return `${dk}dk`
  return `${Math.floor(dk / 60)}s ${dk % 60}dk`
}
const trTarih2 = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('tr-TR') : '—')

function DetayDialog({ tezgahId, canliOee, esik, onClose }: { tezgahId: string | null; canliOee: CanliOee | null; esik: number; onClose: () => void }) {
  const [detay, setDetay] = useState<Detay | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [, tik] = useState(0)

  useEffect(() => {
    if (!tezgahId) return
    let iptal = false
    setDetay(null)
    setHata(null)
    fetch(`/api/ipro/izleme/tezgah/${tezgahId}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (iptal) return
        if (d?.ok) setDetay(d)
        else setHata(d?.error ?? 'Detay alınamadı')
      })
      .catch(() => !iptal && setHata('Bağlantı hatası'))
    return () => {
      iptal = true
    }
  }, [tezgahId])

  // Canlı süre için saniyelik tik.
  useEffect(() => {
    const id = setInterval(() => tik((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const acik = !!tezgahId
  const aktif = detay?.aktifIs
  const aktifSure = aktif?.baslatildiAt ? sureBicim(Date.now() - new Date(aktif.baslatildiAt).getTime()) : '—'
  const durusSure = detay?.durus ? sureBicim(Date.now() - new Date(detay.durus.baslangicAt).getTime()) : null
  const sd = detay?.sureDagilimi
  const toplamDurusDk =
    detay?.bugunDuruslar.reduce((a, d) => {
      const end = d.bitisAt ? new Date(d.bitisAt).getTime() : Date.now()
      return a + Math.max(0, (end - new Date(d.baslangicAt).getTime()) / 60000)
    }, 0) ?? 0
  const planCevrim =
    aktif?.ifsMachRunFactor != null && aktif.ifsMachRunFactor > 0
      ? `${aktif.ifsMachRunFactor} ${aktif.ifsRunTimeCode ?? ''}`.trim()
      : '—'
  const uret = detay?.uretim
  const yuzde = uret && uret.planlanan ? Math.min(100, Math.round((uret.gerceklesen / uret.planlanan) * 100)) : null

  const rozet =
    detay?.durum === 'durusta'
      ? { t: 'DURUŞTA', c: 'bg-red-100 text-red-700' }
      : detay?.durum === 'calisiyor'
        ? { t: 'ÇALIŞIYOR', c: 'bg-emerald-100 text-emerald-700' }
        : { t: 'BOŞTA', c: 'bg-slate-100 text-slate-500' }

  return (
    <Dialog open={acik} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Factory className="h-5 w-5 text-[#1B4F72]" />
            <span>{detay ? detay.kod : 'Tezgah'}</span>
            {detay && <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${rozet.c}`}>{rozet.t}</span>}
          </DialogTitle>
          <DialogDescription>
            {detay ? `${detay.ad}${detay.masGrupAdi ? ` · ${detay.masGrupAdi}` : ''}` : 'Yükleniyor…'}
          </DialogDescription>
        </DialogHeader>

        {hata ? (
          <p className="py-6 text-center text-sm text-red-600">{hata}</p>
        ) : !detay ? (
          <p className="py-10 text-center text-sm text-slate-400">Yükleniyor…</p>
        ) : (
          <div className="space-y-5">
            {/* Aktif iş / durum */}
            {detay.durum === 'durusta' ? (
              <div className="rounded-xl bg-red-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-red-500">Duruşta</div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-xl font-bold text-red-700">{detay.durus?.sebep ?? 'Duruş'}</span>
                  <span className="font-mono text-lg text-red-600">{durusSure}</span>
                </div>
              </div>
            ) : aktif ? (
              <div>
                <div className="mb-3 flex items-baseline justify-between">
                  <span className="text-lg font-bold text-slate-800">👤 {aktif.operator ?? '—'}</span>
                  <span className="font-mono text-2xl font-semibold text-emerald-600">{aktifSure}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                  <Alan2 e="İş emri" d={`${aktif.ifsOrderNo ?? '—'} · Op ${aktif.ifsOperationNo ?? '—'}`} />
                  <Alan2 e="Malzeme" d={aktif.ifsPartNo ?? '—'} alt={aktif.ifsPartDescription ?? undefined} />
                  <Alan2 e="Planlanan adet" d={aktif.ifsQtyDue != null ? String(aktif.ifsQtyDue) : '—'} />
                  <Alan2 e="Teslim" d={trTarih2(aktif.ifsDueDate)} />
                  <Alan2 e="İhtiyaç" d={trTarih2(aktif.ifsNeedDate)} />
                  <Alan2 e="Planlı çevrim" d={planCevrim} />
                  <Alan2 e="PLC" d={detay.sinyalli ? '📶 Sinyalli' : 'Sinyalsiz'} />
                  <Alan2 e="Başlangıç" d={aktif.baslatildiAt ? new Date(aktif.baslatildiAt).toLocaleTimeString('tr-TR') : '—'} />
                </div>
              </div>
            ) : (
              <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">Boşta — açık iş yok.</p>
            )}

            {/* Üretim ilerleme */}
            <section>
              <SecBaslik>Üretim ilerleme</SecBaslik>
              {uret && uret.planlanan ? (
                <>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="font-semibold text-slate-700">
                      {uret.gerceklesen} / {uret.planlanan}
                    </span>
                    <span className="text-slate-500">%{yuzde}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${yuzde}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-slate-400">bugün kapanan iyi toplamı; poller gelince canlı sayaçla zenginleşir</p>
                </>
              ) : (
                <p className="text-sm text-slate-400">Planlanan adet yok — {uret?.gerceklesen ?? 0} adet üretildi (bugün).</p>
              )}
            </section>

            {/* Çevrim karşılaştırma */}
            <section>
              <SecBaslik>Çevrim (planlı vs ort.)</SecBaslik>
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <span className="text-slate-400">planlı</span> <span className="font-semibold text-slate-700">{planCevrim}</span>
                </div>
                <div className="text-slate-300">|</div>
                <div>
                  <span className="text-slate-400">ort.</span> <span className="font-semibold text-slate-400">—</span>
                </div>
                <span className="ml-auto text-xs text-slate-400">ort. çevrim poller ile</span>
              </div>
            </section>

            {/* Süre dağılımı */}
            {sd && sd.elapsedDk > 0 && (
              <section>
                <SecBaslik>Bugün süre dağılımı ({dkBicim(sd.elapsedDk)})</SecBaslik>
                <div className="flex h-4 overflow-hidden rounded-full bg-slate-100">
                  <StackSeg dk={sd.calismaDk} toplam={sd.elapsedDk} renk="bg-emerald-500" />
                  <StackSeg dk={sd.durusDk} toplam={sd.elapsedDk} renk="bg-red-500" />
                  <StackSeg dk={sd.bostaDk} toplam={sd.elapsedDk} renk="bg-slate-300" />
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-xs">
                  <Lej renk="bg-emerald-500" e="Çalışma" v={dkBicim(sd.calismaDk)} />
                  <Lej renk="bg-red-500" e="Duruş" v={dkBicim(sd.durusDk)} />
                  <Lej renk="bg-slate-300" e="Boşta" v={dkBicim(sd.bostaDk)} />
                </div>
              </section>
            )}

            {/* OEE göstergeleri — canlı (açık iş + OEE görünümü). Yoksa placeholder. */}
            <section>
              <SecBaslik>OEE (canlı)</SecBaslik>
              {canliOee ? (
                <>
                  <div className="grid grid-cols-4 place-items-center gap-2">
                    <Halka deger={canliOee.oeeCanli} boyut={72} kalinlik={8} etiket="OEE" />
                    <Halka deger={canliOee.availability} boyut={72} kalinlik={8} etiket="Kullan." />
                    <Halka deger={canliOee.performance} boyut={72} kalinlik={8} etiket="Perf." />
                    <Halka deger={null} boyut={72} kalinlik={8} etiket="Kalite" />
                  </div>
                  <div className="mt-2 space-y-1 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                    <p>• Üretilen (canlı): <b>{canliOee.uretilen}</b> adet · planlı süre {Math.round(canliOee.planliSaniye / 60)}dk · duruş {Math.round(canliOee.durusSaniye / 60)}dk</p>
                    <p>• <b>Kalite</b> açık işte hesaplanmaz — iş bitince; <b>tam OEE iş kapanınca</b> motordan.</p>
                    {!canliOee.idealGuvenilir ? (
                      <p>• <b>Performans</b> için ideal çevrim güvenilir değil — veri birikiyor (<b>{canliOee.ornekSayisi}/{esik}</b>).</p>
                    ) : null}
                    {canliOee.durum === 'PLANLI_YOK' ? <p>• Planlı süre 0 (vardiya/tatil dışı) — Kullanılabilirlik hesaplanamıyor.</p> : null}
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-2">
                    <MiniKart e="OEE" />
                    <MiniKart e="Perf." />
                    <MiniKart e="Kull." />
                    <MiniKart e="Kalite" />
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {detay.aktifIs ? 'OEE görünümüne geçince canlı hesaplanır.' : 'Açık iş yok — OEE hesaplanmaz.'}
                  </p>
                </>
              )}
            </section>

            {/* PLC sayacı placeholder */}
            <section>
              <SecBaslik>PLC sayacı</SecBaslik>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Ph e="Baskı sayısı" />
                <Ph e="Gerçekleşen (poller)" />
                <Ph e="Ort. çevrim" />
              </div>
              <p className="mt-1 text-xs text-slate-400">poller gelince dolar; sinyalsizde bitir anında girilir</p>
            </section>

            {/* Bugünkü duruşlar */}
            <section>
              <SecBaslik>
                Bugünkü duruşlar ({detay.bugunDuruslar.length}) · toplam {dkBicim(Math.round(toplamDurusDk))}
              </SecBaslik>
              {detay.bugunDuruslar.length === 0 ? (
                <p className="text-sm text-slate-400">Bugün duruş yok.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-2 py-1.5 text-left">Sebep</th>
                        <th className="px-2 py-1.5 text-left">Başlangıç</th>
                        <th className="px-2 py-1.5 text-right">Süre</th>
                        <th className="px-2 py-1.5 text-left">Yorum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detay.bugunDuruslar.map((d) => {
                        const end = d.bitisAt ? new Date(d.bitisAt).getTime() : Date.now()
                        const dk = Math.round(Math.max(0, (end - new Date(d.baslangicAt).getTime()) / 60000))
                        return (
                          <tr key={d.id} className="border-t">
                            <td className="px-2 py-1.5">
                              {d.sebep ?? '—'}
                              {!d.bitisAt && <span className="ml-1 text-red-500">●</span>}
                            </td>
                            <td className="px-2 py-1.5 text-slate-500">
                              {new Date(d.baslangicAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-2 py-1.5 text-right font-medium">{dkBicim(dk)}</td>
                            <td className="max-w-[220px] px-2 py-1.5 text-slate-600" title={d.yorum ?? undefined}>
                              {d.yorum ? <span className="line-clamp-2">{d.yorum}</span> : <span className="text-slate-300">—</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Bugün kapanan işler */}
            <section>
              <SecBaslik>Bugün kapanan işler ({detay.bugunKapanan.length})</SecBaslik>
              {detay.bugunKapanan.length === 0 ? (
                <p className="text-sm text-slate-400">Bugün kapanan iş yok.</p>
              ) : (
                <div className="max-h-56 overflow-y-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-2 py-1.5 text-left">İş / Op</th>
                        <th className="px-2 py-1.5 text-left">Malzeme</th>
                        <th className="px-2 py-1.5 text-right">İyi</th>
                        <th className="px-2 py-1.5 text-right">Hurda</th>
                        <th className="px-2 py-1.5 text-right">Bitiş</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detay.bugunKapanan.map((s) => (
                        <tr key={s.id} className="border-t">
                          <td className="px-2 py-1.5">
                            {s.ifsOrderNo ?? '—'}
                            <span className="text-slate-400">/{s.ifsOperationNo ?? '—'}</span>
                          </td>
                          <td className="max-w-[140px] truncate px-2 py-1.5" title={s.ifsPartNo ?? undefined}>
                            {s.ifsPartDescription ?? s.ifsPartNo ?? '—'}
                          </td>
                          <td className="px-2 py-1.5 text-right font-medium text-emerald-600">{s.qtyComplete}</td>
                          <td className="px-2 py-1.5 text-right text-red-600">{s.qtyScrap}</td>
                          <td className="px-2 py-1.5 text-right text-slate-500">
                            {s.bitirildiAt ? new Date(s.bitirildiAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SecBaslik({ children }: { children: ReactNode }) {
  return <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">{children}</h3>
}
function Alan2({ e, d, alt }: { e: string; d: string; alt?: string }) {
  return (
    <div>
      <div className="text-xs text-slate-400">{e}</div>
      <div className="truncate font-medium text-slate-800" title={alt}>
        {d}
      </div>
      {alt && d !== alt && <div className="truncate text-xs text-slate-500">{alt}</div>}
    </div>
  )
}
function StackSeg({ dk, toplam, renk }: { dk: number; toplam: number; renk: string }) {
  const w = toplam > 0 ? (dk / toplam) * 100 : 0
  if (w <= 0) return null
  return <div className={`${renk} transition-all duration-700`} style={{ width: `${w}%` }} />
}
function Lej({ renk, e, v }: { renk: string; e: string; v: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${renk}`} />
      <span className="text-slate-500">{e}</span>
      <span className="font-medium text-slate-700">{v}</span>
    </span>
  )
}
function MiniKart({ e }: { e: string }) {
  return (
    <div className="rounded-lg border border-slate-200 py-2 text-center">
      <div className="text-lg font-bold text-slate-400">%—</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-400">{e}</div>
    </div>
  )
}
function Ph({ e }: { e: string }) {
  return (
    <div className="rounded-lg bg-slate-50 py-2">
      <div className="text-lg font-bold text-slate-300">—</div>
      <div className="text-[10px] text-slate-400">{e}</div>
    </div>
  )
}
