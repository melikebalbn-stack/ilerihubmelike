"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Radar } from "lucide-react"

// CandidateSource enum → okunabilir Türkçe etiket.
const KAYNAK_ETIKET: Record<string, string> = {
  DIRECT: "Doğrudan Başvuru",
  REFERRAL: "Referans",
  LINKEDIN: "LinkedIn",
  JOB_BOARD: "İş İlanı Sitesi",
  AGENCY: "İK Ajansı",
  CAREER_FAIR: "Kariyer Fuarı",
  INTERNAL: "İç Kaynak",
  OTHER: "Diğer",
}

type Kaynak = { source: string; basvuru: number; iseBaslayan: number; donusumOrani: number }

export default function SourceBreakdownPanel() {
  const [kaynaklar, setKaynaklar] = useState<Kaynak[] | null>(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/strategic-hr/recruitment/metrics/source-breakdown")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Kaynak kırılımı alınamadı")
        return r.json()
      })
      .then((d) => setKaynaklar(d.kaynaklar))
      .catch((e) => setHata(e.message))
      .finally(() => setYukleniyor(false))
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Radar className="h-4 w-4 text-[#1B4F72]" />
          Kaynak Kırılımı
        </CardTitle>
      </CardHeader>
      <CardContent>
        {yukleniyor ? (
          <div className="flex items-center justify-center h-24">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#1B4F72]" />
          </div>
        ) : hata ? (
          <p className="text-sm text-red-600">{hata}</p>
        ) : !kaynaklar || kaynaklar.length === 0 ? (
          <p className="text-sm text-slate-500">Henüz başvuru kaynağı verisi yok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="px-3 py-2">Kaynak</th>
                  <th className="px-3 py-2">Başvuru</th>
                  <th className="px-3 py-2">İşe Başlayan</th>
                  <th className="px-3 py-2">Dönüşüm</th>
                </tr>
              </thead>
              <tbody>
                {kaynaklar.map((k) => (
                  <tr key={k.source} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{KAYNAK_ETIKET[k.source] ?? k.source}</td>
                    <td className="px-3 py-2">{k.basvuru}</td>
                    <td className="px-3 py-2">{k.iseBaslayan}</td>
                    <td className="px-3 py-2 font-semibold text-[#1B4F72]">%{k.donusumOrani}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
