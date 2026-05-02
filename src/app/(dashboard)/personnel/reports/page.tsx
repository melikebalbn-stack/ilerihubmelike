"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Users, Briefcase, Wrench, BarChart3, PieChart as PieChartIcon, ArrowLeft, Download, Printer } from "lucide-react"
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts"

interface BolumSatir { bolum: string; sayi: number; oran: number }

interface ReportData {
  ozet: {
    toplamCalisan: number
    beyazYaka: number
    maviYaka: number
    direkt: number
    endirekt: number
  }
  cinsiyetDagilimi: { erkek: number; kadin: number }
  yakaCinsiyetTablosu: {
    beyaz: { genel: number; erkek: number; kadin: number; engelli: number }
    mavi: { genel: number; erkek: number; kadin: number; engelli: number }
    toplam: { genel: number; erkek: number; kadin: number; engelli: number }
  }
  beyazYakaBolumler: BolumSatir[]
  maviYakaBolumler: BolumSatir[]
  direktBolumler: BolumSatir[]
  endirektBolumler: BolumSatir[]
  istatistik: {
    kadinErkekOrani: number
    beyazMaviOrani: number
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

const COLORS = {
  beyaz: "#2563eb",
  mavi: "#7c3aed",
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
      <p className="text-lg font-bold font-mono text-slate-800">{value}</p>
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

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
    </div>
  )

  if (!data) return (
    <div className="p-6 text-sm text-slate-500">Veri yüklenemedi.</div>
  )

  const { ozet, cinsiyetDagilimi, yakaCinsiyetTablosu, beyazYakaBolumler, maviYakaBolumler, direktBolumler, endirektBolumler, istatistik, asansorMekanik, ozelGrup } = data

  const yakaPieData = [
    { name: "Beyaz Yaka", value: ozet.beyazYaka },
    { name: "Mavi Yaka", value: ozet.maviYaka },
  ]
  const yakaPieColors = [COLORS.beyaz, COLORS.mavi]

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

  const beyazBarData = beyazYakaBolumler.slice(0, 15).map(b => ({ name: b.bolum, sayi: b.sayi }))
  const maviBarData = maviYakaBolumler.slice(0, 15).map(b => ({ name: b.bolum, sayi: b.sayi }))

  const handleExport = () => {
    const rows: string[] = []
    rows.push("Personel Dashboard Raporu")
    rows.push("")
    rows.push("Genel Ozet")
    rows.push(`Toplam Çalışan,${ozet.toplamCalisan}`)
    rows.push(`Beyaz Yaka,${ozet.beyazYaka}`)
    rows.push(`Mavi Yaka,${ozet.maviYaka}`)
    rows.push(`Direkt,${ozet.direkt}`)
    rows.push(`Endirekt,${ozet.endirekt}`)
    rows.push(`Erkek,${cinsiyetDagilimi.erkek}`)
    rows.push(`Kadın,${cinsiyetDagilimi.kadin}`)
    rows.push("")
    rows.push("Yaka-Cinsiyet Tablosu")
    rows.push("Yaka,Genel,Erkek,Kadın,Engelli")
    rows.push(`Beyaz,${yakaCinsiyetTablosu.beyaz.genel},${yakaCinsiyetTablosu.beyaz.erkek},${yakaCinsiyetTablosu.beyaz.kadin},${yakaCinsiyetTablosu.beyaz.engelli}`)
    rows.push(`Mavi,${yakaCinsiyetTablosu.mavi.genel},${yakaCinsiyetTablosu.mavi.erkek},${yakaCinsiyetTablosu.mavi.kadin},${yakaCinsiyetTablosu.mavi.engelli}`)
    rows.push(`Toplam,${yakaCinsiyetTablosu.toplam.genel},${yakaCinsiyetTablosu.toplam.erkek},${yakaCinsiyetTablosu.toplam.kadin},${yakaCinsiyetTablosu.toplam.engelli}`)
    rows.push("")
    rows.push("Beyaz Yaka Bölüm Dağılımı")
    rows.push("Bölüm,Sayi,Oran")
    beyazYakaBolumler.forEach(b => rows.push(`${b.bolum},${b.sayi},${b.oran}`))
    rows.push("")
    rows.push("Mavi Yaka Bölüm Dağılımı")
    rows.push("Bölüm,Sayi,Oran")
    maviYakaBolumler.forEach(b => rows.push(`${b.bolum},${b.sayi},${b.oran}`))

    const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "personel-dashboard.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 print:space-y-4">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/personnel" className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
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
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            Yazdır
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Toplam */}
        <div className="relative overflow-hidden bg-white border border-slate-200 rounded-xl p-4 before:absolute before:top-0 before:left-0 before:right-0 before:h-[3px] before:bg-teal-500">
          <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center mb-3">
            <Users className="w-4 h-4 text-teal-600" />
          </div>
          <p className="text-2xl font-bold font-mono text-teal-700">{ozet.toplamCalisan}</p>
          <p className="text-xs font-medium text-slate-500 mt-1">Toplam Çalışan</p>
          <p className="text-[11px] text-slate-400 mt-1.5">Aktif personel</p>
        </div>

        {/* Beyaz Yaka */}
        <div className="relative overflow-hidden bg-white border border-slate-200 rounded-xl p-4 before:absolute before:top-0 before:left-0 before:right-0 before:h-[3px] before:bg-blue-600">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center mb-3">
            <Briefcase className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold font-mono text-blue-600">{ozet.beyazYaka}</p>
          <p className="text-xs font-medium text-slate-500 mt-1">Beyaz Yaka</p>
          <p className="text-[11px] text-slate-400 mt-1.5">
            %{ozet.toplamCalisan > 0 ? (ozet.beyazYaka / ozet.toplamCalisan * 100).toFixed(1) : 0} oranı
          </p>
        </div>

        {/* Mavi Yaka */}
        <div className="relative overflow-hidden bg-white border border-slate-200 rounded-xl p-4 before:absolute before:top-0 before:left-0 before:right-0 before:h-[3px] before:bg-violet-600">
          <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center mb-3">
            <Wrench className="w-4 h-4 text-violet-600" />
          </div>
          <p className="text-2xl font-bold font-mono text-violet-600">{ozet.maviYaka}</p>
          <p className="text-xs font-medium text-slate-500 mt-1">Mavi Yaka</p>
          <p className="text-[11px] text-slate-400 mt-1.5">
            %{ozet.toplamCalisan > 0 ? (ozet.maviYaka / ozet.toplamCalisan * 100).toFixed(1) : 0} oranı
          </p>
        </div>

        {/* Kadın/Erkek */}
        <div className="relative overflow-hidden bg-white border border-slate-200 rounded-xl p-4 before:absolute before:top-0 before:left-0 before:right-0 before:h-[3px] before:bg-rose-500">
          <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center mb-3">
            <Users className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-bold font-mono text-rose-500">{cinsiyetDagilimi.kadin} / {cinsiyetDagilimi.erkek}</p>
          <p className="text-xs font-medium text-slate-500 mt-1">Kadın / Erkek</p>
          <p className="text-[11px] text-slate-400 mt-1.5">
            %{ozet.toplamCalisan > 0 ? (cinsiyetDagilimi.kadin / ozet.toplamCalisan * 100).toFixed(1) : 0} kadın oranı
          </p>
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
                <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400 px-4 py-2.5">Yaka Tipi</th>
                <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400 px-4 py-2.5">Genel</th>
                <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400 px-4 py-2.5">Erkek</th>
                <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400 px-4 py-2.5">Kadın</th>
                <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400 px-4 py-2.5">Engelli</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-50 hover:bg-blue-50/30">
                <td className="px-4 py-2.5 text-xs font-semibold text-blue-600 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  BEYAZ YAKA
                </td>
                <td className="px-4 py-2.5 text-center text-sm font-mono font-semibold text-slate-800">{yakaCinsiyetTablosu.beyaz.genel}</td>
                <td className="px-4 py-2.5 text-center text-sm font-mono text-teal-600">{yakaCinsiyetTablosu.beyaz.erkek}</td>
                <td className="px-4 py-2.5 text-center text-sm font-mono text-rose-500">{yakaCinsiyetTablosu.beyaz.kadin}</td>
                <td className="px-4 py-2.5 text-center text-sm font-mono text-amber-600">{yakaCinsiyetTablosu.beyaz.engelli}</td>
              </tr>
              <tr className="border-b border-slate-50 hover:bg-violet-50/30">
                <td className="px-4 py-2.5 text-xs font-semibold text-violet-600 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-violet-600" />
                  MAVI YAKA
                </td>
                <td className="px-4 py-2.5 text-center text-sm font-mono font-semibold text-slate-800">{yakaCinsiyetTablosu.mavi.genel}</td>
                <td className="px-4 py-2.5 text-center text-sm font-mono text-teal-600">{yakaCinsiyetTablosu.mavi.erkek}</td>
                <td className="px-4 py-2.5 text-center text-sm font-mono text-rose-500">{yakaCinsiyetTablosu.mavi.kadin}</td>
                <td className="px-4 py-2.5 text-center text-sm font-mono text-amber-600">{yakaCinsiyetTablosu.mavi.engelli}</td>
              </tr>
              <tr className="bg-slate-50 font-semibold">
                <td className="px-4 py-2.5 text-xs font-bold text-slate-700">TOPLAM</td>
                <td className="px-4 py-2.5 text-center text-sm font-mono font-bold text-slate-900">{yakaCinsiyetTablosu.toplam.genel}</td>
                <td className="px-4 py-2.5 text-center text-sm font-mono font-bold text-teal-700">{yakaCinsiyetTablosu.toplam.erkek}</td>
                <td className="px-4 py-2.5 text-center text-sm font-mono font-bold text-rose-600">{yakaCinsiyetTablosu.toplam.kadin}</td>
                <td className="px-4 py-2.5 text-center text-sm font-mono font-bold text-amber-700">{yakaCinsiyetTablosu.toplam.engelli}</td>
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

      {/* Two Bar Charts - Beyaz/Mavi Yaka Bölüm Dağılımı */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Beyaz Yaka Bölümler */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              Beyaz Yaka Bölüm Dağılımı
            </h3>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {beyazYakaBolumler.length} bölüm
            </span>
          </div>
          <div style={{ height: Math.max(300, beyazBarData.length * 28) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={beyazBarData} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" fontSize={11} />
                <YAxis type="category" dataKey="name" width={130} fontSize={10} tick={{ fill: "#475569" }} />
                <Tooltip formatter={(value: number) => [value, "Kişi"]} />
                <Bar dataKey="sayi" fill={COLORS.beyaz} radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Mavi Yaka Bölümler */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-violet-600" />
              Mavi Yaka Bölüm Dağılımı
            </h3>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {maviYakaBolumler.length} bölüm
            </span>
          </div>
          <div style={{ height: Math.max(300, maviBarData.length * 28) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={maviBarData} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" fontSize={11} />
                <YAxis type="category" dataKey="name" width={130} fontSize={10} tick={{ fill: "#475569" }} />
                <Tooltip formatter={(value: number) => [value, "Kişi"]} />
                <Bar dataKey="sayi" fill={COLORS.mavi} radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
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

        {/* Direkt Bölümler Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Direkt Bölümleri
            </div>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {direktBolumler.length} bölüm
            </span>
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="border-b border-slate-100">
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400 px-4 py-2">Bölüm</th>
                  <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400 px-4 py-2">Kişi</th>
                  <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400 px-4 py-2">%</th>
                </tr>
              </thead>
              <tbody>
                {direktBolumler.map((row, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-1.5 text-xs font-medium text-slate-800">{row.bolum}</td>
                    <td className="px-4 py-1.5 text-right text-xs font-mono text-slate-700">{row.sayi}</td>
                    <td className="px-4 py-1.5 text-right text-xs font-mono text-slate-500">%{row.oran}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Endirekt Bölümler Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              Endirekt Bölümleri
            </div>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {endirektBolumler.length} bölüm
            </span>
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="border-b border-slate-100">
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400 px-4 py-2">Bölüm</th>
                  <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400 px-4 py-2">Kişi</th>
                  <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400 px-4 py-2">%</th>
                </tr>
              </thead>
              <tbody>
                {endirektBolumler.map((row, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-1.5 text-xs font-medium text-slate-800">{row.bolum}</td>
                    <td className="px-4 py-1.5 text-right text-xs font-mono text-slate-700">{row.sayi}</td>
                    <td className="px-4 py-1.5 text-right text-xs font-mono text-slate-500">%{row.oran}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* İstatistiksel Veriler */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-teal-500" />
          İstatistiksel Veriler
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <StatCard label="Kadın Oranı" value={`%${istatistik.kadinErkekOrani}`} sub={`${cinsiyetDagilimi.kadin} kadın / ${ozet.toplamCalisan} toplam`} />
          <StatCard label="Beyaz Yaka Oranı" value={`%${istatistik.beyazMaviOrani}`} sub={`${ozet.beyazYaka} beyaz / ${ozet.toplamCalisan} toplam`} />
          <StatCard label="Mühendis Sayısı" value={`${istatistik.muhendisSayisi}`} sub={`%${istatistik.muhendisOrani} toplam oran`} />
          <StatCard label="Mühendis Ort. Çalışma" value={`${istatistik.muhendislerOrtCalismaSuresi} yıl`} sub="Ortalama kıdem" />
          <StatCard label="AR-GE Çalışan Oranı" value={`%${istatistik.argeCalisanOrani}`} sub="Mühendislik + AR-GE bölümleri" />
          <StatCard label="Lisans ve Üzeri Mezun" value={`%${istatistik.yulesekLisansMezunOrani}`} sub="Lisans, Y.L., Doktora" />
          <StatCard label="Direkt Oranı" value={`%${ozet.toplamCalisan > 0 ? (ozet.direkt / ozet.toplamCalisan * 100).toFixed(1) : 0}`} sub={`${ozet.direkt} direkt çalışan`} />
          <StatCard label="Engelli Çalışan" value={`${yakaCinsiyetTablosu.toplam.engelli}`} sub={`%${ozet.toplamCalisan > 0 ? (yakaCinsiyetTablosu.toplam.engelli / ozet.toplamCalisan * 100).toFixed(1) : 0} oran`} />
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
              <p className="text-xl font-bold font-mono text-sky-700">{asansorMekanik.asansor}</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 text-center">
              <p className="text-[10px] font-semibold uppercase text-orange-600 mb-1">Mekanik</p>
              <p className="text-xl font-bold font-mono text-orange-700">{asansorMekanik.mekanik}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <p className="text-[10px] font-semibold uppercase text-slate-500 mb-1">Yok</p>
              <p className="text-xl font-bold font-mono text-slate-600">{asansorMekanik.yok}</p>
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
              <p className="text-2xl font-bold font-mono" style={{ color: item.renk }}>{item.val}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
