"use client"

import { useEffect, useState } from "react"
import { Users, Briefcase, Wrench, Settings } from "lucide-react"

interface BolumSatir { bolum: string; sayi: number; oran: number }
interface ReportData {
  ozet: {
    toplamCalisan: number
    beyazYaka: number
    maviYaka: number
    direkt: number
    endirekt: number
  }
  direktBolumler: BolumSatir[]
  endirektBolumler: BolumSatir[]
  ozelGrup: {
    asansorMavi: number
    asansorBeyaz: number
    stajyerAktif: number
    danismanAktif: number
  }
}

function barWidth(sayi: number, max: number) {
  return max > 0 ? Math.round((sayi / max) * 100) : 0
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

  const { ozet, direktBolumler, endirektBolumler, ozelGrup } = data
  const maxDirekt = direktBolumler[0]?.sayi ?? 1
  const maxEndirekt = endirektBolumler[0]?.sayi ?? 1

  return (
    <div className="space-y-6">

      {/* Başlık */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Toplantı Raporu</h1>
          <p className="text-sm text-slate-500 mt-0.5">İnsan Varlıkları - Personel İstatistikleri</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
            Excel İndir
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50" onClick={() => window.print()}>
            Yazdır
          </button>
        </div>
      </div>

      {/* Kaizen Kutusu */}
      <div className="bg-teal-50 border border-teal-100 border-l-4 border-l-teal-500 rounded-xl p-4 text-sm text-teal-700 leading-relaxed">
        <p className="font-semibold mb-1">Toplantı Raporu</p>
        Personel veritabanından anlık hesaplanır. <strong>Direkt</strong> çalışanlar üretime
        doğrudan katkı sağlayan bölümlerde görev yapar. <strong>Endirekt</strong> çalışanlar
        destek, yönetim ve ofis fonksiyonlarında yer alır.
      </div>

      {/* Özet Kartlar */}
      <div>
        <p className="text-[10px] font-semibold tracking-widest uppercase text-slate-400 mb-3">
          Genel Özet
        </p>
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
            <div className="h-[3px] bg-slate-100 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full"
                style={{ width: `${ozet.toplamCalisan > 0 ? ozet.beyazYaka / ozet.toplamCalisan * 100 : 0}%` }} />
            </div>
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
            <div className="h-[3px] bg-slate-100 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-violet-600 rounded-full"
                style={{ width: `${ozet.toplamCalisan > 0 ? ozet.maviYaka / ozet.toplamCalisan * 100 : 0}%` }} />
            </div>
          </div>

          {/* Direkt / Endirekt */}
          <div className="relative overflow-hidden bg-white border border-slate-200 rounded-xl p-4 before:absolute before:top-0 before:left-0 before:right-0 before:h-[3px] before:bg-amber-600">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center mb-3">
              <Settings className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-2xl font-bold font-mono text-amber-600">{ozet.direkt} / {ozet.endirekt}</p>
            <p className="text-xs font-medium text-slate-500 mt-1">Direkt / Endirekt</p>
            <p className="text-[11px] text-slate-400 mt-1.5">
              %{ozet.toplamCalisan > 0 ? (ozet.direkt / ozet.toplamCalisan * 100).toFixed(1) : 0} direkt oran
            </p>
            <div className="h-[3px] bg-slate-100 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-amber-600 rounded-full"
                style={{ width: `${ozet.toplamCalisan > 0 ? ozet.direkt / ozet.toplamCalisan * 100 : 0}%` }} />
            </div>
          </div>

        </div>
      </div>

      {/* Bölüm Tabloları */}
      <div>
        <p className="text-[10px] font-semibold tracking-widest uppercase text-slate-400 mb-3">
          Bölümlere Göre Dağılım
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Endirekt */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <span className="w-2 h-2 rounded-full bg-blue-600" />
                Endirekt Çalışan Bölümleri
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {endirektBolumler.length} bölüm
              </span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400 px-4 py-2">Bölüm</th>
                  <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400 px-4 py-2">Kişi</th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400 px-4 py-2 min-w-[110px]">Oran</th>
                </tr>
              </thead>
              <tbody>
                {endirektBolumler.map((row, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-2 text-xs font-medium text-slate-800">{row.bolum}</td>
                    <td className="px-4 py-2 text-right text-xs font-mono text-slate-700">{row.sayi}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-[5px] bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 rounded-full"
                            style={{ width: `${barWidth(row.sayi, maxEndirekt)}%` }} />
                        </div>
                        <span className="text-[11px] font-mono text-slate-500 w-8 text-right">%{row.oran}</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {endirektBolumler.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-6 text-center text-xs text-slate-400">Veri yok</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Direkt */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <span className="w-2 h-2 rounded-full bg-violet-600" />
                Direkt Çalışan Bölümleri
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {direktBolumler.length} bölüm
              </span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400 px-4 py-2">Bölüm</th>
                  <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400 px-4 py-2">Kişi</th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400 px-4 py-2 min-w-[110px]">Oran</th>
                </tr>
              </thead>
              <tbody>
                {direktBolumler.map((row, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-2 text-xs font-medium text-slate-800">{row.bolum}</td>
                    <td className="px-4 py-2 text-right text-xs font-mono text-slate-700">{row.sayi}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-[5px] bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-violet-600 rounded-full"
                            style={{ width: `${barWidth(row.sayi, maxDirekt)}%` }} />
                        </div>
                        <span className="text-[11px] font-mono text-slate-500 w-8 text-right">%{row.oran}</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {direktBolumler.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-6 text-center text-xs text-slate-400">Veri yok</td></tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      </div>

      {/* Yaka Dağılımı */}
      <div>
        <p className="text-[10px] font-semibold tracking-widest uppercase text-slate-400 mb-3">
          Yaka & Direkt/Endirekt Dağılımı
        </p>
        <div className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-6 items-center">

          {/* SVG Donut */}
          <div className="relative w-24 h-24 mx-auto sm:mx-0">
            <svg width="96" height="96" viewBox="0 0 96 96" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="48" cy="48" r="36" fill="none" stroke="#e2e8f0" strokeWidth="11" />
              <circle cx="48" cy="48" r="36" fill="none" stroke="#7c3aed" strokeWidth="11"
                strokeDasharray={`${ozet.toplamCalisan > 0 ? (ozet.maviYaka / ozet.toplamCalisan * 226).toFixed(1) : 0} 226`}
                strokeLinecap="round" />
              <circle cx="48" cy="48" r="36" fill="none" stroke="#2563eb" strokeWidth="11"
                strokeDasharray={`${ozet.toplamCalisan > 0 ? (ozet.beyazYaka / ozet.toplamCalisan * 226).toFixed(1) : 0} 226`}
                strokeDashoffset={`-${ozet.toplamCalisan > 0 ? (ozet.maviYaka / ozet.toplamCalisan * 226).toFixed(1) : 0}`}
                strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold font-mono text-slate-900">{ozet.toplamCalisan}</span>
              <span className="text-[9px] text-slate-400 font-medium">TOPLAM</span>
            </div>
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Mavi Yaka", sayi: ozet.maviYaka, renk: "#7c3aed", oran: ozet.toplamCalisan > 0 ? (ozet.maviYaka / ozet.toplamCalisan * 100).toFixed(1) : "0" },
              { label: "Beyaz Yaka", sayi: ozet.beyazYaka, renk: "#2563eb", oran: ozet.toplamCalisan > 0 ? (ozet.beyazYaka / ozet.toplamCalisan * 100).toFixed(1) : "0" },
              { label: "Direkt", sayi: ozet.direkt, renk: "#d97706", oran: ozet.toplamCalisan > 0 ? (ozet.direkt / ozet.toplamCalisan * 100).toFixed(1) : "0" },
              { label: "Endirekt", sayi: ozet.endirekt, renk: "#64748b", oran: ozet.toplamCalisan > 0 ? (ozet.endirekt / ozet.toplamCalisan * 100).toFixed(1) : "0" },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-[3px] flex-shrink-0" style={{ background: item.renk }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700">{item.label}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ background: item.renk, width: `${item.oran}%` }} />
                    </div>
                    <span className="text-xs font-semibold font-mono" style={{ color: item.renk }}>{item.sayi}</span>
                  </div>
                </div>
                <span className="text-[10.5px] font-mono text-slate-400 whitespace-nowrap">%{item.oran}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Özel Grup Özeti */}
      <div>
        <p className="text-[10px] font-semibold tracking-widest uppercase text-slate-400 mb-3">
          Özel Grup Özeti
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Asansör Mavi Yaka", val: ozelGrup.asansorMavi, renk: "#7c3aed" },
            { label: "Asansör Beyaz Yaka", val: ozelGrup.asansorBeyaz, renk: "#2563eb" },
            { label: "Stajyer (Aktif)", val: ozelGrup.stajyerAktif, renk: "#0d9488" },
            { label: "Danışman (Aktif)", val: ozelGrup.danismanAktif, renk: "#64748b" },
          ].map(item => (
            <div key={item.label} className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{item.label}</p>
              <p className="text-xl font-bold font-mono" style={{ color: item.renk }}>{item.val}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
