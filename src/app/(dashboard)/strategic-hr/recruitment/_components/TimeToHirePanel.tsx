"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Gauge, Users, Hourglass } from "lucide-react"

// JobApplicationStatus → okunabilir Türkçe etiket.
const ASAMA_ETIKET: Record<string, string> = {
  CONSENT_PENDING: "KVKK Onayı Bekliyor",
  HEALTH_PENDING: "Sağlık Beyanı Bekliyor",
  PENDING: "İnceleme Kuyruğu",
  REVIEWED: "İncelendi",
  REVIEWING: "İnceleniyor",
  SHORTLISTED: "Ön Eleme",
  INTERVIEW: "Mülakat",
  ACCEPTED: "Kabul Edildi",
  REJECTED: "Reddedildi",
}

type Asama = {
  status: string
  bekleyen: number
  ortBekleme: number | null
  ortGecis: number | null
}
type Metrik = {
  ozet: { ortalamaTimeToHire: number | null; iseAlinanSayisi: number; toplamBasvuru: number }
  beklemeEsikGun: number
  asamalar: Asama[]
}

export default function TimeToHirePanel() {
  const [data, setData] = useState<Metrik | null>(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/strategic-hr/recruitment/metrics/time-to-hire")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Metrikler alınamadı")
        return r.json()
      })
      .then(setData)
      .catch((e) => setHata(e.message))
      .finally(() => setYukleniyor(false))
  }, [])

  if (yukleniyor) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B4F72]" />
      </div>
    )
  }
  if (hata) return <p className="text-sm text-red-600 py-6">{hata}</p>
  if (!data) return null

  const { ozet, beklemeEsikGun, asamalar } = data

  return (
    <div className="space-y-4">
      {/* KPI kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Gauge className="h-6 w-6 text-[#1B4F72]" />
            <div>
              <p className="text-xs text-slate-500">Ort. İşe Alım Süresi</p>
              <p className="text-2xl font-bold text-[#1B4F72]">
                {ozet.ortalamaTimeToHire !== null ? `${ozet.ortalamaTimeToHire} gün` : "-"}
              </p>
              <p className="text-[11px] text-slate-400">
                {ozet.iseAlinanSayisi > 0
                  ? `${ozet.iseAlinanSayisi} işe alınan üzerinden`
                  : "Henüz işe alınan (ACCEPTED) yok"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Users className="h-6 w-6 text-[#1B4F72]" />
            <div>
              <p className="text-xs text-slate-500">Toplam Başvuru</p>
              <p className="text-2xl font-bold text-[#1B4F72]">{ozet.toplamBasvuru}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Aşama-bazlı süre / darboğaz */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Hourglass className="h-4 w-4 text-[#1B4F72]" />
            Aşama Süreleri ve Darboğaz
          </CardTitle>
          <p className="text-xs text-slate-500">
            Kırmızı: ort. bekleme {beklemeEsikGun} günü aşan aşamalar (darboğaz).
          </p>
        </CardHeader>
        <CardContent>
          {asamalar.length === 0 ? (
            <p className="text-sm text-slate-500">Henüz aşama verisi yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="px-3 py-2">Aşama</th>
                    <th className="px-3 py-2">Bekleyen</th>
                    <th className="px-3 py-2">Ort. Bekleme (gün)</th>
                    <th className="px-3 py-2">Ort. Geçiş Süresi (gün)</th>
                  </tr>
                </thead>
                <tbody>
                  {asamalar.map((a) => {
                    const darbogaz = a.ortBekleme !== null && a.ortBekleme > beklemeEsikGun
                    return (
                      <tr key={a.status} className="border-b last:border-0">
                        <td className="px-3 py-2 font-medium">{ASAMA_ETIKET[a.status] ?? a.status}</td>
                        <td className="px-3 py-2">{a.bekleyen}</td>
                        <td className={`px-3 py-2 font-semibold ${darbogaz ? "text-red-600" : "text-slate-700"}`}>
                          {a.ortBekleme !== null ? a.ortBekleme : "-"}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {a.ortGecis !== null ? a.ortGecis : "-"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
