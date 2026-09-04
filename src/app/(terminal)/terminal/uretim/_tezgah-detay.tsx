'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Factory,
  Play,
  Search,
  Loader2,
  ArrowLeft,
  CircleCheck,
  AlertTriangle,
  TrendingDown,
  CheckCircle2,
  Plus,
  Minus,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { TERMINAL_ACCENT } from '../_shared'

// İzleme panosundaki tezgah detay modal'ının TERMINAL KOPYASI. Kaynak:
// src/components/ipro/izleme/IzlemeClient.tsx → DetayDialog (export edilmemiş,
// private). O dosya izleme panosunun; orijinale dokunmadan buraya kopyalandı.
// Fark: veri terminal ikizi route'undan (/api/terminal/uretim/tezgah/[id]),
// vurgu rengi TERMINAL_ACCENT (hardcode hex yok), IPRO'da tanımsız tezgah için
// ayrı mesaj. Alan yapısı/görsel izleme modal'ıyla birebir.

type Durum = 'calisiyor' | 'durusta' | 'bosta'

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
type DurusSatiri = {
  id: string
  sebep: string | null
  yorum: string | null
  baslangicAt: string
  bitisAt: string | null
  operator: string | null
}
type Durus = { baslangicAt: string; sebep: string | null }
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
  // Açık işte canlı PLC üretimi (terminal route hesaplar): iş penceresi Σdelta + son sinyal.
  // seriVar=false → hiç delta yok. Kapalı/geçmiş işlerde null (mevcut uretim davranışı).
  canliUretim: { adet: number; seriVar: boolean; sonSinyal: string | null } | null
  // Açık işte canlı OEE (route: oee-canli.ts + planliSaniyeHesapla). Quality açık işte null →
  // oeeCanli kalite hariç. idealKaynak: 'OLCULEN' (güvenilir ideal) | 'IFS' (planlı çevrim) | null.
  canliOee: {
    availability: number | null
    performance: number | null
    oeeCanli: number | null
    planliSaniye: number
    durusSaniye: number
    uretilen: number
    idealSaniyeAdet: number | null
    idealKaynak: 'OLCULEN' | 'IFS' | null
    ornekSayisi: number
  } | null
}

/** ms → "1s 12dk" / "12dk" / "45sn". Canlı süre için. */
function sureBicim(ms: number): string {
  const dk = Math.floor(ms / 60000)
  if (dk < 1) return `${Math.floor(ms / 1000)}sn`
  if (dk < 60) return `${dk}dk`
  return `${Math.floor(dk / 60)}s ${dk % 60}dk`
}
function dkBicim(dk: number): string {
  if (dk < 1) return '0dk'
  if (dk < 60) return `${dk}dk`
  return `${Math.floor(dk / 60)}s ${dk % 60}dk`
}
const trTarih2 = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('tr-TR') : '—')
const trSaat = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '—'
/** Türkçe ondalık (virgül). basamak: gösterilecek ondalık hane. */
function trSayi(n: number, basamak = 1): string {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: basamak, maximumFractionDigits: basamak })
}
/**
 * IFS çevrim faktörü + RunTimeCode → saniye/adet. UnitsHour (adet/saat) → 3600/faktör;
 * HoursUnit (saat/adet) → faktör*3600. Faktör yok/0 veya bilinmeyen kod → null.
 */
function cevrimSaniye(faktor: number | null | undefined, kod: string | null | undefined): number | null {
  if (!faktor || faktor <= 0) return null
  if (kod === 'UnitsHour') return 3600 / faktor
  if (kod === 'HoursUnit') return faktor * 3600
  return null
}

// OEE gösterge eşikleri — TEK yer. hedef = success sınırı, sinir = warning/danger sınırı.
// Yüzde (0..100) bazlı. Renk: pct>=hedef success, sinir<=pct<hedef warning, pct<sinir danger.
const OEE_ESIK = {
  OEE: { hedef: 60, sinir: 45 },
  PERF: { hedef: 85, sinir: 70 },
  KULL: { hedef: 90, sinir: 75 },
  KALITE: { hedef: 99, sinir: 95 },
} as const

// Canlılık nabzı — CSS keyframes (opacity+scale). prefers-reduced-motion'da kapanır.
// Bu dosyaya özel; tailwind.config'e DOKUNMADAN inline <style> ile enjekte edilir.
const NABIZ_CSS = `
@keyframes iproNabiz { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .4; transform: scale(.7); } }
.ipro-nabiz { animation: iproNabiz 1.8s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .ipro-nabiz { animation: none; } }
`

