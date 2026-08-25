'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Building2,
  ClipboardList,
  Cpu,
  Disc,
  Droplet,
  Flame,
  Gauge,
  Hammer,
  Home,
  MoveVertical,
  Package,
  Truck,
  Wrench,
  Zap,
  AlertCircle,
  type LucideIcon,
} from 'lucide-react'
import { OperatorBadge, TERMINAL_ACCENT } from '../_shared'

interface Vardiya {
  kod: string
  ad: string
  baslangicSaat: string // "07:00"
  bitisSaat: string // "17:00"
  ertesiGuneTasar: boolean // gece: 21:00 → ertesi 07:00
}

interface Departman {
  /** DepartmentNo — bölüm kodu (WLZ, …). */
  kod: string
  /** Description — bölüm adı (LAZER KESİM, …). */
  ad: string
  /** Açık iş emri sayısı (departmana bağlı). */
  isEmri: number
  /** Bu bölüme düşen tezgah sayısı. */
  tezgah: number
}

interface Props {
  operatorName: string
  departmanlar: Departman[]
  /** Son 180 sn'de delta üreten, departmana eşlenmiş çalışan tezgah sayısı (M). */
  calisanTezgah: number
  vardiyalar: Vardiya[]
  /** URL ?dept — seçili bölüm kodu; yoksa seçim ekranı gösterilir. */
  seciliDept: string | null
  seciliDeptAd: string
  ifsError: string | null
}

