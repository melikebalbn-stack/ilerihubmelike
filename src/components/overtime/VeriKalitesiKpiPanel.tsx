"use client"

// KPI Faz 2 (18.09.2026) — Mesai veri-kalitesi KPI sekmesi.
// Kaynak: GET /api/overtime/performans/kpi (kapı/kapsam performans ucuyla aynı).
// Kurallar (lib getVeriKalitesiKpi): hedef=0 sayılamayan iş HARİÇ, uretimYapar=false bölümler
// HARİÇ, pencere Temmuz 2026'dan başlar, performans = Σgerç/Σhedef (ağırlıklı; satır ortalaması yok).

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { Loader2, ClipboardCheck } from "lucide-react"
import { apiFetch } from "@/lib/api-fetch"

type BolumSatir = {
  bolum: string; satir: number; eksik: number; eksikPct: number; hesaplanan: number
  ustu100: number; ustu100Pct: number; ustu150: number; ustu150Pct: number
  hedefToplam: number; gercToplam: number; agirlikliPct: number | null
}
type Ay = Omit<BolumSatir, "bolum"> & { ay: string; form: number }
type KpiData = { from: string | null; to: string | null; haricBolumler: string[]; aylar: Ay[]; bolumler: BolumSatir[]; noAccess?: boolean }

const NAVY = "#1B4F72"
const AY_KISA = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"]
const ayEtiket = (ay: string) => { const [y, m] = ay.split("-"); return `${AY_KISA[Number(m) - 1]} ${y.slice(2)}` }
const fmt = (v: number | null | undefined) => (v == null ? "—" : `%${v.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`)

/** Renk eşiği: eksik oranı (düşük iyi). */
function eksikBadge(p: number) {
  const cls = p <= 10 ? "bg-green-100 text-green-800" : p <= 25 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"
  return <Badge className={cls}>{fmt(p)}</Badge>
}

function isoDaysAgo(n: number): string { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10) }