type AkisDurum = { renk: 'yesil' | 'amber' | 'kirmizi'; nabiz: boolean; metin: string }
type AkisEsik = { yesilMs: number; amberMs: number }
/**
 * Canlılık eşikleri (ms) — TEK yer. Planlı çevrim (sn) varsa eşik ondan türer: yeşil <çevrim×2,
 * amber çevrim×2..×5, kırmızı ×5 üstü. Enjeksiyon gibi uzun çevrimde (189 sn) normal çalışırken
 * amber görünmesin diye. Her eşik [60sn, 30dk] arasına kısılır (çok kısa/uzun çevrim koruması).
 * Planlı çevrim yoksa (null/0) sabit eşiklere düşer: 2dk / 15dk.
 */
function akisEsikleri(planCevrimSn: number | null): AkisEsik {
  if (planCevrimSn == null || planCevrimSn <= 0) return { yesilMs: 2 * 60000, amberMs: 15 * 60000 }
  const kis = (ms: number) => Math.min(30 * 60000, Math.max(60000, ms))
  return { yesilMs: kis(planCevrimSn * 2 * 1000), amberMs: kis(planCevrimSn * 5 * 1000) }
}
/**
 * Son sinyal yaşına göre canlılık durumu. Eşikler akisEsikleri'nden gelir (çevrim bazlı ya da
 * sabit). simdiMs render anında geçilir (1sn'lik tik ile tazelenir) → metin canlı güncellenir.
 */
function akisDurumu(sonSinyal: string | null, simdiMs: number, esik: AkisEsik): AkisDurum {
  const yas = sonSinyal ? simdiMs - new Date(sonSinyal).getTime() : Infinity
  if (yas < esik.yesilMs) return { renk: 'yesil', nabiz: true, metin: `canlı · ${sureBicim(yas)} önce` }
  if (yas < esik.amberMs) return { renk: 'amber', nabiz: false, metin: `${sureBicim(yas)} önce` }
  return { renk: 'kirmizi', nabiz: false, metin: sonSinyal ? `sinyal yok · ${sureBicim(yas)}` : 'sinyal yok' }
}

/**
 * Terminal tezgah detay modal'ı. Açık/kapalı = `seciliTezgah` (ResourceId).
 * IPRO karşılığı varsa `iproId` ile terminal route'undan detay çeker; yoksa
 * "IPRO'da tanımlı değil" mesajı gösterir (kart yine tıklanabilir — Melih düzeltecek).
 */
