"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, LabelList,
} from "recharts"
import { BarChart3, Target, Loader2 } from "lucide-react"
import { apiFetch } from "@/lib/api-fetch"

const NAVY = "#1B4F72"

type Kisi = { ad: string; sicil: string; hedef: number; gerceklesen: number; yuzde: number; not: string | null }
type Bolum = { ad: string; hedef: number; gerceklesen: number; yuzde: number; kisiler: Kisi[] }
type PerfData = {
  date: string | null
  genel: { hedef: number; gerceklesen: number; yuzde: number | null }
  bolumler: Bolum[]
}

// Performans eşiği renkleri: <70 kırmızı, 70-89 sarı, >=90 yeşil
function perfColor(yuzde: number): string {
  if (yuzde < 70) return "#dc2626"
  if (yuzde < 90) return "#f59e0b"
  return "#16a34a"
}

export default function OvertimePerformancePage() {
  const [data, setData] = useState<PerfData | null>(null)
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [date, setDate] = useState("")

  const fetchData = useCallback(async (d: string) => {
    setLoading(true)
    try {
      const url = d ? `/api/overtime/performans?date=${d}` : "/api/overtime/performans"
      const res = await apiFetch(url)
      if (res.__authHandled) return
      if (res.status === 403) { setForbidden(true); return }
      if (!res.ok) throw new Error()
      const json: PerfData = await res.json()
      setData(json)
      if (!d && json.date) setDate(json.date)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData("") }, [fetchData])

  if (forbidden) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <BarChart3 className="h-14 w-14 text-red-400 mb-4" />
        <h2 className="text-xl font-bold text-red-600 mb-1">Erişim Reddedildi (403)</h2>
        <p className="text-muted-foreground">Mesai performans raporunu görüntüleme yetkiniz yok.</p>
      </div>
    )
  }

  const chartData = (data?.bolumler ?? []).map((b) => ({ ad: b.ad, yuzde: b.yuzde }))

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-7 w-7" style={{ color: NAVY }} />
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>Mesai Üretim Performansı</h1>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Mesai tarihi</label>
          <Input type="date" value={date} onChange={(e) => { setDate(e.target.value); fetchData(e.target.value) }} className="w-44" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !data || data.bolumler.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            Bu tarih için onaylı mesai performans verisi yok.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Özet kartlar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><Target className="h-4 w-4" /> Toplam Hedef</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold" style={{ color: NAVY }}>{data.genel.hedef}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Toplam Gerçekleşen</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold" style={{ color: NAVY }}>{data.genel.gerceklesen}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Genel Gerçekleşme</CardTitle></CardHeader>
              <CardContent>
                <p className="text-3xl font-bold" style={{ color: data.genel.yuzde != null ? perfColor(data.genel.yuzde) : NAVY }}>
                  {data.genel.yuzde != null ? `%${data.genel.yuzde}` : "—"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Bölüm bazında % bar (yatay) */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Bölüm Performansı (%)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 46)}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 24, right: 40, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, (max: number) => Math.max(120, Math.ceil(max / 10) * 10)]} tickFormatter={(v) => `%${v}`} />
                  <YAxis type="category" dataKey="ad" width={150} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => [`%${v}`, "Gerçekleşme"]} />
                  <ReferenceLine x={100} stroke="#16a34a" strokeDasharray="4 4" label={{ value: "Hedef %100", position: "top", fontSize: 11, fill: "#16a34a" }} />
                  <Bar dataKey="yuzde" radius={[0, 4, 4, 0]}>
                    {chartData.map((d, i) => <Cell key={i} fill={perfColor(d.yuzde)} />)}
                    <LabelList dataKey="yuzde" position="right" formatter={(v: number) => `%${v}`} fontSize={12} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Bölüm → kişi drill-down */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Bölüm Detayları</CardTitle></CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                {data.bolumler.map((b) => (
                  <AccordionItem key={b.ad} value={b.ad}>
                    <AccordionTrigger>
                      <div className="flex items-center justify-between w-full pr-4">
                        <span className="font-medium">{b.ad}</span>
                        <span className="flex items-center gap-3 text-sm">
                          <span className="text-muted-foreground">{b.gerceklesen}/{b.hedef}</span>
                          <Badge style={{ backgroundColor: perfColor(b.yuzde), color: "white" }}>%{b.yuzde}</Badge>
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Personel</TableHead>
                            <TableHead>Sicil</TableHead>
                            <TableHead className="text-right">Hedef</TableHead>
                            <TableHead className="text-right">Gerçekleşen</TableHead>
                            <TableHead className="text-right">%</TableHead>
                            <TableHead>Açıklama</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {b.kisiler.map((k, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{k.ad}</TableCell>
                              <TableCell className="font-mono text-xs">{k.sicil}</TableCell>
                              <TableCell className="text-right">{k.hedef}</TableCell>
                              <TableCell className="text-right">{k.gerceklesen}</TableCell>
                              <TableCell className="text-right font-semibold" style={{ color: perfColor(k.yuzde) }}>%{k.yuzde}</TableCell>
                              <TableCell className="text-muted-foreground">{k.not || "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
