"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine, LabelList,
} from "recharts"
import {
  BarChart3, Target, Loader2, Calendar as CalIcon, CalendarRange, CalendarDays,
  Recycle, AlertTriangle, TrendingUp,
} from "lucide-react"
import { apiFetch } from "@/lib/api-fetch"

const NAVY = "#1B4F72"

// ── Tipler (Faz 3a endpoint şekilleri) ──
type Genel = { hedef: number; gerceklesen: number; yuzde: number | null }
type Kisi = { ad: string; sicil: string; hedef: number; gerceklesen: number; yuzde: number; not: string | null }
type Bolum = { ad: string; hedef: number; gerceklesen: number; yuzde: number; kisiler: Kisi[] }
type VardiyaAyri = { formSayisi: number; aciklama: string }
type PerfData = { genel: Genel; bolumler: Bolum[]; noAccess?: boolean; vardiyaHaftaAyri?: VardiyaAyri }
type MissingData = {
  eksikler: { bolum: string; sayi: number; personeller: { ad: string; sicil: string; formNo: string; eksik: string }[] }[]
  hijyenUyarilari: { bolum: string; ad: string; sicil: string; formNo: string; hedefAdet: number }[]
  noAccess?: boolean
}
type ScrapData = {
  toplamHurda: number; toplamGerceklesen: number; oran: number | null
  bolumler: { bolum: string; hurda: number; gerceklesen: number; oran: number | null }[]
  noAccess?: boolean
}
type TrendPoint = { label: string; yuzde: number | null }
type Mode = "day" | "week" | "month"

// ── Mesai performans eşiği (KORUNDU): <70 kırmızı, 70-89 sarı, ≥90 yeşil ──
function perfColor(yuzde: number): string {
  if (yuzde < 70) return "#dc2626"
  if (yuzde < 90) return "#f59e0b"
  return "#16a34a"
}
// Renk körlüğü yedeği: ok işareti
function perfArrow(yuzde: number): string {
  if (yuzde < 70) return "↓"
  if (yuzde < 90) return "→"
  return "↑"
}