export function TezgahDetayModal({
  seciliTezgah,
  iproId,
  canAdmin,
  dept,
  onClose,
}: {
  seciliTezgah: string | null
  iproId: string | null
  /** ipro.admin — "Uzaktan iş başlat" akışını açar. */
  canAdmin: boolean
  /** Seçili departman (WC kodu) — açık iş emirlerini süzmek için. */
  dept: string | null
  onClose: () => void
}) {
  const [detay, setDetay] = useState<Detay | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [, tik] = useState(0)
  // Uzaktan başlatma / bitirme paneli açık mı + başarı sonrası detay yenileme sayacı.
  const [baslatModu, setBaslatModu] = useState(false)
  const [bitirModu, setBitirModu] = useState(false)
  const [yenile, setYenile] = useState(0)

  // Tezgah değişince panelleri kapat (bir önceki tezgahtan taşınmasın).
  useEffect(() => {
    setBaslatModu(false)
    setBitirModu(false)
  }, [seciliTezgah])

  useEffect(() => {
    if (!seciliTezgah || !iproId) return
    let iptal = false
    setDetay(null)
    setHata(null)
    fetch(`/api/terminal/uretim/tezgah/${iproId}`, { cache: 'no-store' })
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
  }, [seciliTezgah, iproId, yenile])

  // Canlı süre için saniyelik tik.
  useEffect(() => {
    const id = setInterval(() => tik((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const acik = !!seciliTezgah
  const tanimsiz = acik && !iproId
  const aktif = detay?.aktifIs
  const aktifSure = aktif?.baslatildiAt ? sureBicim(Date.now() - new Date(aktif.baslatildiAt).getTime()) : '—'
  const durusSure = detay?.durus ? sureBicim(Date.now() - new Date(detay.durus.baslangicAt).getTime()) : null
  const sd = detay?.sureDagilimi
  const toplamDurusDk =
    detay?.bugunDuruslar.reduce((a, d) => {
      const end = d.bitisAt ? new Date(d.bitisAt).getTime() : Date.now()
      return a + Math.max(0, (end - new Date(d.baslangicAt).getTime()) / 60000)
    }, 0) ?? 0
  // Açık işte üretim = canlı PLC Σdelta (route'tan); kapalı/geçmişte mevcut gerceklesen.
  const canli = detay?.canliUretim ?? null
  const acikIsVar = !!aktif
  const gerceklesenAdet = acikIsVar && canli ? canli.adet : (detay?.uretim.gerceklesen ?? 0)
  const planlananAdet = detay?.uretim.planlanan ?? null
  const yuzde =
    planlananAdet && planlananAdet > 0
      ? Math.min(100, Math.round((gerceklesenAdet / planlananAdet) * 100))
      : null

  // Çevrim — saniye birincil. Planlı: IFS faktör+kod. Gerçekleşen: iş süresi / Σdelta.
  const planCevrimSn = cevrimSaniye(aktif?.ifsMachRunFactor, aktif?.ifsRunTimeCode)
  const isSuresiSn =
    aktif?.baslatildiAt ? Math.max(0, (Date.now() - new Date(aktif.baslatildiAt).getTime()) / 1000) : 0
  const gercCevrimSn =
    acikIsVar && canli && canli.adet > 0 && isSuresiSn > 0 ? isSuresiSn / canli.adet : null
  const cevrimSapmaYuzde =
    planCevrimSn && planCevrimSn > 0 && gercCevrimSn != null
      ? Math.round(((gercCevrimSn - planCevrimSn) / planCevrimSn) * 100)
      : null
  // Grid'deki hızlı gösterim: saniye; çevrilemezse ham faktör+kod; yoksa —.
  const planCevrimGrid =
    planCevrimSn != null
      ? `${trSayi(planCevrimSn, 0)} sn`
      : aktif?.ifsMachRunFactor
        ? `${aktif.ifsMachRunFactor} ${aktif.ifsRunTimeCode ?? ''}`.trim()
        : '—'

  // Canlılık akış durumu — yalnız açık işte. Eşik planlı çevrimden türer (uzun çevrimde amber
  // yanlış-pozitifi önlenir); planlı çevrim yoksa sabit 2dk/15dk. Date.now() render anında okunur;
  // 1sn'lik tik zaten yeniden render ettiği için metin/renk canlı tazelenir.
  const akis = acikIsVar ? akisDurumu(canli?.sonSinyal ?? null, Date.now(), akisEsikleri(planCevrimSn)) : null
  const akisTaze = akis?.renk === 'yesil'

  // Canlı OEE (açık işte route'tan). Null bileşenlerin sebebi UI'da tek satır gösterilir.
  const co = detay?.canliOee ?? null
  const calismaSn = co ? co.planliSaniye - co.durusSaniye : 0
  const perfSebep = !co
    ? ''
    : co.idealSaniyeAdet == null
      ? 'çevrim referansı yok'
      : calismaSn <= 0
        ? 'planlı süre yok'
        : ''
  const idealEtiket =
    co?.idealKaynak === 'OLCULEN'
      ? `ölçülen ideal (${co.ornekSayisi}/50)`
      : co?.idealKaynak === 'IFS'
        ? 'IFS planı'
        : null

  const rozet =
    detay?.durum === 'durusta'
      ? { t: 'DURUŞTA', c: 'bg-red-100 text-red-700' }
      : detay?.durum === 'calisiyor'
        ? { t: 'ÇALIŞIYOR', c: 'bg-emerald-100 text-emerald-700' }
        : { t: 'BOŞTA', c: 'bg-slate-100 text-slate-500' }

  return (
    <Dialog open={acik} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <style>{NABIZ_CSS}</style>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Factory className="h-5 w-5" style={{ color: TERMINAL_ACCENT }} />
            <span>{detay ? detay.kod : (seciliTezgah ?? 'Tezgah')}</span>
            {detay && <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${rozet.c}`}>{rozet.t}</span>}
          </DialogTitle>
          <DialogDescription>
            {tanimsiz
              ? 'IPRO’da tanımlı değil'
              : detay
                ? `${detay.ad}${detay.masGrupAdi ? ` · ${detay.masGrupAdi}` : ''}`
                : 'Yükleniyor…'}
          </DialogDescription>
        </DialogHeader>

        {tanimsiz ? (
          <div className="rounded-xl bg-slate-50 px-4 py-6 text-center">
            <Factory className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">Bu tezgah IPRO’da tanımlı değil.</p>
            <p className="mt-1 text-xs text-slate-400">
              IFS kaynağı ({seciliTezgah}) var ama IPRO karşılığı yok — durum/iş bilgisi okunamıyor.
            </p>
          </div>
        ) : hata ? (
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
                  <Alan2 e="Planlı çevrim" d={planCevrimGrid} />
                  <Alan2 e="PLC" d={detay.sinyalli ? '📶 Sinyalli' : 'Sinyalsiz'} />
                  <Alan2 e="Başlangıç" d={aktif.baslatildiAt ? new Date(aktif.baslatildiAt).toLocaleTimeString('tr-TR') : '—'} />
                </div>
              </div>
            ) : (
              <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">Boşta — açık iş yok.</p>
            )}

            {/* Uzaktan iş başlat — yalnız ipro.admin, IPRO tanımlı tezgahta, açık iş/duruş YOKKEN. */}
            {canAdmin && iproId && !detay.aktifIs && detay.durum !== 'durusta' && (
              baslatModu ? (
                <UzaktanBaslatPanel
                  tezgahId={iproId}
                  tezgahKod={detay.kod}
                  dept={dept}
                  onIptal={() => setBaslatModu(false)}
                  onBasarili={() => {
                    setBaslatModu(false)
                    setYenile((n) => n + 1)
                  }}
                />
              ) : (
                <Button
                  onClick={() => setBaslatModu(true)}
                  className="w-full gap-2 text-white"
                  style={{ background: TERMINAL_ACCENT }}
                >
                  <Play className="h-4 w-4" /> Uzaktan iş başlat
                </Button>
              )
            )}

            {/* İşi bitir — yalnız ipro.admin, IPRO tanımlı tezgahta, açık iş VARKEN, duruş YOKKEN.
                Canlı sayaç üretimini ön dolgu olarak geçer; POST /api/terminal/uzaktan-bitir. */}
            {canAdmin && iproId && detay.aktifIs && detay.durum !== 'durusta' && (
              bitirModu ? (
                <UzaktanBitirPanel
                  productionLogId={detay.aktifIs.id}
                  tezgahKod={detay.kod}
                  onDolguIyi={gerceklesenAdet}
                  onIptal={() => setBitirModu(false)}
                  onBasarili={() => {
                    setBitirModu(false)
                    setYenile((n) => n + 1)
                  }}
                />
              ) : (
                <Button
                  onClick={() => setBitirModu(true)}
                  variant="outline"
                  className="w-full gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                >
                  <CheckCircle2 className="h-4 w-4" /> İşi bitir
                </Button>
              )
            )}

            {/* Üretim ilerleme — açık işte CANLI PLC Σdelta; kapalıda kapanan iyi toplamı. */}
            <section>
              <div className="flex items-center justify-between">
                <SecBaslik>Üretim ilerleme</SecBaslik>
                {akis && <AkisRozet durum={akis} />}
              </div>
              {planlananAdet ? (
                <>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="font-semibold text-slate-700">
                      {gerceklesenAdet} / {planlananAdet}
                    </span>
                    <span className="text-slate-500">%{yuzde ?? 0}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    {/* Çubuk rengi duruma bağlı: canlı (taze sinyal) → success (emerald), değilse muted (slate). */}
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        acikIsVar ? (akisTaze ? 'bg-emerald-500' : 'bg-slate-300') : 'bg-emerald-500'
                      }`}
                      style={{ width: `${yuzde ?? 0}%` }}
                    />
                  </div>
                  <UretimAciklama acikIsVar={acikIsVar} canli={canli} />
                </>
              ) : acikIsVar ? (
                canli?.seriVar ? (
                  <p className="text-sm text-slate-600">
                    {gerceklesenAdet} adet üretildi (canlı PLC, son sinyal {trSaat(canli.sonSinyal)})
                  </p>
                ) : (
                  <p className="text-sm text-amber-600">PLC sayacından sinyal gelmedi</p>
                )
              ) : (
                <p className="text-sm text-slate-400">Planlanan adet yok — {gerceklesenAdet} adet üretildi (bugün).</p>
              )}
            </section>

            {/* Çevrim — saniye birincil (MAS ile aynı birim); iki kutu + sapma uyarısı. */}
            <section>
              <SecBaslik>Çevrim (planlı vs gerçekleşen)</SecBaslik>
              <div className="grid grid-cols-2 gap-2">
                <CevrimKutu baslik="Planlı" sn={planCevrimSn} />
                <CevrimKutu
                  baslik="Gerçekleşen"
                  sn={gercCevrimSn}
                  uyari={cevrimSapmaYuzde != null && cevrimSapmaYuzde >= 20}
                />
              </div>
              {cevrimSapmaYuzde != null && cevrimSapmaYuzde >= 20 && (
                <p className="mt-1.5 text-xs text-amber-600">
                  Gerçekleşen çevrim planlının %{cevrimSapmaYuzde} üzerinde
                </p>
              )}
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

            {/* Göstergeler — açık işte CANLI OEE (route); açık iş yoksa placeholder. */}
            <section>
              <SecBaslik>Göstergeler</SecBaslik>
              {co ? (
                <>
                  <div className="grid grid-cols-4 gap-2">
                    <OeeKart e="OEE" oran={co.oeeCanli} esik={OEE_ESIK.OEE} yildiz sebep="kull./perf. eksik" />
                    <OeeKart e="Perf." oran={co.performance} esik={OEE_ESIK.PERF} sebep={perfSebep || 'hesaplanamadı'} />
                    <OeeKart e="Kull." oran={co.availability} esik={OEE_ESIK.KULL} sebep="planlı süre yok (vardiya dışı)" />
                    <OeeKart e="Kalite" oran={null} esik={OEE_ESIK.KALITE} sebep="iş bitince" />
                  </div>
                  <OeeLejant />
                  <p className="mt-1.5 text-xs text-slate-400">
                    canlı — kalite hariç (OEE*, iş bitince tamamlanır)
                    {idealEtiket && <> · performans çevrimi: {idealEtiket}</>}
                  </p>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-2">
                    <MiniKart e="OEE" />
                    <MiniKart e="Perf." />
                    <MiniKart e="Kull." />
                    <MiniKart e="Kalite" />
                  </div>
                  <p className="mt-1 text-xs text-slate-400">açık iş yok — OEE iş bitince motordan hesaplanır</p>
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

// Üretim ilerleme çubuğu altı açıklaması — açık işte canlı PLC / sinyal yok; kapalıda kapanan toplam.
function UretimAciklama({
  acikIsVar,
  canli,
}: {
  acikIsVar: boolean
  canli: { seriVar: boolean; sonSinyal: string | null } | null
}) {
  if (!acikIsVar) {
    return <p className="mt-1 text-xs text-slate-400">bugün kapanan iyi toplamı</p>
  }
  if (canli?.seriVar) {
    return (
      <p className="mt-1 text-xs text-slate-400">
        canlı PLC sayacından (son sinyal {trSaat(canli.sonSinyal)}) · onaylı adet iş bitince girilir
      </p>
    )
  }
  return <p className="mt-1 text-xs text-amber-600">PLC sayacından sinyal gelmedi</p>
}

// Çevrim kutusu — saniye birincil, altında adet/saat (Türkçe ondalık). Uyarıda amber.
function CevrimKutu({ baslik, sn, uyari }: { baslik: string; sn: number | null; uyari?: boolean }) {
  const adetSaat = sn && sn > 0 ? 3600 / sn : null
  return (
    <div className={`rounded-lg border p-3 ${uyari ? 'border-amber-300 bg-amber-50' : ''}`}>
      <div className="text-xs text-slate-400">{baslik}</div>
      <div className={`text-lg font-semibold ${uyari ? 'text-amber-700' : 'text-slate-800'}`}>
        {sn != null ? `${trSayi(sn, 0)} sn` : '—'}
      </div>
      {adetSaat != null && <div className="text-xs text-slate-500">{trSayi(adetSaat, 1)} adet/saat</div>}
    </div>
  )
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
// Canlılık rozeti — ÜRETİM İLERLEME başlığının sağında. Nokta + (yeşilde) nabız + yaş metni.
// Renkler tema palet sınıflarından (emerald/amber/red) — hardcode hex yok.
function AkisRozet({ durum }: { durum: AkisDurum }) {
  const stil = {
    yesil: { nokta: 'bg-emerald-500', metin: 'text-emerald-600' },
    amber: { nokta: 'bg-amber-500', metin: 'text-amber-600' },
    kirmizi: { nokta: 'bg-red-500', metin: 'text-red-600' },
  }[durum.renk]
  return (
    <span className={`flex items-center gap-1.5 text-xs font-medium ${stil.metin}`}>
      <span className={`h-2 w-2 rounded-full ${stil.nokta} ${durum.nabiz ? 'ipro-nabiz' : ''}`} />
      {durum.metin}
    </span>
  )
}

// OEE eşik → görsel seviye. hedef+üstü success, sınır-hedef arası warning, sınır altı danger, null nötr.
// Renkler tema palet sınıflarından (emerald/amber/red); proje geneli semantik renk buradan gelir (hex yok).
function oeeSeviye(pct: number | null, esik: { hedef: number; sinir: number }) {
  if (pct == null) return { kutu: 'border-slate-200', metin: 'text-slate-700', Ikon: null }
  if (pct >= esik.hedef) return { kutu: 'border-emerald-200 bg-emerald-50', metin: 'text-emerald-700', Ikon: CircleCheck }
  if (pct >= esik.sinir) return { kutu: 'border-amber-200 bg-amber-50', metin: 'text-amber-700', Ikon: AlertTriangle }
  return { kutu: 'border-red-200 bg-red-50', metin: 'text-red-700', Ikon: TrendingDown }
}

// Canlı OEE göstergesi — oran (0..1) → %tam sayı, renk-kodlu (eşiğe göre ikon+zemin).
// null → nötr stil, ikon yok, sebep gösterilir. yildiz: OEE kalite hariç hesaplandı işareti (etikette).
function OeeKart({
  e,
  oran,
  esik,
  sebep,
  yildiz,
}: {
  e: string
  oran: number | null
  esik: { hedef: number; sinir: number }
  sebep?: string
  yildiz?: boolean
}) {
  const pct = oran != null ? Math.round(oran * 100) : null
  const s = oeeSeviye(pct, esik)
  const Ikon = s.Ikon
  return (
    <div className={`rounded-lg border py-2 text-center ${s.kutu}`}>
      <div className={`flex items-center justify-center gap-1 ${s.metin}`}>
        {Ikon && <Ikon className="h-4 w-4" />}
        <span className="text-xl font-medium leading-none">{pct != null ? `%${pct}` : '—'}</span>
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">
        {e}
        {yildiz && (
          <span className="text-amber-500" title="kalite hariç">
            *
          </span>
        )}
      </div>
      {pct != null ? (
        <div className="text-[9px] text-slate-400">hedef %{esik.hedef}</div>
      ) : sebep ? (
        <div className="text-[9px] leading-tight text-slate-400">{sebep}</div>
      ) : null}
    </div>
  )
}

// OEE kartları lejantı — ince ayırıcı + tek satır (ikon + 11px muted metin).
function OeeLejant() {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2 text-[11px] text-slate-400">
      <span className="flex items-center gap-1">
        <CircleCheck className="h-3 w-3 text-emerald-600" /> hedefte
      </span>
      <span className="flex items-center gap-1">
        <AlertTriangle className="h-3 w-3 text-amber-600" /> sınırda
      </span>
      <span className="flex items-center gap-1">
        <TrendingDown className="h-3 w-3 text-red-600" /> hedefin altında
      </span>
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

// Dokunmatik uyumlu sayı girişi — [−] [input] [+]. Negatife inmez; input inputMode=numeric.
function StepperNum({
  deger,
  onChange,
  renk,
}: {
  deger: string
  onChange: (v: string) => void
  renk: 'iyi' | 'hurda'
}) {
  const n = Number.parseInt(deger, 10)
  const gecerli = Number.isInteger(n) && n >= 0
  const set = (v: number) => onChange(String(Math.max(0, v)))
  const metinRenk = renk === 'iyi' ? 'text-emerald-700' : 'text-red-600'
  return (
    <div className="flex items-stretch gap-2">
      <button
        type="button"
        onClick={() => set((gecerli ? n : 0) - 1)}
        className="flex min-h-12 w-12 items-center justify-center rounded-lg border text-slate-600 transition-colors hover:bg-slate-50 active:bg-slate-100"
        aria-label="azalt"
      >
        <Minus className="h-5 w-5" />
      </button>
      <Input
        value={deger}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))}
        inputMode="numeric"
        className={`min-h-12 flex-1 text-center text-2xl font-semibold ${metinRenk}`}
      />
      <button
        type="button"
        onClick={() => set((gecerli ? n : 0) + 1)}
        className="flex min-h-12 w-12 items-center justify-center rounded-lg border text-slate-600 transition-colors hover:bg-slate-50 active:bg-slate-100"
        aria-label="arttır"
      >
        <Plus className="h-5 w-5" />
      </button>
    </div>
  )
}

/**
 * Terminalden iş bitir paneli (ipro.admin). İyi + hurda adedi girer (iyi ön dolgu = canlı
 * sayaç üretimi, düzeltilebilir), onay adımında özet gösterir, sonra POST
 * /api/terminal/uzaktan-bitir { productionLogId, qtyComplete, qtyScrap }. Başarıda onBasarili()
 * → detay yenilenir (tezgah 'boşta' görünür, OEE kaydı oluşur). Yanıt apiSuccess → res.ok ile ölçülür.
 */
function UzaktanBitirPanel({
  productionLogId,
  tezgahKod,
  onDolguIyi,
  onIptal,
  onBasarili,
}: {
  productionLogId: string
  tezgahKod: string
  /** Ön dolgu iyi adet — canlı PLC sayacından gelen üretim (düzeltilebilir). */
  onDolguIyi: number
  onIptal: () => void
  onBasarili: () => void
}) {
  const [iyi, setIyi] = useState(String(Math.max(0, Math.round(onDolguIyi))))
  const [hurda, setHurda] = useState('0')
  const [onay, setOnay] = useState(false) // false: giriş adımı · true: onay adımı
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)

  const iyiN = Number.parseInt(iyi, 10)
  const hurdaN = Number.parseInt(hurda, 10)
  const gecerli = Number.isInteger(iyiN) && iyiN >= 0 && Number.isInteger(hurdaN) && hurdaN >= 0

  const gonder = async () => {
    if (!gecerli) return
    setGonderiliyor(true)
    setHata(null)
    try {
      const res = await fetch('/api/terminal/uzaktan-bitir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productionLogId, qtyComplete: iyiN, qtyScrap: hurdaN }),
      })
      if (res.ok) {
        onBasarili()
        return
      }
      const d = await res.json().catch(() => null)
      setHata(d?.error ?? `Bitirilemedi (${res.status})`)
    } catch {
      setHata('Bağlantı hatası')
    } finally {
      setGonderiliyor(false)
    }
  }

  return (
    <div className="rounded-xl border p-4">
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onay ? () => setOnay(false) : onIptal}
          className="flex h-8 w-8 items-center justify-center rounded-lg border text-slate-500 transition-colors hover:bg-slate-50"
          aria-label="Geri"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-slate-800">İşi bitir · {tezgahKod}</span>
      </div>

      {onay ? (
        // Onay adımı — özet + geri dönülebilir onay.
        <div className="space-y-3">
          <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            <span className="font-semibold text-emerald-700">{iyiN} iyi</span>,{' '}
            <span className="font-semibold text-red-600">{hurdaN} hurda</span> ile iş kapatılacak.
            {hurdaN > 0 && iyiN + hurdaN > 0 && (
              <span className="ml-1 text-xs text-slate-500">(sayaç aşımı sunucuda doğrulanır)</span>
            )}
          </div>
          {hata && <p className="text-sm text-red-600">{hata}</p>}
          <div className="flex gap-2">
            <Button
              onClick={gonder}
              disabled={gonderiliyor}
              className="flex-1 gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {gonderiliyor ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Onayla ve bitir
            </Button>
            <Button variant="outline" onClick={() => setOnay(false)} disabled={gonderiliyor}>
              Geri
            </Button>
          </div>
        </div>
      ) : (
        // Giriş adımı — iyi (ön dolgulu) + hurda.
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">İyi adet</span>
              <span className="text-[11px] text-slate-400">canlı sayaçtan ön dolgu</span>
            </div>
            <StepperNum deger={iyi} onChange={setIyi} renk="iyi" />
          </div>
          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Hurda adet</div>
            <StepperNum deger={hurda} onChange={setHurda} renk="hurda" />
          </div>
          <Button
            onClick={() => setOnay(true)}
            disabled={!gecerli}
            className="w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Devam <CheckCircle2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

type PanelPersonel = { id: string; adSoyad: string; sicilNo: string | null }
type PanelIsEmri = {
  id: string
  ifsOrderNo: string
  ifsOperationNo: number
  stokKodu: string
  stokAdi: string
  isMerkezi: string
  teslimTarihi: string
  durum: string
}

/**
 * Uzaktan iş başlat paneli (ipro.admin). Operatör (arama kutulu, TÜM aktif personel)
 * + iş emri (departmanın açık operasyonları) seçtirir, onay adımı gösterir, sonra
 * POST /api/terminal/uzaktan-basla çağırır. Başarıda onBasarili() → detay yenilenir.
 * Yanıtlar apiSuccess (ok sarması yok) → başarı res.ok ile ölçülür.
 */
function UzaktanBaslatPanel({
  tezgahId,
  tezgahKod,
  dept,
  onIptal,
  onBasarili,
}: {
  tezgahId: string
  tezgahKod: string
  dept: string | null
  onIptal: () => void
  onBasarili: () => void
}) {
  const [yukleniyor, setYukleniyor] = useState(true)
  const [personel, setPersonel] = useState<PanelPersonel[]>([])
  const [isEmirleri, setIsEmirleri] = useState<PanelIsEmri[]>([])
  const [optHata, setOptHata] = useState<string | null>(null)
  const [arama, setArama] = useState('')
  const [seciliP, setSeciliP] = useState<PanelPersonel | null>(null)
  const [seciliI, setSeciliI] = useState<PanelIsEmri | null>(null)
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [gonderHata, setGonderHata] = useState<string | null>(null)

  useEffect(() => {
    if (!dept) {
      setYukleniyor(false)
      setOptHata('Departman bilinmiyor — iş emri süzülemez')
      return
    }
    let iptal = false
    setYukleniyor(true)
    fetch(`/api/terminal/uzaktan-basla/secenekler?dept=${encodeURIComponent(dept)}`, { cache: 'no-store' })
      .then(async (r) => ({ ok: r.ok, d: await r.json().catch(() => null) }))
      .then(({ ok, d }) => {
        if (iptal) return
        if (ok && d) {
          setPersonel(d.personel ?? [])
          setIsEmirleri(d.isEmirleri ?? [])
          setOptHata(d.ifsError ?? null)
        } else {
          setOptHata(d?.error ?? 'Seçenekler alınamadı')
        }
      })
      .catch(() => !iptal && setOptHata('Bağlantı hatası'))
      .finally(() => !iptal && setYukleniyor(false))
    return () => {
      iptal = true
    }
  }, [dept])

  const suzulmusPersonel = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase('tr')
    const liste = q
      ? personel.filter(
          (p) =>
            p.adSoyad.toLocaleLowerCase('tr').includes(q) || (p.sicilNo ?? '').toLocaleLowerCase('tr').includes(q),
        )
      : personel
    return liste.slice(0, 50) // uzun listeyi kırp (performans + kaydırma)
  }, [personel, arama])

  const gonder = async () => {
    if (!seciliP || !seciliI) return
    setGonderiliyor(true)
    setGonderHata(null)
    try {
      const res = await fetch('/api/terminal/uzaktan-basla', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tezgahId,
          personnelId: seciliP.id,
          ifsOrderNo: seciliI.ifsOrderNo,
          ifsOperationNo: seciliI.ifsOperationNo,
        }),
      })
      if (res.ok) {
        onBasarili()
        return
      }
      const d = await res.json().catch(() => null)
      const msg =
        res.status === 409
          ? (d?.error ?? 'Bu tezgahta zaten açık iş var')
          : (d?.error ?? `Başlatılamadı (${res.status})`)
      setGonderHata(msg)
    } catch {
      setGonderHata('Bağlantı hatası')
    } finally {
      setGonderiliyor(false)
    }
  }

  return (
    <div className="rounded-xl border p-4">
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onIptal}
          className="flex h-8 w-8 items-center justify-center rounded-lg border text-slate-500 transition-colors hover:bg-slate-50"
          aria-label="Vazgeç"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-slate-800">Uzaktan iş başlat · {tezgahKod}</span>
      </div>

      {yukleniyor ? (
        <p className="flex items-center gap-2 py-6 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Seçenekler yükleniyor…
        </p>
      ) : (
        <div className="space-y-4">
          {/* Operatör seçimi — arama kutulu combobox (tüm aktif personel) */}
          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Operatör</div>
            {seciliP ? (
              <div className="flex items-center justify-between rounded-lg border bg-slate-50 px-3 py-2">
                <span className="text-sm font-medium text-slate-800">
                  {seciliP.adSoyad}
                  {seciliP.sicilNo ? <span className="ml-1 text-xs text-slate-400">· {seciliP.sicilNo}</span> : null}
                </span>
                <button type="button" onClick={() => setSeciliP(null)} className="text-xs text-slate-500 hover:underline">
                  değiştir
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    value={arama}
                    onChange={(e) => setArama(e.target.value)}
                    placeholder="Ad veya sicil ile ara…"
                    className="pl-8"
                  />
                </div>
                <div className="mt-1.5 max-h-40 overflow-y-auto rounded-lg border">
                  {suzulmusPersonel.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-slate-400">Personel bulunamadı.</p>
                  ) : (
                    suzulmusPersonel.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSeciliP(p)
                          setArama('')
                        }}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                      >
                        <span className="text-slate-800">{p.adSoyad}</span>
                        {p.sicilNo ? <span className="text-xs text-slate-400">{p.sicilNo}</span> : null}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {/* İş emri seçimi — departmanın açık operasyonları */}
          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">İş emri</div>
            {optHata && <p className="mb-1.5 text-xs text-amber-600">{optHata}</p>}
            {seciliI ? (
              <div className="flex items-center justify-between rounded-lg border bg-slate-50 px-3 py-2">
                <span className="text-sm text-slate-800">
                  <span className="font-medium">{seciliI.ifsOrderNo}</span>
                  <span className="text-slate-400"> · Op {seciliI.ifsOperationNo}</span>
                  <span className="ml-1 text-xs text-slate-500">{seciliI.stokAdi || seciliI.stokKodu}</span>
                </span>
                <button type="button" onClick={() => setSeciliI(null)} className="text-xs text-slate-500 hover:underline">
                  değiştir
                </button>
              </div>
            ) : isEmirleri.length === 0 ? (
              <p className="rounded-lg border px-3 py-2 text-sm text-slate-400">
                Bu departmanda açık iş emri yok.
              </p>
            ) : (
              <div className="max-h-44 overflow-y-auto rounded-lg border">
                {isEmirleri.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setSeciliI(o)}
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-slate-50"
                  >
                    <span className="text-sm text-slate-800">
                      <span className="font-medium">{o.ifsOrderNo}</span>
                      <span className="text-slate-400"> · Op {o.ifsOperationNo}</span>
                      <span className="ml-1 text-xs text-slate-400">{o.isMerkezi}</span>
                    </span>
                    <span className="truncate text-xs text-slate-500">{o.stokAdi || o.stokKodu || '—'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Onay + başlat */}
          {seciliP && seciliI && (
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-sm text-slate-700">
                <span className="font-semibold">{seciliP.adSoyad}</span> operatörü adına,{' '}
                <span className="font-semibold">{tezgahKod}</span> tezgahında,{' '}
                <span className="font-semibold">{seciliI.ifsOrderNo} · Op {seciliI.ifsOperationNo}</span> iş emri
                başlatılacak.
              </p>
              {gonderHata && <p className="mt-2 text-sm text-red-600">{gonderHata}</p>}
              <div className="mt-3 flex gap-2">
                <Button
                  onClick={gonder}
                  disabled={gonderiliyor}
                  className="flex-1 gap-2 text-white"
                  style={{ background: TERMINAL_ACCENT }}
                >
                  {gonderiliyor ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Onayla ve başlat
                </Button>
                <Button variant="outline" onClick={onIptal} disabled={gonderiliyor}>
                  Vazgeç
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
