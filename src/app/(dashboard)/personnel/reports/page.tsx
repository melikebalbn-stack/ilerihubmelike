"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Users, Briefcase, Wrench, HardHat, BarChart3, PieChart as PieChartIcon, ArrowLeft, Download, Printer } from "lucide-react"
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer
} from "recharts"
import { SplitBadge, type SplitBadgeTone } from "@/components/ui/split-badge"
import { BarList } from "@/components/ui/bar-list"
import { ProgressRingCard } from "@/components/ui/progress-ring-card"

interface BolumSatir { bolum: string; sayi: number; oran: number }

interface ReportData {
  ozet: {
    toplamCalisan: number
    beyazYaka: number
    maviYaka: number
    griYaka: number
    direkt: number
    endirekt: number
  }
  cinsiyetDagilimi: { erkek: number; kadin: number }
  yakaCinsiyetTablosu: {
    beyaz: { genel: number; erkek: number; kadin: number; engelli: number }
    mavi: { genel: number; erkek: number; kadin: number; engelli: number }
    gri: { genel: number; erkek: number; kadin: number; engelli: number }
    toplam: { genel: number; erkek: number; kadin: number; engelli: number }
  }
  beyazYakaBolumler: BolumSatir[]
  maviYakaBolumler: BolumSatir[]
  griYakaBolumler: BolumSatir[]
  direktBolumler: BolumSatir[]
  endirektBolumler: BolumSatir[]
  istatistik: {
    kadinErkekOrani: number
    beyazYakaOrani: number
    muhendislerOrtCalismaSuresi: number
    muhendisSayisi: number
    muhendisOrani: number
    argeCalisanOrani: number
    yulesekLisansMezunOrani: number
  }
  asansorMekanik: { asansor: number; mekanik: number; yok: number }
  ozelGrup: {
    asansorMavi: number
    asansorBeyaz: number
    stajyerAktif: number
    danismanAktif: number
  }
}

interface YakaRenk {
  ad: string
  /** Recharts pasta dilimi için ham renk — Tailwind sinifiyla ayni tonu gosterir. */
  hex: string
  /** Kart ust cizgisi (before:) */
  cizgi: string
  ikonKutu: string
  ikon: string
  rakam: string
  /** Tablo satirindaki nokta ve bar listesi rengi */
  nokta: string
  bar: string
  metin: string
  satirHover: string
  tone: SplitBadgeTone
  halka: string
}

/**
 * Yaka renkleri TEK kaynaktan gelir: Beyaz -> teal, Mavi -> blue, Gri -> slate.
 * Kart cizgisi, ikon, rakam, tablo noktasi, bar listesi ve SplitBadge tonu
 * hepsi bu sabitten okunur; ekranda baska yerde yaka rengi yazilmaz.
 */
const YAKA_RENK: Record<"beyaz" | "mavi" | "gri", YakaRenk> = {
  beyaz: {
    ad: "Beyaz Yaka",
    hex: "#0d9488",
    cizgi: "before:bg-teal-500",
    ikonKutu: "bg-teal-50",
    ikon: "text-teal-600",
    rakam: "text-teal-700",
    nokta: "bg-teal-600",
    bar: "bg-teal-600",
    metin: "text-teal-700",
    satirHover: "hover:bg-teal-50/40",
    tone: "teal",
    halka: "text-teal-600",
  },
  mavi: {
    ad: "Mavi Yaka",
    hex: "#2563eb",
    cizgi: "before:bg-blue-600",
    ikonKutu: "bg-blue-50",
    ikon: "text-blue-600",
    rakam: "text-blue-700",
    nokta: "bg-blue-600",
    bar: "bg-blue-600",
    metin: "text-blue-700",
    satirHover: "hover:bg-blue-50/40",
    tone: "blue",
    halka: "text-blue-600",
  },
  gri: {
    ad: "Gri Yaka",
    hex: "#64748b",
    cizgi: "before:bg-slate-500",
    ikonKutu: "bg-slate-100",
    ikon: "text-slate-500",
    rakam: "text-slate-600",
    nokta: "bg-slate-500",
    bar: "bg-slate-500",
    metin: "text-slate-600",
    satirHover: "hover:bg-slate-50/60",
    tone: "slate",
    halka: "text-slate-500",
  },
}

