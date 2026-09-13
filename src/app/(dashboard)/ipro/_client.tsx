'use client'

import Link from 'next/link'
import {
  Activity,
  MonitorCog,
  Map,
  ClipboardList,
  Factory,
  Users,
  CalendarDays,
  MonitorSmartphone,
  Link2,
  Radio,
  type LucideIcon,
} from 'lucide-react'

type Kart = { name: string; href: string; icon: LucideIcon; slug: string; desc: string; canli?: boolean }
type Pill = { name: string; href: string; icon: LucideIcon }

// Ana modül kartları (görselli). slug → public/ipro-kapak/<slug>.png (henüz yok → placeholder).
// İkonlar Sidebar iproMenuItems ile aynı.
const ANA_KARTLAR: Kart[] = [
  { name: 'İzleme Ekranı', href: '/ipro/izleme', icon: Activity, slug: 'izleme', canli: true, desc: 'Kim çalışıyor, hangi iş; OEE (Kullanılabilirlik/Performans/Kalite) tek ekranda' },
  { name: 'Üretim Terminali', href: '/terminal/uretim', icon: MonitorCog, slug: 'terminal', desc: 'Bölüm, tezgah ve iş emri takibi' },
  { name: 'Fabrika Haritası', href: '/ipro/harita', icon: Map, slug: 'harita', canli: true, desc: 'Tezgahların fabrika yerleşimi üzerinde canlı durumu' },
  { name: 'İş Emirleri', href: '/ipro/is-emirleri', icon: ClipboardList, slug: 'is-emirleri', desc: 'IFS açık iş emirleri ve ILERIHub iş geçmişi' },
  { name: 'Tezgahlar', href: '/ipro/tezgahlar', icon: Factory, slug: 'tezgahlar', desc: 'Tezgah tanımları, PLC pin ve sayaç eşlemeleri' },
]

// Yönetim satırı (ince pill'ler).
const YONETIM: Pill[] = [
  { name: 'Operatör Eşlemeleri', href: '/ipro/operator-eslemeleri', icon: Users },
  { name: 'Hurda / Duruş Sebepleri', href: '/ipro/sebepler', icon: ClipboardList },
  { name: 'Vardiya & Takvim', href: '/ipro/takvim', icon: CalendarDays },
  { name: 'Kiosk Cihazları', href: '/ipro/kiosklar', icon: MonitorSmartphone },
  { name: 'IFS Eşlemeleri', href: '/ipro/ifs-eslemeleri', icon: Link2 },
  { name: 'Sinyal Takibi', href: '/ipro/sinyal', icon: Radio },
]

export function IproKapakClient({ izinliHedefler }: { izinliHedefler: string[] }) {
  const izin = new Set(izinliHedefler)
  const anaKartlar = ANA_KARTLAR.filter((k) => izin.has(k.href))
  const yonetim = YONETIM.filter((p) => izin.has(p.href))

  return (
    <div className="container mx-auto max-w-[1400px] px-6 py-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Factory className="h-6 w-6" />
          IPRO Üretim Takip
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Üretim izleme, OEE, iş emirleri ve tanım yönetimi.
        </p>
      </div>

      {/* Ana modül kartları */}
      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(250px,1fr))]">
        {anaKartlar.map((k) => (
          <ModulKart key={k.href} kart={k} />
        ))}
      </div>

      {/* Yönetim satırı */}
      {yonetim.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Yönetim</h2>
          <div className="flex flex-wrap gap-2">
            {yonetim.map((p) => {
              const Icon = p.icon
              return (
                <Link
                  key={p.href}
                  href={p.href}
                  className="inline-flex items-center gap-2 rounded-full border bg-card px-3.5 py-2 text-sm font-medium transition-colors hover:bg-muted active:bg-muted/70"
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {p.name}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function ModulKart({ kart }: { kart: Kart }) {
  const Icon = kart.icon
  return (
    <Link
      href={kart.href}
      className="group flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm"
    >
      {/* Görsel alanı — public/ipro-kapak/<slug>.png (800x450, 16:9). */}
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        {/* next/image DEĞİL (logo deseni — statik public asset). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/ipro-kapak/${kart.slug}.png`}
          alt={kart.name}
          className="h-full w-full object-cover"
        />
        {kart.canli && (
          <span className="absolute right-2 top-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white bg-green-600">
            CANLI
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-[15px] font-semibold text-foreground">{kart.name}</span>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{kart.desc}</p>
      </div>
    </Link>
  )
}
