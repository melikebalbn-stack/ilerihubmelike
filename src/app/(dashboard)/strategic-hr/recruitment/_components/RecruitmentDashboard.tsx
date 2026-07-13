"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Activity, UserCheck, AlertTriangle, Gauge, Timer, Banknote, TrendingDown, Filter, XCircle } from "lucide-react"

const MAVI = "#1B4F72"
const KAT_RENK: Record<string, string> = {
  TEKLIF_REDDI: "bg-amber-500",
  ISE_ALMAMA: "bg-rose-500",
  SUREC_KAYBI: "bg-slate-500",
}
const ASAMA_ETIKET: Record<string, string> = {
  PENDING: "Başvuru / Kuyruk", REVIEWING: "İnceleniyor", SHORTLISTED: "Ön Eleme", SINAV: "Sınav",
  TELEFON_MULAKATI: "Telefon Mülakatı", IK_MULAKATI: "İK Mülakatı", TEKNIK_MULAKAT: "Teknik Mülakat",
  INTERVIEW: "Mülakat", TEKLIF: "Teklif", TEKLIF_KABUL: "Teklif Kabul", ISE_BASLADI: "İşe Başladı",
}
const KAYNAK_ETIKET: Record<string, string> = {
  AGENCY: "Aracı Kurum", ISKUR: "İŞKUR", WEBSITE: "Web Sitesi", REFERENCE: "Referans", OTHER: "Diğer", BELIRTILMEMIS: "Belirtilmemiş",
}
const TL = (n: number) => `₺${n.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}`
const gun = (n: number | null) => (n !== null ? `${n} gün` : "-")

type Dash = {
  kpi: { toplamBasvuru: number; surecte: number; iseBaslayan: number; hedefAsimi: number | null; ortTimeToHire: number | null; ortTimeToFill: number | null; toplamMaliyet: number; costPerHire: number | null }
  huni: { status: string; count: number; yuzde: number }[]
  reddedilen: number
  pareto: { name: string; category: string; categoryLabel: string; count: number }[]
  pozisyonlar: { position: string; basvuru: number; ortTimeToHire: number | null; costPerHire: number | null }[]
  kaynaklar: { source: string; basvuru: number; iseAlinan: number; donusum: number }[]
}