// Departman koduna göre ikon (tek sabit map). Bilinmeyen kod → Building2.
const DEPT_ICON: Record<string, LucideIcon> = {
  WPH: Hammer,
  WLZ: Zap,
  WKY: Flame,
  WCN: Cpu, // CNC talaşlı imalat — bilgisayarlı kontrol
  WMM: Wrench,
  WPE: Droplet,
  WPK: Package,
  WDT: Disc, // daire testere — dönen kesme diski
  WAS: MoveVertical,
  FSN: Truck,
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Canlı saatten şu ana denk gelen vardiyayı bulur (yoksa null). */
function aktifVardiya(vardiyalar: Vardiya[], now: Date): Vardiya | null {
  const hhmm = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`
  for (const v of vardiyalar) {
    const iceride = v.ertesiGuneTasar
      ? hhmm >= v.baslangicSaat || hhmm < v.bitisSaat // gece vardiyası gün sınırını aşar
      : hhmm >= v.baslangicSaat && hhmm < v.bitisSaat
    if (iceride) return v
  }
  return null
}

function tarihSaat(now: Date): string {
  return `${pad2(now.getDate())}.${pad2(now.getMonth() + 1)}.${now.getFullYear()} · ${pad2(now.getHours())}:${pad2(now.getMinutes())}`
}

export function TerminalMenuClient({
  operatorName,
  departmanlar,
  calisanTezgah,
  vardiyalar,
  seciliDept,
  seciliDeptAd,
  ifsError,
}: Props) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-6 p-6">
      <UstBar operatorName={operatorName} vardiyalar={vardiyalar} />

      {seciliDept ? (
        <BolumSecildi seciliDept={seciliDept} seciliDeptAd={seciliDeptAd} />
      ) : (
        <BolumSecim departmanlar={departmanlar} calisanTezgah={calisanTezgah} ifsError={ifsError} />
      )}
    </div>
  )
}

// ── Üst bar — logo (sol) + vardiya/saat + Hub + operatör (sağ) ─────────────────
function UstBar({
  operatorName,
  vardiyalar,
}: {
  operatorName: string
  vardiyalar: Vardiya[]
}) {
  // Saat yalnız client'ta (SSR ile uyuşmazlık olmasın diye ilk render'da boş).
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const vardiya = now ? aktifVardiya(vardiyalar, now) : null

  return (
    <div className="flex items-center justify-between gap-4">
      {/* Sol: logo | ince ayırıcı | "Üretim Terminali" — dikey ortalı, aralar 12px.
          no-img-element eslint kuralı kapalı; logo yatay, genişlik oran korunarak auto. */}
      <div className="flex items-center gap-3">
        <img
          src="/ipro-logo.png"
          alt="IPRO"
          height={32}
          className="h-8 w-auto object-contain"
        />
        <span className="h-6 w-px bg-border" aria-hidden="true" />
        <span className="text-sm font-normal text-muted-foreground">Üretim Terminali</span>
      </div>

      {/* Sağ: vardiya + tarih/saat + Hub + operatör */}
      <div className="flex items-center gap-3">
        {now && (
          <div className="flex flex-col items-end leading-tight">
            <span className="text-sm font-semibold" style={{ color: TERMINAL_ACCENT }}>
              {vardiya ? vardiya.ad : 'Vardiya dışı'}
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">{tarihSaat(now)}</span>
          </div>
        )}
        <Link
          href="/dashboard"
          aria-label="Hub'a dön"
          title="Hub'a Dön"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors hover:bg-muted active:bg-muted/70"
        >
          <Home className="h-5 w-5" />
        </Link>
        <OperatorBadge name={operatorName} />
      </div>
    </div>
  )
}

// ── Yoğunluk kademesi — açık iş emri sayısına göre kademe (eşikler TEK yerde) ──
type YogunlukKademe = 'yogun' | 'orta' | 'az' | 'yok'

function yogunlukKademesi(isEmri: number): YogunlukKademe {
  if (isEmri >= 10) return 'yogun'
  if (isEmri >= 4) return 'orta'
  if (isEmri >= 1) return 'az'
  return 'yok'
}

// Dolu segment rengi — yoğunluk 3 kademe. Tema `primary` token'ı + opaklık (hardcode hex yok).
const SEGMENT_DOLU: Record<'yogun' | 'orta' | 'az', string> = {
  yogun: 'bg-primary',
  orta: 'bg-primary/60',
  az: 'bg-primary/35',
}

// ── Segment dağılımı — her bar TOPLAM açık işi gösterir; dolu = bölümün işi ────
// GÜVENLİK: toplam > 60 ise segmentler görünmez incelir → 60'a oransal ölçekle
// (dolu = round(bolumIs/toplam*60), en az 1). Kural TEK yerde.
const MAX_SEGMENT = 60
function segmentDagilimi(toplamIs: number): {
  toplamSegment: number
  dolu: (bolumIs: number) => number
} {
  if (toplamIs <= 0) return { toplamSegment: 0, dolu: () => 0 }
  if (toplamIs <= MAX_SEGMENT) return { toplamSegment: toplamIs, dolu: (b) => b }
  return {
    toplamSegment: MAX_SEGMENT,
    dolu: (b) => (b > 0 ? Math.max(1, Math.round((b / toplamIs) * MAX_SEGMENT)) : 0),
  }
}

// ── Dilimli halka (inline SVG, kütüphane yok) ─────────────────────────────────
// Zemin: dilimli (dasharray 2.2/3.5). Dolu: pathLength=100 ile yüzde uzunlukta arc,
// aynı dilim deseni MASK ile uygulanır. Her halkanın mask id'si benzersiz (id).
// Renkler Tailwind stroke token'ıyla (stroke-primary/green-600/amber-500/border).
function Halka({ yuzde, renk, id }: { yuzde: number; renk: string; id: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(yuzde)))
  const maskId = `halka-mask-${id}`
  return (
    <svg viewBox="0 0 66 66" className="h-[66px] w-[66px] shrink-0" aria-hidden="true">
      <mask id={maskId}>
        <circle cx="33" cy="33" r="26" fill="none" stroke="white" strokeWidth="9" strokeDasharray="2.2 3.5" />
      </mask>
      {/* zemin dilimli halka */}
      <circle cx="33" cy="33" r="26" fill="none" strokeWidth="9" strokeDasharray="2.2 3.5" className="stroke-border" />
      {/* dolu kısım — dilim maskesiyle */}
      <circle
        cx="33"
        cy="33"
        r="26"
        fill="none"
        strokeWidth="9"
        pathLength={100}
        strokeDasharray={`${pct} ${100 - pct}`}
        transform="rotate(-90 33 33)"
        mask={`url(#${maskId})`}
        className={renk}
      />
    </svg>
  )
}

// ── Üst özet — 3 halkalı kart ─────────────────────────────────────────────────
function OzetHalkaKart({
  ikon: Ikon,
  etiket,
  rakam,
  alt,
  yuzde,
  renk,
  id,
}: {
  ikon: LucideIcon
  etiket: string
  rakam: ReactNode
  alt: string
  yuzde: number
  renk: string
  id: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Ikon className="h-4 w-4 shrink-0" />
          <span className="truncate">{etiket}</span>
        </div>
        <div className="text-[26px] font-medium leading-none tabular-nums">{rakam}</div>
        <div className="text-xs text-muted-foreground">{alt}</div>
      </div>
      <Halka yuzde={yuzde} renk={renk} id={id} />
    </div>
  )
}

function UcHalkaOzet({
  departmanlar,
  calisanTezgah,
}: {
  departmanlar: Departman[]
  calisanTezgah: number
}) {
  const toplamIs = departmanlar.reduce((s, d) => s + d.isEmri, 0)
  const isliBolum = departmanlar.filter((d) => d.isEmri > 0).length
  const bolumSayisi = departmanlar.length
  const bosBolum = bolumSayisi - isliBolum
  const toplamTezgah = departmanlar.reduce((s, d) => s + d.tezgah, 0)
  const dolulukPct = toplamTezgah > 0 ? Math.round((calisanTezgah / toplamTezgah) * 100) : 0
  const bolumPct = bolumSayisi > 0 ? Math.round((isliBolum / bolumSayisi) * 100) : 0
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <OzetHalkaKart
        id="doluluk"
        ikon={Gauge}
        etiket="Tezgah doluluk"
        rakam={`%${dolulukPct}`}
        alt={`${calisanTezgah} / ${toplamTezgah} çalışıyor`}
        yuzde={dolulukPct}
        renk="stroke-primary"
      />
      <OzetHalkaKart
        id="bolum"
        ikon={Building2}
        etiket="İşi olan bölüm"
        rakam={
          <>
            {isliBolum}
            <span className="text-base font-normal text-muted-foreground"> / {bolumSayisi}</span>
          </>
        }
        alt={`${bosBolum} bölüm boşta`}
        yuzde={bolumPct}
        renk="stroke-green-600"
      />
      <OzetHalkaKart
        id="isemri"
        ikon={ClipboardList}
        etiket="Açık iş emri"
        rakam={toplamIs}
        alt={`${isliBolum} bölüme dağılmış`}
        yuzde={100}
        renk="stroke-amber-500"
      />
    </div>
  )
}

