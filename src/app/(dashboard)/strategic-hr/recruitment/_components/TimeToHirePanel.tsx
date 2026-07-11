"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Gauge, AlertTriangle } from "lucide-react"

type Pozisyon = {
  id: string
  title: string
  department: string
  hedef: number | null
  basvuru: number
  ortalamaTimeToHire: number | null
}
type Metrik = {
  ozet: { ortalamaTimeToHire: number | null; hedefAsimiSayisi: number }
  pozisyonlar: Pozisyon[]
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

  const { ozet, pozisyonlar } = data

  return (
    <div className="space-y-4">
      {/* KPI kartları — yalnız Time-to-Hire */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Gauge className="h-6 w-6 text-[#1B4F72]" />
            <div>
              <p className="text-xs text-slate-500">Ort. Time to Hire</p>
              <p className="text-2xl font-bold text-[#1B4F72]">
                {ozet.ortalamaTimeToHire !== null ? `${ozet.ortalamaTimeToHire} gün` : "-"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className={`h-6 w-6 ${ozet.hedefAsimiSayisi > 0 ? "text-red-600" : "text-slate-400"}`} />
            <div>
              <p className="text-xs text-slate-500">Hedef Aşımı (devam eden)</p>
              <p className={`text-2xl font-bold ${ozet.hedefAsimiSayisi > 0 ? "text-red-600" : "text-slate-400"}`}>
                {ozet.hedefAsimiSayisi}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pozisyon bazlı hedef vs gerçekleşen */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pozisyon Bazlı Time to Hire (hedef vs gerçekleşen)</CardTitle>
        </CardHeader>
        <CardContent>
          {pozisyonlar.length === 0 ? (
            <p className="text-sm text-slate-500">Henüz başvuru bulunan pozisyon yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="px-3 py-2">Pozisyon</th>
                    <th className="px-3 py-2">Departman</th>
                    <th className="px-3 py-2">Başvuru</th>
                    <th className="px-3 py-2">Hedef (gün)</th>
                    <th className="px-3 py-2">Ort. Gerçekleşen (gün)</th>
                  </tr>
                </thead>
                <tbody>
                  {pozisyonlar.map((p) => {
                    const asim = p.hedef !== null && p.ortalamaTimeToHire !== null && p.ortalamaTimeToHire > p.hedef
                    return (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="px-3 py-2 font-medium">{p.title}</td>
                        <td className="px-3 py-2 text-slate-600">{p.department}</td>
                        <td className="px-3 py-2">{p.basvuru}</td>
                        <td className="px-3 py-2">{p.hedef ?? "-"}</td>
                        <td className={`px-3 py-2 font-semibold ${asim ? "text-red-600" : "text-emerald-600"}`}>
                          {p.ortalamaTimeToHire ?? "-"}
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