function Kart({ icon, baslik, deger, alt }: { icon: React.ReactNode; baslik: string; deger: string; alt?: string }) {
  return (
    <Card>
      <CardContent className="py-4 flex items-center gap-3">
        <div className="text-[#1B4F72]">{icon}</div>
        <div>
          <p className="text-xs text-slate-500">{baslik}</p>
          <p className="text-xl font-bold text-[#1B4F72]">{deger}</p>
          {alt && <p className="text-[11px] text-slate-400">{alt}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

export default function RecruitmentDashboard() {
  const [d, setD] = useState<Dash | null>(null)
  const [hata, setHata] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/strategic-hr/recruitment/metrics/dashboard")
      .then(async (r) => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Alınamadı"); return r.json() })
      .then(setD).catch((e) => setHata(e.message))
  }, [])

  if (hata) return <p className="text-sm text-red-600">{hata}</p>
  if (!d) return <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B4F72]" /></div>

  const paretoMax = Math.max(1, ...d.pareto.map((p) => p.count))
  const huniMax = Math.max(1, ...d.huni.map((h) => h.count))

  return (
    <div className="space-y-4">
      {/* 8 KPI kartı */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kart icon={<Users className="h-6 w-6" />} baslik="Toplam Başvuru" deger={String(d.kpi.toplamBasvuru)} />
        <Kart icon={<Activity className="h-6 w-6" />} baslik="Süreçte" deger={String(d.kpi.surecte)} />
        <Kart icon={<UserCheck className="h-6 w-6" />} baslik="İşe Başlayan" deger={String(d.kpi.iseBaslayan)} />
        <Kart icon={<AlertTriangle className="h-6 w-6" />} baslik="Hedef Aşımı" deger={d.kpi.hedefAsimi !== null ? String(d.kpi.hedefAsimi) : "-"} alt={d.kpi.hedefAsimi === null ? "pozisyon bağı yok" : undefined} />
        <Kart icon={<Gauge className="h-6 w-6" />} baslik="Ort. Time to Hire" deger={gun(d.kpi.ortTimeToHire)} />
        <Kart icon={<Timer className="h-6 w-6" />} baslik="Ort. Time to Fill" deger={gun(d.kpi.ortTimeToFill)} alt={d.kpi.ortTimeToFill === null ? "ilan bağı yok" : undefined} />
        <Kart icon={<Banknote className="h-6 w-6" />} baslik="Toplam İşe Alım Maliyeti" deger={TL(d.kpi.toplamMaliyet)} />
        <Kart icon={<TrendingDown className="h-6 w-6" />} baslik="Genel Cost per Hire" deger={d.kpi.costPerHire !== null ? TL(d.kpi.costPerHire) : "-"} />
      </div>

      {/* Huni + Pareto yan yana */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Filter className="h-4 w-4 text-[#1B4F72]" /> İşe Alım Hunisi</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {d.huni.length === 0 ? <p className="text-sm text-slate-500">Aşama verisi yok.</p> : d.huni.map((h) => (
              <div key={h.status}>
                <div className="flex justify-between text-sm mb-0.5"><span>{ASAMA_ETIKET[h.status] ?? h.status}</span><span className="text-slate-500">{h.count} (%{h.yuzde})</span></div>
                <div className="h-4 bg-slate-100 rounded"><div className="h-4 rounded" style={{ width: `${Math.max(3, (h.count / huniMax) * 100)}%`, background: MAVI }} /></div>
              </div>
            ))}
            {d.reddedilen > 0 && <p className="text-xs text-rose-600 pt-1">Reddedilen: {d.reddedilen}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><XCircle className="h-4 w-4 text-[#1B4F72]" /> Kök Neden Pareto</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {d.pareto.length === 0 ? <p className="text-sm text-slate-500">Henüz ret nedeni kaydı yok.</p> : d.pareto.map((p, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm mb-0.5"><span>{p.name} <span className="text-xs text-slate-400">· {p.categoryLabel}</span></span><span className="text-slate-500">{p.count}</span></div>
                <div className="h-4 bg-slate-100 rounded"><div className={`h-4 rounded ${KAT_RENK[p.category] ?? "bg-slate-400"}`} style={{ width: `${Math.max(3, (p.count / paretoMax) * 100)}%` }} /></div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Pozisyon bazlı tablo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pozisyon Bazlı Time to Hire ve Cost per Hire</CardTitle>
          <p className="text-xs text-amber-600">Not: başvuru↔ilan bağı olmadığından pozisyon, serbest metin "Talep edilen iş/bölüm" alanından KABA gruplanır; Cost per Hire pozisyon bazında hesaplanamaz ("-").</p>
        </CardHeader>
        <CardContent>
          {d.pozisyonlar.length === 0 ? <p className="text-sm text-slate-500">Veri yok.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-slate-500 border-b"><th className="px-3 py-2">Pozisyon (serbest metin)</th><th className="px-3 py-2">Başvuru</th><th className="px-3 py-2">Ort. Time to Hire</th><th className="px-3 py-2">Cost per Hire</th></tr></thead>
                <tbody>{d.pozisyonlar.map((p, i) => (
                  <tr key={i} className="border-b last:border-0"><td className="px-3 py-2 font-medium">{p.position}</td><td className="px-3 py-2">{p.basvuru}</td><td className="px-3 py-2">{gun(p.ortTimeToHire)}</td><td className="px-3 py-2 text-slate-400">-</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Kaynak Kırılımı (korundu) */}
      <Card>
        <CardHeader><CardTitle className="text-base">Kaynak Kırılımı</CardTitle></CardHeader>
        <CardContent>
          {d.kaynaklar.length === 0 ? <p className="text-sm text-slate-500">Kaynak verisi yok.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-slate-500 border-b"><th className="px-3 py-2">Kaynak</th><th className="px-3 py-2">Başvuru</th><th className="px-3 py-2">İşe Alınan</th><th className="px-3 py-2">Dönüşüm</th></tr></thead>
                <tbody>{d.kaynaklar.map((k) => (
                  <tr key={k.source} className={`border-b last:border-0 ${k.source === "BELIRTILMEMIS" ? "text-slate-400" : ""}`}>
                    <td className="px-3 py-2 font-medium">{KAYNAK_ETIKET[k.source] ?? k.source}</td><td className="px-3 py-2">{k.basvuru}</td><td className="px-3 py-2">{k.iseAlinan}</td><td className="px-3 py-2 font-semibold text-[#1B4F72]">%{k.donusum}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