// ── Bölüm seçim ekranı (?dept yokken) ─────────────────────────────────────────
function BolumSecim({
  departmanlar,
  calisanTezgah,
  ifsError,
}: {
  departmanlar: Departman[]
  calisanTezgah: number
  ifsError: string | null
}) {
  if (ifsError) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-6 text-red-700">
        <div className="flex items-center gap-2 font-medium">
          <AlertCircle className="h-5 w-5" />
          Bölümler IFS&apos;ten alınamadı
        </div>
        <p className="max-w-full break-all text-sm text-red-700/90">{ifsError}</p>
      </div>
    )
  }
  if (departmanlar.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        Bölüm bulunamadı.
      </div>
    )
  }
  const toplamIs = departmanlar.reduce((s, d) => s + d.isEmri, 0)
  const { toplamSegment, dolu } = segmentDagilimi(toplamIs)
  return (
    <>
      <UcHalkaOzet departmanlar={departmanlar} calisanTezgah={calisanTezgah} />

      <span className="text-[17px] font-medium">Bölümler</span>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
        {departmanlar.map((d) => (
          <BolumKart
            key={d.kod}
            d={d}
            toplamSegment={toplamSegment}
            doluSegment={dolu(d.isEmri)}
            pct={toplamIs > 0 ? Math.round((d.isEmri / toplamIs) * 100) : 0}
          />
        ))}
      </div>
    </>
  )
}

function BolumKart({
  d,
  toplamSegment,
  doluSegment,
  pct,
}: {
  d: Departman
  toplamSegment: number
  doluSegment: number
  pct: number
}) {
  const Icon = DEPT_ICON[d.kod] ?? Building2
  const kademe = yogunlukKademesi(d.isEmri)
  const aktif = d.isEmri > 0
  const doluRenk = aktif ? SEGMENT_DOLU[kademe as 'yogun' | 'orta' | 'az'] : 'bg-border'

  return (
    <Link
      href={`/terminal/uretim?dept=${encodeURIComponent(d.kod)}`}
      className="group flex min-h-[104px] flex-col justify-between gap-3 rounded-2xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm"
    >
      {/* Üst satır: ikon kutusu + ad/kod + sağda sayı/%N (ya da "açık iş yok") */}
      <div className="flex items-center gap-3">
        <span
          className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg ${aktif ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className={`truncate text-sm font-medium ${aktif ? '' : 'text-foreground/70'}`}>
            {d.ad || d.kod}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {d.kod} · {d.tezgah} tezgah
          </div>
        </div>
        {aktif ? (
          <div className="shrink-0 text-right">
            <div className="text-[22px] font-medium leading-none tabular-nums text-primary">
              {d.isEmri}
            </div>
            <div className="text-[11px] text-muted-foreground">%{pct}</div>
          </div>
        ) : (
          <span className="shrink-0 text-[11px] text-muted-foreground">açık iş yok</span>
        )}
      </div>

      {/* Segment şeridi — toplam açık işi gösterir, dolu = bölümün işi */}
      <div className="flex h-[22px] items-stretch gap-0.5">
        {Array.from({ length: toplamSegment }).map((_, i) => (
          <span key={i} className={`flex-1 rounded-[1px] ${i < doluSegment ? doluRenk : 'bg-border'}`} />
        ))}
      </div>
    </Link>
  )
}

// ── Bölüm seçildi — yer tutucu (alt akış: tezgah/iş emri ayrı iş) ─────────────
function BolumSecildi({
  seciliDept,
  seciliDeptAd,
}: {
  seciliDept: string
  seciliDeptAd: string
}) {
  const Icon = DEPT_ICON[seciliDept] ?? Building2
  return (
    <>
      <div className="flex items-center gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
          style={{ background: TERMINAL_ACCENT }}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="flex flex-col leading-tight">
          <span className="text-base font-semibold">
            {seciliDeptAd || seciliDept}
          </span>
          <span className="text-xs text-muted-foreground">{seciliDept}</span>
        </div>
      </div>

      <div className="flex flex-col items-start gap-4 rounded-2xl border border-dashed p-8">
        <p className="text-sm text-muted-foreground">
          Bu bölümün tezgah ve iş emri listesi bir sonraki adımda eklenecek.
        </p>
        <Link
          href="/terminal/uretim"
          className="inline-flex min-h-12 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors hover:bg-muted active:bg-muted/70"
        >
          <ArrowLeft className="h-5 w-5" />
          Bölüm değiştir
        </Link>
      </div>
    </>
  )
}
