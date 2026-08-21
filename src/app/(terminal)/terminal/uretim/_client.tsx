'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Building2,
  Cpu,
  Disc,
  Droplet,
  Flame,
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

// IFS bölüm adı ALL-CAPS gelir ("CNC TALAŞLI İMALAT"). Kelime bazlı cümle-başı formatı:
//  - ≤4 harf ve tamamı büyük harf olan kelimeler (CNC, WPH, FSN) OLDUĞU GİBİ kalır,
//  - diğerleri tr-TR küçük harfe iner (İMALAT→imalat, İ/ı doğru); yalnız ilk kelime
//    baş harfi büyük. Örn: "CNC talaşlı imalat", "Daire testere/boru büküm".
function baslikFormat(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .map((w, i) => {
      const buyuk = w.toLocaleUpperCase('tr-TR')
      const kucuk = w.toLocaleLowerCase('tr-TR')
      // Kısaltma: kısa + tamamı büyük harf (harf içeren) → dokunma.
      if (w.length <= 4 && w === buyuk && w !== kucuk) return w
      // İlk kelime cümle-başı büyük; diğerleri küçük.
      return i === 0 ? kucuk.charAt(0).toLocaleUpperCase('tr-TR') + kucuk.slice(1) : kucuk
    })
    .join(' ')
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
        <BolumSecim departmanlar={departmanlar} ifsError={ifsError} />
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

// ── Yoğunluk kademesi — açık iş emri sayısına göre 4 kademe (eşikler TEK yerde) ──
type YogunlukKademe = 'yogun' | 'orta' | 'az' | 'yok'

function yogunlukKademesi(isEmri: number): YogunlukKademe {
  if (isEmri >= 10) return 'yogun'
  if (isEmri >= 4) return 'orta'
  if (isEmri >= 1) return 'az'
  return 'yok'
}

// Kademe → stiller. Renkler tema `primary` token'ından (+ opaklık); hardcode hex yok.
const KADEME_STIL: Record<
  YogunlukKademe,
  { kart: string; baslik: string; ikon: string; alt: string; sayi: string; lejant: string }
> = {
  yogun: {
    kart: 'bg-primary border-transparent',
    baslik: 'text-primary-foreground',
    ikon: 'text-primary-foreground/85',
    alt: 'text-primary-foreground/75',
    sayi: 'text-primary-foreground',
    lejant: 'bg-primary',
  },
  orta: {
    kart: 'bg-primary/20 border-transparent',
    baslik: 'text-primary',
    ikon: 'text-primary',
    alt: 'text-muted-foreground',
    sayi: 'text-primary',
    lejant: 'bg-primary/40',
  },
  az: {
    kart: 'bg-primary/10 border-transparent',
    baslik: 'text-primary',
    ikon: 'text-primary/80',
    alt: 'text-muted-foreground',
    sayi: 'text-primary',
    lejant: 'bg-primary/20',
  },
  yok: {
    kart: 'bg-card border-border',
    baslik: 'text-foreground/70',
    ikon: 'text-muted-foreground',
    alt: 'text-muted-foreground',
    sayi: '',
    lejant: 'bg-card border border-border',
  },
}

// ── Üst özet şeridi — 4 metrik (mevcut departman verisinden türetilir) ─────────
function OzetSerit({ departmanlar }: { departmanlar: Departman[] }) {
  const toplamIs = departmanlar.reduce((s, d) => s + d.isEmri, 0)
  const isliBolum = departmanlar.filter((d) => d.isEmri > 0).length
  const toplamTezgah = departmanlar.reduce((s, d) => s + d.tezgah, 0)
  const bolumSayisi = departmanlar.length
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <OzetKart etiket="Açık iş emri" deger={toplamIs} />
      <OzetKart etiket="İşi olan bölüm" deger={isliBolum} ek={`/ ${bolumSayisi}`} />
      <OzetKart etiket="Toplam tezgah" deger={toplamTezgah} />
      <OzetKart etiket="Bölüm" deger={bolumSayisi} />
    </div>
  )
}

function OzetKart({ etiket, deger, ek }: { etiket: string; deger: number; ek?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
      <span className="text-xs text-muted-foreground">{etiket}</span>
      <span className="text-[28px] font-medium leading-none tabular-nums">
        {deger}
        {ek ? <span className="ml-1 text-base font-normal text-muted-foreground">{ek}</span> : null}
      </span>
    </div>
  )
}

// ── Lejant — yoğunluk kademesi renk anahtarı ──────────────────────────────────
const LEJANT: { k: YogunlukKademe; label: string }[] = [
  { k: 'yogun', label: 'yoğun' },
  { k: 'orta', label: 'orta' },
  { k: 'az', label: 'az' },
  { k: 'yok', label: 'iş yok' },
]

function Lejant() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {LEJANT.map((it) => (
        <span key={it.k} className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-sm ${KADEME_STIL[it.k].lejant}`} />
          <span className="text-xs text-muted-foreground">{it.label}</span>
        </span>
      ))}
    </div>
  )
}

// ── Bölüm seçim ekranı (?dept yokken) ─────────────────────────────────────────
function BolumSecim({
  departmanlar,
  ifsError,
}: {
  departmanlar: Departman[]
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
  return (
    <>
      <OzetSerit departmanlar={departmanlar} />

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span className="text-[17px] font-medium">Bölümler</span>
        <Lejant />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {departmanlar.map((d) => (
          <BolumKart key={d.kod} d={d} />
        ))}
      </div>
    </>
  )
}

function BolumKart({ d }: { d: Departman }) {
  const Icon = DEPT_ICON[d.kod] ?? Building2
  const s = KADEME_STIL[yogunlukKademesi(d.isEmri)]

  return (
    <Link
      href={`/terminal/uretim?dept=${encodeURIComponent(d.kod)}`}
      className={`group relative flex min-h-[118px] flex-col gap-3 rounded-2xl border p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm ${s.kart}`}
    >
      {/* Açık iş sayısı — sağ üst, düz büyük rakam (rozet değil). 0 ise gösterilmez. */}
      {d.isEmri > 0 && (
        <span
          className={`absolute right-4 top-3.5 text-[26px] font-medium leading-none tabular-nums ${s.sayi}`}
          title={`${d.isEmri} açık iş emri`}
        >
          {d.isEmri}
        </span>
      )}

      {/* İkon — kutu yok, doğrudan 30px; kart zeminiyle kontrast renk. */}
      <Icon className={`h-[30px] w-[30px] transition-transform group-active:scale-95 ${s.ikon}`} />

      <div className="flex flex-col gap-1">
        <div className={`line-clamp-2 text-[15px] font-medium leading-tight ${s.baslik}`}>
          {d.ad ? baslikFormat(d.ad) : d.kod}
        </div>
        <div className={`text-xs ${s.alt}`}>
          {d.kod} · {d.tezgah} tezgah
        </div>
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
            {seciliDeptAd ? baslikFormat(seciliDeptAd) : seciliDept}
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