export default function VeriKalitesiKpiPanel() {
  const [from, setFrom] = useState("2026-07-01")
  const [to, setTo] = useState(isoDaysAgo(0))
  const [data, setData] = useState<KpiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true); setErr(null)
    apiFetch(`/api/overtime/performans/kpi?from=${from}&to=${to}`).then(async (res) => {
      if (!alive) return
      if (res.__authHandled) return
      if (!res.ok) { setErr(res.status === 403 ? "Bu rapor için yetkiniz yok." : "KPI verisi yüklenemedi."); setLoading(false); return }
      setData((await res.json()) as KpiData); setLoading(false)
    }).catch(() => { if (alive) { setErr("KPI verisi yüklenemedi."); setLoading(false) } })
    return () => { alive = false }
  }, [from, to])

  const trend = (data?.aylar ?? []).map((a) => ({ ay: ayEtiket(a.ay), "Eksik giriş %": a.eksikPct, ">%100 %": a.ustu100Pct, "Performans %": a.agirlikliPct ?? 0 }))
  const son = data?.aylar.length ? data.aylar[data.aylar.length - 1] : null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2 text-sm font-medium" style={{ color: NAVY }}><ClipboardCheck className="h-4 w-4" /> Veri Kalitesi KPI</div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Başlangıç</span>
          <Input type="date" min="2026-07-01" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} className="w-40" />
          <span className="text-muted-foreground">Bitiş</span>
          <Input type="date" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} className="w-40" />
        </div>
        {data?.haricBolumler.length ? (
          <div className="text-xs text-muted-foreground">Üretim dışı (hariç): {data.haricBolumler.join(", ")}</div>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : err ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">{err}</CardContent></Card>
      ) : !data || data.noAccess ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">Bu rapor için yetkili olduğunuz bir bölüm bulunmuyor.</CardContent></Card>
      ) : (
        <>
          {/* Son ay özet kartları */}
          {son && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { t: `Eksik giriş (${ayEtiket(son.ay)})`, v: fmt(son.eksikPct), s: `${son.eksik} / ${son.satir} satır` },
                { t: "> %100 oranı", v: fmt(son.ustu100Pct), s: `${son.ustu100} / ${son.hesaplanan} hesaplanan` },
                { t: "> %150 oranı", v: fmt(son.ustu150Pct), s: `${son.ustu150} satır` },
                { t: "Ağırlıklı performans", v: fmt(son.agirlikliPct), s: `${son.gercToplam.toLocaleString("tr-TR")} / ${son.hedefToplam.toLocaleString("tr-TR")} adet` },
              ].map((k) => (
                <Card key={k.t}><CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">{k.t}</div>
                  <div className="text-2xl font-bold" style={{ color: NAVY }}>{k.v}</div>
                  <div className="text-xs text-muted-foreground">{k.s}</div>
                </CardContent></Card>
              ))}
            </div>
          )}

          {/* Aylık trend */}
          <Card>
            <CardHeader><CardTitle className="text-base">Aylık trend</CardTitle></CardHeader>
            <CardContent>
              {trend.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm">Seçilen aralıkta KPI'ya giren satır yok.</div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="ay" fontSize={12} />
                      <YAxis fontSize={12} unit="%" />
                      <Tooltip formatter={(v: number) => fmt(v)} />
                      <Legend />
                      <Line type="monotone" dataKey="Eksik giriş %" stroke="#dc2626" strokeWidth={2} dot />
                      <Line type="monotone" dataKey=">%100 %" stroke="#d97706" strokeWidth={2} dot />
                      <Line type="monotone" dataKey="Performans %" stroke={NAVY} strokeWidth={2} dot />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              {data.aylar.length > 0 && (
                <div className="overflow-x-auto mt-4">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Ay</TableHead><TableHead className="text-right">Form</TableHead><TableHead className="text-right">Satır</TableHead>
                      <TableHead className="text-right">Eksik</TableHead><TableHead className="text-right">Eksik %</TableHead>
                      <TableHead className="text-right">&gt;%100</TableHead><TableHead className="text-right">&gt;%150</TableHead><TableHead className="text-right">Performans</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {data.aylar.map((a) => (
                        <TableRow key={a.ay}>
                          <TableCell className="font-medium">{ayEtiket(a.ay)}</TableCell>
                          <TableCell className="text-right">{a.form}</TableCell><TableCell className="text-right">{a.satir}</TableCell>
                          <TableCell className="text-right">{a.eksik}</TableCell><TableCell className="text-right">{eksikBadge(a.eksikPct)}</TableCell>
                          <TableCell className="text-right">{fmt(a.ustu100Pct)}</TableCell><TableCell className="text-right">{fmt(a.ustu150Pct)}</TableCell>
                          <TableCell className="text-right font-medium">{fmt(a.agirlikliPct)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bölüm tablosu — en kötüden iyiye */}
          <Card>
            <CardHeader><CardTitle className="text-base">Bölüm kırılımı (en kötüden iyiye — eksik giriş oranı)</CardTitle></CardHeader>
            <CardContent>
              {data.bolumler.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm">Bölüm verisi yok.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>#</TableHead><TableHead>Bölüm</TableHead><TableHead className="text-right">Satır</TableHead>
                      <TableHead className="text-right">Eksik</TableHead><TableHead className="text-right">Eksik %</TableHead>
                      <TableHead className="text-right">&gt;%100</TableHead><TableHead className="text-right">&gt;%150</TableHead>
                      <TableHead className="text-right">Σ gerç / Σ hedef</TableHead><TableHead className="text-right">Performans</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {data.bolumler.map((b, i) => (
                        <TableRow key={b.bolum}>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-medium">{b.bolum}</TableCell>
                          <TableCell className="text-right">{b.satir}</TableCell>
                          <TableCell className="text-right">{b.eksik}</TableCell>
                          <TableCell className="text-right">{eksikBadge(b.eksikPct)}</TableCell>
                          <TableCell className="text-right">{fmt(b.ustu100Pct)} <span className="text-muted-foreground text-xs">({b.ustu100})</span></TableCell>
                          <TableCell className="text-right">{fmt(b.ustu150Pct)} <span className="text-muted-foreground text-xs">({b.ustu150})</span></TableCell>
                          <TableCell className="text-right text-muted-foreground">{b.gercToplam.toLocaleString("tr-TR")} / {b.hedefToplam.toLocaleString("tr-TR")}</TableCell>
                          <TableCell className="text-right font-medium">{fmt(b.agirlikliPct)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-3">
                Kurallar: yalnız APPROVED mesai formları; hedef 0 (sayılamayan iş) ve üretim dışı bölümler hariç; eksik = gerçekleşen girilmemiş satır;
                &gt;%100 / &gt;%150 hesaplanan satırlar üzerinden; performans = Σgerçekleşen / Σhedef (ağırlıklı). Pencere Temmuz 2026'dan başlar.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