// ── Türkçe tarih yardımcıları ──
const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
const DAY_MS = 86400000
const iso = (d: Date) => d.toISOString().slice(0, 10)
function mondayOf(d: Date): Date {
  const dow = d.getUTCDay()
  const back = (dow + 6) % 7
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back))
}
function isoWeekNo(d: Date): number {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = (t.getUTCDay() + 6) % 7
  t.setUTCDate(t.getUTCDate() - day + 3)
  const firstThu = new Date(Date.UTC(t.getUTCFullYear(), 0, 4))
  return 1 + Math.round(((t.getTime() - firstThu.getTime()) / DAY_MS - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7)
}
/** "20. Hafta (12-16 Mayıs)" — aynı aysa ay bir kez, farklıysa iki kez. */
function weekLabel(monday: Date): string {
  const fri = new Date(monday.getTime() + 4 * DAY_MS)
  const wn = isoWeekNo(monday)
  const sameMonth = monday.getUTCMonth() === fri.getUTCMonth()
  const aralik = sameMonth
    ? `${monday.getUTCDate()}-${fri.getUTCDate()} ${AYLAR[fri.getUTCMonth()]}`
    : `${monday.getUTCDate()} ${AYLAR[monday.getUTCMonth()]} - ${fri.getUTCDate()} ${AYLAR[fri.getUTCMonth()]}`
  return `${wn}. Hafta (${aralik})`
}

// Liste kaynağı: 2026 Haziran'dan bugüne (öncesi veri yok). Client-side "bugün".
const LISTE_BASLANGIC = Date.UTC(2026, 5, 1) // 2026-06-01
function buildWeekOptions(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = []
  let m = mondayOf(new Date(LISTE_BASLANGIC))
  const thisMonday = mondayOf(new Date())
  while (m.getTime() <= thisMonday.getTime()) {
    out.push({ value: iso(m), label: weekLabel(m) })
    m = new Date(m.getTime() + 7 * DAY_MS)
  }
  return out.reverse() // en yeni üstte
}
function buildMonthOptions(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = []
  const now = new Date()
  let y = 2026, mo = 5 // Haziran (0-index)
  while (y < now.getUTCFullYear() || (y === now.getUTCFullYear() && mo <= now.getUTCMonth())) {
    out.push({ value: `${y}-${mo + 1}`, label: `${y} ${AYLAR[mo]}` })
    mo++; if (mo > 11) { mo = 0; y++ }
  }
  return out.reverse()
}

async function fetchJson<T>(url: string): Promise<T | { __err: number }> {
  const res = await apiFetch(url)
  if (res.__authHandled) return { __err: 401 }
  if (!res.ok) return { __err: res.status }
  return (await res.json()) as T
}

export default function OvertimePerformancePage() {
  const [mode, setMode] = useState<Mode>("day")
  const [dayDate, setDayDate] = useState("")
  const [weekStart, setWeekStart] = useState("")
  const [monthSel, setMonthSel] = useState("") // "YYYY-M"
  const [weekOptions] = useState(buildWeekOptions)
  const [monthOptions] = useState(buildMonthOptions)

  const [perf, setPerf] = useState<PerfData | null>(null)
  const [missing, setMissing] = useState<MissingData | null>(null)
  const [scrap, setScrap] = useState<ScrapData | null>(null)
  const [trend, setTrend] = useState<TrendPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)

  // Seçili moda göre [from,to] aralığı (missing-data + scrap panelleri). Yeni mod eklenince
  // buraya bir case + bir seçici + fetch fonksiyonu eklenir (mod deseni genişletilebilir).
  const rangeFor = (m: Mode, day: string, wk: string, mon: string): { from: string; to: string } => {
    if (m === "week") {
      const mo = new Date(`${wk}T00:00:00Z`)
      return { from: iso(mo), to: iso(new Date(mo.getTime() + 4 * DAY_MS)) }
    }
    if (m === "month") {
      const [y, mm] = mon.split("-").map(Number)
      return { from: iso(new Date(Date.UTC(y, mm - 1, 1))), to: iso(new Date(Date.UTC(y, mm, 0))) }
    }
    return { from: day, to: day }
  }

  const applyPanels = async (from: string, to: string): Promise<boolean> => {
    const [ms, sc] = await Promise.all([
      fetchJson<MissingData>(`/api/overtime/performans/missing-data?from=${from}&to=${to}`),
      fetchJson<ScrapData>(`/api/overtime/performans/scrap?from=${from}&to=${to}`),
    ])
    if ("__err" in ms || "__err" in sc) {
      if ((ms as { __err?: number }).__err === 403 || (sc as { __err?: number }).__err === 403) setForbidden(true)
      return false
    }
    setMissing(ms); setScrap(sc); return true
  }

  const loadDay = useCallback(async (date: string | null) => {
    setLoading(true)
    // İlk açılışta date bilinmiyor (route latest-approved döndürür) → perf'i önce çöz.
    // Date verilmişse perf + paneller PARALEL.
    if (date) {
      const [perfRes] = await Promise.all([
        fetchJson<PerfData & { date: string }>(`/api/overtime/performans?date=${date}`),
        applyPanels(date, date),
      ])
      if ("__err" in perfRes) { if (perfRes.__err === 403) setForbidden(true); setLoading(false); return }
      setPerf(perfRes); setDayDate(perfRes.date); setTrend([])
    } else {
      const perfRes = await fetchJson<PerfData & { date: string }>("/api/overtime/performans")
      if ("__err" in perfRes) { if (perfRes.__err === 403) setForbidden(true); setLoading(false); return }
      setPerf(perfRes); setDayDate(perfRes.date); setTrend([])
      await applyPanels(perfRes.date, perfRes.date)
    }
    setLoading(false)
  }, [])

  const loadWeek = useCallback(async (wk: string) => {
    setLoading(true)
    const mo = new Date(`${wk}T00:00:00Z`)
    const fri = new Date(mo.getTime() + 4 * DAY_MS)
    const trendFrom = iso(new Date(mo.getTime() - 7 * 7 * DAY_MS)) // 8 hafta
    const { from, to } = rangeFor("week", "", wk, "")
    // PARALEL: haftalık(trend+detay) + missing + scrap
    const [wRes] = await Promise.all([
      fetchJson<{ haftalar: { weekStart: string; weekEnd: string; genel: Genel; bolumler: Bolum[]; vardiyaHaftaAyri?: VardiyaAyri }[]; noAccess?: boolean }>(
        `/api/overtime/performans/weekly?from=${trendFrom}&to=${iso(fri)}`),
      applyPanels(from, to),
    ])
    if ("__err" in wRes) { if (wRes.__err === 403) setForbidden(true); setLoading(false); return }
    const haftalar = wRes.haftalar ?? []
    const sel = haftalar.find((h) => h.weekStart === iso(mo)) ?? haftalar[haftalar.length - 1]
    setPerf(sel
      ? { genel: sel.genel, bolumler: sel.bolumler, vardiyaHaftaAyri: sel.vardiyaHaftaAyri, noAccess: wRes.noAccess }
      : { genel: { hedef: 0, gerceklesen: 0, yuzde: null }, bolumler: [], noAccess: wRes.noAccess })
    setTrend(haftalar.map((h) => ({ label: `${isoWeekNo(new Date(`${h.weekStart}T00:00:00Z`))}. Hf`, yuzde: h.genel.yuzde })))
    setLoading(false)
  }, [])

  const loadMonth = useCallback(async (mon: string) => {
    setLoading(true)
    const [y, mm] = mon.split("-").map(Number)
    const { from, to } = rangeFor("month", "", "", mon)
    // PARALEL: aylık detay + aylık trend + missing + scrap
    const [detay, trendRes] = await Promise.all([
      fetchJson<PerfData>(`/api/overtime/performans/monthly?year=${y}&month=${mm}`),
      fetchJson<{ year: number; aylar: { month: number; genel: Genel }[]; noAccess?: boolean }>(`/api/overtime/performans/monthly?year=${y}`),
      applyPanels(from, to),
    ])
    if ("__err" in detay) { if (detay.__err === 403) setForbidden(true); setLoading(false); return }
    setPerf(detay)
    setTrend("__err" in trendRes ? [] : (trendRes.aylar ?? []).map((a) => ({ label: AYLAR[a.month - 1].slice(0, 3), yuzde: a.genel.yuzde })))
    setLoading(false)
  }, [])

  // Açılış: GÜN modu, en son veri günü (route latest-approved döndürür).
  useEffect(() => { loadDay(null) }, [loadDay])

  if (forbidden) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <BarChart3 className="h-14 w-14 text-red-400 mb-4" />
        <h2 className="text-xl font-bold text-red-600 mb-1">Erişim Reddedildi (403)</h2>
        <p className="text-muted-foreground">Mesai performans raporunu görüntüleme yetkiniz yok.</p>
      </div>
    )
  }

  const noAccess = perf?.noAccess
  const bolumler = perf?.bolumler ?? []
  // Bullet: EN KÖTÜ ÜSTTE → recharts vertical'da data[0] ALTTA olduğundan yüzde AZALAN sırala.
  const bulletData = [...bolumler].sort((a, b) => b.yuzde - a.yuzde)
  const maxHedef = Math.max(1, ...bolumler.map((b) => b.hedef))
  // Accordion: worst-first liste (aksiyon önceliği)
  const accordionData = [...bolumler].sort((a, b) => a.yuzde - b.yuzde)

  const active = (m: Mode) => mode === m
  const selCls = (m: Mode) => `transition ${active(m) ? "" : "opacity-55"}`

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart3 className="h-7 w-7" style={{ color: NAVY }} />
        <h1 className="text-2xl font-bold" style={{ color: NAVY }}>Mesai Üretim Performansı</h1>
      </div>

      {/* ── 1) ÜÇ SEÇİCİ (yan yana; aktif vurgulu, pasifler soluk) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* GÜN */}
        <Card className={selCls("day")} style={active("day") ? { boxShadow: `0 0 0 2px ${NAVY}` } : undefined}>
          <CardContent className="p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-medium" style={{ color: active("day") ? NAVY : undefined }}>
              <CalIcon className="h-4 w-4" /> Gün
            </div>
            <Input type="date" value={dayDate} onChange={(e) => { setMode("day"); setDayDate(e.target.value); if (e.target.value) loadDay(e.target.value) }} className="w-full" />
          </CardContent>
        </Card>
        {/* HAFTA */}
        <Card className={selCls("week")} style={active("week") ? { boxShadow: `0 0 0 2px ${NAVY}` } : undefined}>
          <CardContent className="p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-medium" style={{ color: active("week") ? NAVY : undefined }}>
              <CalendarRange className="h-4 w-4" /> Hafta
            </div>
            <Select value={weekStart} onValueChange={(v) => { setMode("week"); setWeekStart(v); loadWeek(v) }}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Hafta seç" /></SelectTrigger>
              <SelectContent>{weekOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </CardContent>
        </Card>
        {/* AY */}
        <Card className={selCls("month")} style={active("month") ? { boxShadow: `0 0 0 2px ${NAVY}` } : undefined}>
          <CardContent className="p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-medium" style={{ color: active("month") ? NAVY : undefined }}>
              <CalendarDays className="h-4 w-4" /> Ay
            </div>
            <Select value={monthSel} onValueChange={(v) => { setMode("month"); setMonthSel(v); loadMonth(v) }}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Ay seç" /></SelectTrigger>
              <SelectContent>{monthOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : noAccess ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">Bu rapor için yetkili olduğunuz bir bölüm bulunmuyor.</CardContent></Card>
      ) : (
        <>
          {/* ── 2) KPI kartları (3 mevcut + Hurda) ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Kpi title="Toplam Hedef" value={perf ? String(perf.genel.hedef) : "—"} icon={<Target className="h-4 w-4" />} />
            <Kpi title="Toplam Gerçekleşen" value={perf ? String(perf.genel.gerceklesen) : "—"} />
            <Kpi title="Genel Gerçekleşme" value={perf?.genel.yuzde != null ? `%${perf.genel.yuzde}` : "—"}
              color={perf?.genel.yuzde != null ? perfColor(perf.genel.yuzde) : NAVY} />
            {/* Hurda: veri az/0 olabilir → "veri bekleniyor" durumu */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><Recycle className="h-4 w-4" /> Hurda</CardTitle></CardHeader>
              <CardContent>
                {scrap && scrap.toplamHurda > 0 ? (
                  <>
                    <p className="text-3xl font-bold" style={{ color: NAVY }}>{scrap.toplamHurda}</p>
                    <p className="text-xs text-muted-foreground">{scrap.oran != null ? `Oran %${scrap.oran}` : "oran yok"}</p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground italic pt-2">Veri bekleniyor</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Günlük görünümde vardiya-hafta ayrı notu */}
          {mode === "day" && perf?.vardiyaHaftaAyri && (
            <div className="flex items-start gap-2 text-sm rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> {perf.vardiyaHaftaAyri.aciklama}
            </div>
          )}

          {/* ── 3) TREND — SADECE hafta/ay modunda ── */}
          {mode !== "day" && trend.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="h-5 w-5" style={{ color: NAVY }} /> {mode === "week" ? "Haftalık Trend" : "Aylık Trend"} (%)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={trend} margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, (max: number) => Math.max(120, Math.ceil(max / 10) * 10)]} tickFormatter={(v) => `%${v}`} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => [`%${v}`, "Gerçekleşme"]} />
                    <ReferenceLine y={100} stroke="#16a34a" strokeDasharray="4 4" label={{ value: "Hedef %100", position: "right", fontSize: 11, fill: "#16a34a" }} />
                    <Line type="monotone" dataKey="yuzde" stroke={NAVY} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* ── 4) BULLET — bölüm performansı (kalın gri = HEDEF track, ince renkli = GERÇEKLEŞEN) ── */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Bölüm Performansı</CardTitle></CardHeader>
            <CardContent>
              {bulletData.length === 0 ? (
                <p className="py-10 text-center text-muted-foreground">Bu dönem için onaylı mesai performans verisi yok.</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(220, bulletData.length * 46)}>
                  <BarChart data={bulletData} layout="vertical" barGap={-14} barCategoryGap="28%" margin={{ left: 16, right: 68, top: 8, bottom: 8 }}>
                    <XAxis type="number" domain={[0, maxHedef * 1.1]} hide />
                    <YAxis type="category" dataKey="ad" width={150} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number, n: string) => [v, n === "hedef" ? "Hedef" : "Gerçekleşen"]} />
                    {/* Kalın gri = HEDEF (track) */}
                    <Bar dataKey="hedef" barSize={18} fill="#cbd5e1" radius={[0, 3, 3, 0]} isAnimationActive={false} />
                    {/* İnce renkli = GERÇEKLEŞEN (eşik rengi) + % ve ok işareti (renk körlüğü yedeği) */}
                    <Bar dataKey="gerceklesen" barSize={9} radius={[0, 3, 3, 0]} isAnimationActive={false}>
                      {bulletData.map((d, i) => <Cell key={i} fill={perfColor(d.yuzde)} />)}
                      <LabelList dataKey="yuzde" position="right" formatter={(v: number) => `%${v} ${perfArrow(v)}`} fontSize={12} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* ── 5) EKSİK-VERİ paneli (aksiyonel: kim girmemiş) ── */}
          <Card>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600" /> Eksik Veri & Hijyen</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-1.5">Eksik girilen üretim satırları (Bakımhane hariç)</p>
                {!missing || missing.eksikler.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Bu dönemde eksik veri yok. 🎉</p>
                ) : (
                  <Accordion type="multiple" className="w-full">
                    {missing.eksikler.map((e) => (
                      <AccordionItem key={e.bolum} value={`eksik-${e.bolum}`}>
                        <AccordionTrigger>
                          <span className="flex items-center justify-between w-full pr-3">
                            <span className="font-medium">{e.bolum}</span>
                            <Badge variant="destructive">{e.sayi} eksik satır</Badge>
                          </span>
                        </AccordionTrigger>
                        <AccordionContent>
                          <ul className="text-sm space-y-1">
                            {e.personeller.map((p, i) => (
                              <li key={i} className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{p.ad}</span>
                                <span className="font-mono text-xs text-muted-foreground">{p.sicil}</span>
                                <Badge variant="outline" className="text-xs">{p.eksik === "ikisi" ? "hedef+gerçekleşen" : p.eksik} eksik</Badge>
                                <span className="text-xs text-muted-foreground">{p.formNo}</span>
                              </li>
                            ))}
                          </ul>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </div>
              {missing && missing.hijyenUyarilari.length > 0 && (
                <div className="rounded-md border border-orange-200 bg-orange-50 p-3">
                  <p className="text-sm font-medium text-orange-800 mb-1.5 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> Üretim yapmayan bölüme hedef girilmiş ({missing.hijyenUyarilari.length})
                  </p>
                  <ul className="text-xs text-orange-900 space-y-0.5">
                    {missing.hijyenUyarilari.map((h, i) => (
                      <li key={i}>{h.bolum} · {h.ad} ({h.sicil}) — hedef: {h.hedefAdet} · {h.formNo}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── 6) DRILL-DOWN accordion (bölüm → personel kırılımı) ── */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Bölüm Detayları (personel kırılımı)</CardTitle></CardHeader>
            <CardContent>
              {accordionData.length === 0 ? (
                <p className="py-6 text-center text-muted-foreground">Veri yok.</p>
              ) : (
                <Accordion type="multiple" className="w-full">
                  {accordionData.map((b) => (
                    <AccordionItem key={b.ad} value={b.ad}>
                      <AccordionTrigger>
                        <div className="flex items-center justify-between w-full pr-4">
                          <span className="font-medium">{b.ad}</span>
                          <span className="flex items-center gap-3 text-sm">
                            <span className="text-muted-foreground">{b.gerceklesen}/{b.hedef}</span>
                            <Badge style={{ backgroundColor: perfColor(b.yuzde), color: "white" }}>%{b.yuzde} {perfArrow(b.yuzde)}</Badge>
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Personel</TableHead><TableHead>Sicil</TableHead>
                              <TableHead className="text-right">Hedef</TableHead><TableHead className="text-right">Gerçekleşen</TableHead>
                              <TableHead className="text-right">%</TableHead><TableHead>Açıklama</TableHead>
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
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function Kpi({ title, value, icon, color }: { title: string; value: string; icon?: React.ReactNode; color?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2">{icon}{title}</CardTitle></CardHeader>
      <CardContent><p className="text-3xl font-bold" style={{ color: color ?? NAVY }}>{value}</p></CardContent>
    </Card>
  )
}