const COLORS = {
  beyaz: YAKA_RENK.beyaz.hex,
  mavi: YAKA_RENK.mavi.hex,
  gri: YAKA_RENK.gri.hex,
  erkek: "#14b8a6",
  kadin: "#f43f5e",
  direkt: "#f59e0b",
  endirekt: "#64748b",
  asansor: "#0ea5e9",
  mekanik: "#f97316",
  yok: "#94a3b8",
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <p className="text-[11px] font-medium text-slate-500 mb-1">{label}</p>
      <p className="text-2xl font-semibold tabular-nums text-slate-800">{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

const RADIAN = Math.PI / 180
function renderCustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) {
  const radius = innerRadius + (outerRadius - innerRadius) * 1.4
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  if (percent < 0.03) return null
  return (
    <text x={x} y={y} fill="#334155" textAnchor={x > cx ? "start" : "end"} dominantBaseline="central" fontSize={11}>
      {name} ({(percent * 100).toFixed(1)}%)
    </text>
  )
}

export default function PersonnelReportsPage() {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/personnel/reports")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Yazdirma: org semasindaki desenin aynisi — govdeye bir sinif takilir, named
  // @page (personel-yatay) ve "yalniz yazdirma alani" kurallari globals.css'te.
  useEffect(() => {
    const bitti = () => document.body.classList.remove("personel-yazdir")
    window.addEventListener("afterprint", bitti)
    return () => {
      window.removeEventListener("afterprint", bitti)
      document.body.classList.remove("personel-yazdir")
    }
  }, [])

  const yazdir = () => {
    document.body.classList.add("personel-yazdir")
    // Sinifin uygulanmasi bir cizim karesi alir; window.print() senkron oldugu icin bekletiyoruz.
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()))
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
    </div>
  )

  if (!data) return (
    <div className="p-6 text-sm text-slate-500">Veri yüklenemedi.</div>
  )

  const { ozet, cinsiyetDagilimi, yakaCinsiyetTablosu, beyazYakaBolumler, maviYakaBolumler, griYakaBolumler, direktBolumler, endirektBolumler, istatistik, asansorMekanik, ozelGrup } = data

  const yakaPieData = [
    { name: "Beyaz Yaka", value: ozet.beyazYaka },
    { name: "Mavi Yaka", value: ozet.maviYaka },
    { name: "Gri Yaka", value: ozet.griYaka },
  ]
  const yakaPieColors = [COLORS.beyaz, COLORS.mavi, COLORS.gri]

  const cinsiyetPieData = [
    { name: "Erkek", value: cinsiyetDagilimi.erkek },
    { name: "Kadın", value: cinsiyetDagilimi.kadin },
  ]
  const cinsiyetPieColors = [COLORS.erkek, COLORS.kadin]

  const direktEndirektPieData = [
    { name: "Direkt", value: ozet.direkt },
    { name: "Endirekt", value: ozet.endirekt },
  ]
  const direktPieColors = [COLORS.direkt, COLORS.endirekt]

  const asansorMekanikPieData = [
    { name: "Asansör", value: asansorMekanik.asansor },
    { name: "Mekanik", value: asansorMekanik.mekanik },
    { name: "Yok", value: asansorMekanik.yok },
  ]
  const asansorPieColors = [COLORS.asansor, COLORS.mekanik, COLORS.yok]

  const yuzde = (pay: number) => (ozet.toplamCalisan > 0 ? Number((pay / ozet.toplamCalisan * 100).toFixed(1)) : 0)

  // Yaka bloklari (kart + bar listesi) tek yerden: sayilar, ikon, hedef ve renk birlikte.
  const yakaBloklari = [
    { anahtar: "beyaz" as const, sayi: ozet.beyazYaka, ikon: Briefcase, hedef: "/personnel?tab=personel&yaka=BEYAZ", bolumler: beyazYakaBolumler },
    { anahtar: "mavi" as const, sayi: ozet.maviYaka, ikon: Wrench, hedef: "/personnel?tab=personel&yaka=MAVI", bolumler: maviYakaBolumler },
    { anahtar: "gri" as const, sayi: ozet.griYaka, ikon: HardHat, hedef: "/personnel?tab=personel&yaka=GRI", bolumler: griYakaBolumler },
  ]

  const handleExport = () => {
    const rows: string[] = []
    rows.push("Personel Dashboard Raporu")
    rows.push("")
    rows.push("Genel Ozet")
    rows.push(`Toplam Çalışan,${ozet.toplamCalisan}`)
    rows.push(`Beyaz Yaka,${ozet.beyazYaka}`)
    rows.push(`Mavi Yaka,${ozet.maviYaka}`)
    rows.push(`Gri Yaka,${ozet.griYaka}`)
    rows.push(`Direkt,${ozet.direkt}`)
    rows.push(`Endirekt,${ozet.endirekt}`)
    rows.push(`Erkek,${cinsiyetDagilimi.erkek}`)
    rows.push(`Kadın,${cinsiyetDagilimi.kadin}`)
    rows.push("")
    rows.push("Yaka-Cinsiyet Tablosu")
    rows.push("Yaka,Genel,Erkek,Kadın,Engelli")
    rows.push(`Beyaz,${yakaCinsiyetTablosu.beyaz.genel},${yakaCinsiyetTablosu.beyaz.erkek},${yakaCinsiyetTablosu.beyaz.kadin},${yakaCinsiyetTablosu.beyaz.engelli}`)
    rows.push(`Mavi,${yakaCinsiyetTablosu.mavi.genel},${yakaCinsiyetTablosu.mavi.erkek},${yakaCinsiyetTablosu.mavi.kadin},${yakaCinsiyetTablosu.mavi.engelli}`)
    rows.push(`Gri,${yakaCinsiyetTablosu.gri.genel},${yakaCinsiyetTablosu.gri.erkek},${yakaCinsiyetTablosu.gri.kadin},${yakaCinsiyetTablosu.gri.engelli}`)
    rows.push(`Toplam,${yakaCinsiyetTablosu.toplam.genel},${yakaCinsiyetTablosu.toplam.erkek},${yakaCinsiyetTablosu.toplam.kadin},${yakaCinsiyetTablosu.toplam.engelli}`)
    rows.push("")
    rows.push("Beyaz Yaka Bölüm Dağılımı")
    rows.push("Bölüm,Sayi,Oran")
    beyazYakaBolumler.forEach(b => rows.push(`${b.bolum},${b.sayi},${b.oran}`))
    rows.push("")
    rows.push("Mavi Yaka Bölüm Dağılımı")
    rows.push("Bölüm,Sayi,Oran")
    maviYakaBolumler.forEach(b => rows.push(`${b.bolum},${b.sayi},${b.oran}`))
    rows.push("")
    rows.push("Gri Yaka Bölüm Dağılımı")
    rows.push("Bölüm,Sayi,Oran")
    griYakaBolumler.forEach(b => rows.push(`${b.bolum},${b.sayi},${b.oran}`))

    const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "personel-dashboard.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div id="personel-yazdir-alani" className="space-y-6 print:space-y-4">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/personnel" className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors print:hidden">
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Personel Dashboard</h1>
            <p className="text-sm text-slate-500 mt-0.5">İnsan Kaynakları - Personel İstatistikleri</p>
          </div>
        </div>
        <div className="flex gap-2 print:hidden">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Excel İndir
          </button>
          <button
            onClick={yazdir}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            Yazdır
          </button>
        </div>
      </div>

      {/* Summary Cards — bes kart tek satirda (xl; yazdirmada da tek satir).
          Kart olculeri p-4 / text-2xl / h-8 w-8; yaka renkleri YAKA_RENK'ten. */}
      <div data-yazdir-kartlar className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {/* Toplam */}
        <div className="relative overflow-hidden bg-white border border-slate-200 rounded-xl p-4 before:absolute before:top-0 before:left-0 before:right-0 before:h-[3px] before:bg-slate-800">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center mb-3">
            <Users className="w-4 h-4 text-slate-700" />
          </div>
          <p className="text-2xl font-semibold tabular-nums text-slate-900">{ozet.toplamCalisan}</p>
          <p className="text-xs font-medium text-slate-500 mt-1">Toplam Çalışan</p>
          <p className="text-[11px] text-slate-400 mt-1.5">Aktif personel</p>
        </div>

        {/* Beyaz / Mavi / Gri Yaka */}
        {yakaBloklari.map(blok => {
          const renk = YAKA_RENK[blok.anahtar]
          const Ikon = blok.ikon
          return (
            <div
              key={blok.anahtar}
              className={`relative overflow-hidden bg-white border border-slate-200 rounded-xl p-4 before:absolute before:top-0 before:left-0 before:right-0 before:h-[3px] ${renk.cizgi}`}
            >
              <div className={`w-8 h-8 rounded-lg ${renk.ikonKutu} flex items-center justify-center mb-3`}>
                <Ikon className={`w-4 h-4 ${renk.ikon}`} />
              </div>
              <p className={`text-2xl font-semibold tabular-nums ${renk.rakam}`}>{blok.sayi}</p>
              <p className="text-xs font-medium text-slate-500 mt-1">{renk.ad}</p>
              <p className="text-[11px] text-slate-400 mt-1.5">%{yuzde(blok.sayi)} oranı</p>
              <SplitBadge
                className="mt-2 print:hidden"
                label={`${blok.sayi} kişi`}
                action="Listele"
                href={blok.hedef}
                tone={renk.tone}
              />
            </div>
          )
        })}

        {/* Kadın/Erkek */}
        <div className="relative overflow-hidden bg-white border border-slate-200 rounded-xl p-4 before:absolute before:top-0 before:left-0 before:right-0 before:h-[3px] before:bg-rose-500">
          <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center mb-3">
            <Users className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-semibold tabular-nums text-rose-600">{cinsiyetDagilimi.kadin} / {cinsiyetDagilimi.erkek}</p>
          <p className="text-xs font-medium text-slate-500 mt-1">Kadın / Erkek</p>
          <p className="text-[11px] text-slate-400 mt-1.5">%{yuzde(cinsiyetDagilimi.kadin)} kadın oranı</p>
        </div>
      </div>

      {/* Yaka-Cinsiyet Cross Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-slate-500" />
            Yaka - Cinsiyet Dağılımı
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left text-xs font-semibold uppercase tracking-wide text-slate-400 px-4 py-2.5">Yaka Tipi</th>
                <th className="text-center text-xs font-semibold uppercase tracking-wide text-slate-400 px-4 py-2.5">Genel</th>
                <th className="text-center text-xs font-semibold uppercase tracking-wide text-slate-400 px-4 py-2.5">Erkek</th>
                <th className="text-center text-xs font-semibold uppercase tracking-wide text-slate-400 px-4 py-2.5">Kadın</th>
                <th className="text-center text-xs font-semibold uppercase tracking-wide text-slate-400 px-4 py-2.5">Engelli</th>
              </tr>
            </thead>
            <tbody>
              {yakaBloklari.map(blok => {
                const renk = YAKA_RENK[blok.anahtar]
                const satir = yakaCinsiyetTablosu[blok.anahtar]
                return (
                  <tr key={blok.anahtar} className={`border-b border-slate-50 ${renk.satirHover}`}>
                    <td className={`px-4 py-2.5 text-xs font-semibold ${renk.metin} flex items-center gap-2`}>
                      <span className={`w-2.5 h-2.5 rounded-full ${renk.nokta}`} />
                      {renk.ad.toLocaleUpperCase("tr-TR")}
                    </td>
                    <td className="px-4 py-2.5 text-center text-xs tabular-nums font-semibold text-slate-800">{satir.genel}</td>
                    <td className="px-4 py-2.5 text-center text-xs tabular-nums text-teal-600">{satir.erkek}</td>
                    <td className="px-4 py-2.5 text-center text-xs tabular-nums text-rose-500">{satir.kadin}</td>
                    <td className="px-4 py-2.5 text-center text-xs tabular-nums text-amber-600">{satir.engelli}</td>
                  </tr>
                )
              })}
              <tr className="bg-slate-50 font-semibold">
                <td className="px-4 py-2.5 text-xs font-bold text-slate-700">TOPLAM</td>
                <td className="px-4 py-2.5 text-center text-xs tabular-nums font-bold text-slate-900">{yakaCinsiyetTablosu.toplam.genel}</td>
                <td className="px-4 py-2.5 text-center text-xs tabular-nums font-bold text-teal-700">{yakaCinsiyetTablosu.toplam.erkek}</td>
                <td className="px-4 py-2.5 text-center text-xs tabular-nums font-bold text-rose-600">{yakaCinsiyetTablosu.toplam.kadin}</td>
                <td className="px-4 py-2.5 text-center text-xs tabular-nums font-bold text-amber-700">{yakaCinsiyetTablosu.toplam.engelli}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Two Pie Charts side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Yaka Dağılımı Pie */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-blue-500" />
            Yaka Dağılımı
          </h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={yakaPieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={45}
                  dataKey="value"
                  label={renderCustomLabel}
                  labelLine={false}
                >
                  {yakaPieData.map((_, i) => (
                    <Cell key={i} fill={yakaPieColors[i]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [value, "Kişi"]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cinsiyet Dağılımı Pie */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-rose-500" />
            Cinsiyet Dağılımı
          </h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={cinsiyetPieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={45}
                  dataKey="value"
                  label={renderCustomLabel}
                  labelLine={false}
                >
                  {cinsiyetPieData.map((_, i) => (
                    <Cell key={i} fill={cinsiyetPieColors[i]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [value, "Kişi"]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bölüm dağılımı — yatay bar listesi (Tremor "Bar List" deseni).
          Recharts değil: saf div/Tailwind, yazdırmada da bozulmadan basılır. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {yakaBloklari.map(blok => {
          const renk = YAKA_RENK[blok.anahtar]
          return (
            <div key={blok.anahtar} className="bg-white border border-slate-200 rounded-xl p-4 print:break-inside-avoid">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${renk.nokta}`} />
                  {renk.ad} Bölüm Dağılımı
                </h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {blok.bolumler.length} bölüm
                </span>
              </div>
              <BarList
                data={blok.bolumler.map(b => ({ label: b.bolum, value: b.sayi, meta: `%${b.oran}` }))}
                barClassName={renk.bar}
              />
            </div>
          )
        })}
      </div>

      {/* Direkt/Endirekt Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Direkt/Endirekt Pie */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-amber-500" />
            Direkt / Endirekt Dağılımı
          </h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={direktEndirektPieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={40}
                  dataKey="value"
                  label={renderCustomLabel}
                  labelLine={false}
                >
                  {direktEndirektPieData.map((_, i) => (
                    <Cell key={i} fill={direktPieColors[i]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [value, "Kişi"]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Direkt / Endirekt Bölümleri — aynı bar listesi deseni */}
        {[
          { ad: "Direkt Bölümleri", satirlar: direktBolumler, nokta: "bg-amber-500", bar: "bg-amber-500" },
          { ad: "Endirekt Bölümleri", satirlar: endirektBolumler, nokta: "bg-slate-500", bar: "bg-slate-500" },
        ].map(grup => (
          <div key={grup.ad} className="bg-white border border-slate-200 rounded-xl p-4 print:break-inside-avoid">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <span className={`w-2.5 h-2.5 rounded-full ${grup.nokta}`} />
                {grup.ad}
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {grup.satirlar.length} bölüm
              </span>
            </div>
            <div className="max-h-[300px] overflow-y-auto print:max-h-none print:overflow-visible">
              <BarList
                data={grup.satirlar.map(r => ({ label: r.bolum, value: r.sayi, meta: `%${r.oran}` }))}
                barClassName={grup.bar}
              />
            </div>
          </div>
        ))}
      </div>

      {/* İstatistiksel Veriler */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-teal-500" />
          İstatistiksel Veriler
        </h3>
        {/* Oranlar: halka + "x / y" (Tremor "KPI Card 12" deseni) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <ProgressRingCard
            title="Kadın Oranı"
            percent={istatistik.kadinErkekOrani}
            numerator={cinsiyetDagilimi.kadin}
            denominator={ozet.toplamCalisan}
            ringClassName="text-rose-500"
          />
          <ProgressRingCard
            title="Engelli Çalışan"
            percent={yuzde(yakaCinsiyetTablosu.toplam.engelli)}
            numerator={yakaCinsiyetTablosu.toplam.engelli}
            denominator={ozet.toplamCalisan}
            ringClassName="text-amber-500"
          />
          <ProgressRingCard
            title="Direkt Oranı"
            percent={yuzde(ozet.direkt)}
            numerator={ozet.direkt}
            denominator={ozet.toplamCalisan}
            ringClassName="text-amber-600"
          />
          {yakaBloklari.map(blok => {
            const renk = YAKA_RENK[blok.anahtar]
            return (
              <ProgressRingCard
                key={blok.anahtar}
                title={`${renk.ad} Oranı`}
                percent={yuzde(blok.sayi)}
                numerator={blok.sayi}
                denominator={ozet.toplamCalisan}
                ringClassName={renk.halka}
              />
            )
          })}
          <ProgressRingCard
            title="AR-GE Çalışan Oranı"
            percent={istatistik.argeCalisanOrani}
            description="Mühendislik + AR-GE bölümleri"
            ringClassName="text-teal-600"
          />
          <ProgressRingCard
            title="Lisans ve Üzeri Mezun"
            percent={istatistik.yulesekLisansMezunOrani}
            description="Lisans, Y.L., Doktora"
            ringClassName="text-violet-600"
          />
          <ProgressRingCard
            title="Mühendis Oranı"
            percent={istatistik.muhendisOrani}
            numerator={istatistik.muhendisSayisi}
            denominator={ozet.toplamCalisan}
            ringClassName="text-blue-600"
          />
        </div>

        {/* Mutlak degerler halka ile gosterilmez */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-3">
          <StatCard label="Mühendis Sayısı" value={`${istatistik.muhendisSayisi}`} sub={`%${istatistik.muhendisOrani} toplam oran`} />
          <StatCard label="Mühendis Ort. Çalışma" value={`${istatistik.muhendislerOrtCalismaSuresi} yıl`} sub="Ortalama kıdem" />
        </div>
      </div>

      {/* Asansör/Mekanik Dağılımı */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <Wrench className="w-4 h-4 text-orange-500" />
          Asansör / Mekanik Dağılımı
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={asansorMekanikPieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  innerRadius={35}
                  dataKey="value"
                  label={renderCustomLabel}
                  labelLine={false}
                >
                  {asansorMekanikPieData.map((_, i) => (
                    <Cell key={i} fill={asansorPieColors[i]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [value, "Kişi"]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-sky-50 rounded-lg p-3 text-center">
              <p className="text-[10px] font-semibold uppercase text-sky-600 mb-1">Asansör</p>
              <p className="text-2xl font-semibold tabular-nums text-sky-700">{asansorMekanik.asansor}</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 text-center">
              <p className="text-[10px] font-semibold uppercase text-orange-600 mb-1">Mekanik</p>
              <p className="text-2xl font-semibold tabular-nums text-orange-700">{asansorMekanik.mekanik}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <p className="text-[10px] font-semibold uppercase text-slate-500 mb-1">Yok</p>
              <p className="text-2xl font-semibold tabular-nums text-slate-600">{asansorMekanik.yok}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Ozel Grup Ozeti */}
      <div>
        <p className="text-[10px] font-semibold tracking-widest uppercase text-slate-400 mb-3">
          Ozel Grup Ozeti
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Asansör Mavi Yaka", val: ozelGrup.asansorMavi, renk: "#7c3aed", bg: "bg-violet-50" },
            { label: "Asansör Beyaz Yaka", val: ozelGrup.asansorBeyaz, renk: "#2563eb", bg: "bg-blue-50" },
            { label: "Stajyer (Aktif)", val: ozelGrup.stajyerAktif, renk: "#0d9488", bg: "bg-teal-50" },
            { label: "Danisman (Aktif)", val: ozelGrup.danismanAktif, renk: "#64748b", bg: "bg-slate-50" },
          ].map(item => (
            <div key={item.label} className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">{item.label}</p>
              <p className="text-2xl font-semibold tabular-nums" style={{ color: item.renk }}>{item.val}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
