"use client"

// KPI Faz 2 (18.09.2026) — Mesai veri-kalitesi KPI sekmesi. 20.09.2026 düzen: bölüm
// tablosu en üstte (eksik oranı çubuğu + tıklanınca eksik satır detayı), 3 özet kartı
// seçili aralığın TAMAMINI gösterir (ay tablosuyla tutarlı), aylık trend kompakt tablo.
// Kaynak: GET /api/overtime/performans/kpi (+ /kpi/eksik bölüm detayı); kapı/kapsam
// performans ucuyla aynı. Kurallar (lib getVeriKalitesiKpi): hedef=0 sayılamayan iş HARİÇ,
// uretimYapar=false bölümler HARİÇ, pencere Temmuz 2026'dan başlar, performans =
// Σgerç/Σhedef (ağırlıklı; satır ortalaması yok).

import { Fragment, useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, ClipboardCheck, ChevronDown, ChevronRight } from "lucide-react"
import { apiFetch } from "@/lib/api-fetch"

type BolumSatir = {
  bolum: string; satir: number; eksik: number; eksikPct: number; hesaplanan: number
  ustu100: number; ustu100Pct: number; ustu150: number; ustu150Pct: number
  hedefToplam: number; gercToplam: number; agirlikliPct: number | null
}
type Ay = Omit<BolumSatir, "bolum"> & { ay: string; form: number }
type KpiData = { from: string | null; to: string | null; haricBolumler: string[]; toplam?: Ay; aylar: Ay[]; bolumler: BolumSatir[]; noAccess?: boolean }
type EksikSatir = { formId: string; formNo: string; tarih: string; personel: string; sicil: string; parcaKodu: string; hedefAdet: number }
type SupheliSatir = EksikSatir & { gerceklesenAdet: number; yuzde: number }
type DetayTip = "eksik" | "supheli"

const NAVY = "#1B4F72"
const AY_KISA = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"]
const ayEtiket = (ay: string) => { const [y, m] = ay.split("-"); return `${AY_KISA[Number(m) - 1]} ${y.slice(2)}` }
const n = (v: number) => v.toLocaleString("tr-TR")
const pct = (v: number | null | undefined) => (v == null ? "—" : `%${v.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`)
const tarihTR = (iso: string) => { const [y, m, d] = iso.split("-"); return `${d}.${m}.${y}` }

/** Eksik oranı rengi: >=20 kırmızı, 10–20 amber, <10 yeşil. */
const eksikRenk = (p: number) => (p >= 20 ? "#dc2626" : p >= 10 ? "#d97706" : "#16a34a")
/** Çubuk skalası 0–30 (%25 → %83 dolu). */
const BAR_MAX = 30
function EksikCubuk({ p }: { p: number }) {
  const w = Math.min(100, Math.round((p / BAR_MAX) * 100))
  return (
    <div className="h-2.5 w-full min-w-[80px] rounded bg-gray-200" title={pct(p)}>
      <div className="h-2.5 rounded" style={{ width: `${w}%`, backgroundColor: eksikRenk(p) }} />
    </div>
  )
}
function PerfHucre({ v }: { v: number | null }) {
  const amber = v != null && v > 100
  return <span className={amber ? "font-medium text-amber-600" : "font-medium"}>{pct(v)}</span>
}

function isoToday(): string { return new Date().toISOString().slice(0, 10) }

export default function VeriKalitesiKpiPanel() {
  const [from, setFrom] = useState("2026-07-01")
  const [to, setTo] = useState(isoToday())
  const [data, setData] = useState<KpiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  // Bölüm detayı — açık paneller (bolum:tip) + satırları (anahtar → satırlar; null = yükleniyor).
  // Eksik ve şüpheli paneller AYRI açılır/kapanır (20.09.2026).
  const [acik, setAcik] = useState<Set<string>>(new Set())
  const [detay, setDetay] = useState<Record<string, (EksikSatir | SupheliSatir)[] | null>>({})
  const anahtar = (bolum: string, tip: DetayTip) => `${tip}:${bolum}`

  useEffect(() => {
    let alive = true
    setLoading(true); setErr(null); setAcik(new Set()); setDetay({})
    apiFetch(`/api/overtime/performans/kpi?from=${from}&to=${to}`).then(async (res) => {
      if (!alive) return
      if (res.__authHandled) return
      if (!res.ok) { setErr(res.status === 403 ? "Bu rapor için yetkiniz yok." : "KPI verisi yüklenemedi."); setLoading(false); return }
      setData((await res.json()) as KpiData); setLoading(false)
    }).catch(() => { if (alive) { setErr("KPI verisi yüklenemedi."); setLoading(false) } })
    return () => { alive = false }
  }, [from, to])

  async function toggleDetay(bolum: string, tip: DetayTip) {
    const k = anahtar(bolum, tip)
    if (acik.has(k)) { setAcik((s) => { const n = new Set(s); n.delete(k); return n }); return }
    setAcik((s) => new Set(s).add(k))
    if (detay[k] !== undefined) return
    setDetay((d) => ({ ...d, [k]: null }))
    try {
      const res = await apiFetch(`/api/overtime/performans/kpi/${tip}?bolum=${encodeURIComponent(bolum)}&from=${from}&to=${to}`)
      if (res.__authHandled) return
      const body = res.ok ? ((await res.json()) as { satirlar: (EksikSatir | SupheliSatir)[] }) : { satirlar: [] }
      setDetay((d) => ({ ...d, [k]: body.satirlar }))
    } catch {
      setDetay((d) => ({ ...d, [k]: [] }))
    }
  }

  // Kartlar: seçili aralığın TAMAMI (toplam). Eski API (toplam yok) → aylardan türet.
  const t: Ay | null = data?.toplam ?? (data?.aylar.length ? data.aylar.reduce((a, b) => ({
    ay: "", form: a.form + b.form, satir: a.satir + b.satir, eksik: a.eksik + b.eksik, eksikPct: 0, hesaplanan: a.hesaplanan + b.hesaplanan,
    ustu100: a.ustu100 + b.ustu100, ustu100Pct: 0, ustu150: a.ustu150 + b.ustu150, ustu150Pct: 0,
    hedefToplam: a.hedefToplam + b.hedefToplam, gercToplam: a.gercToplam + b.gercToplam, agirlikliPct: null,
  })) : null)
  const eksikPctT = t && t.satir > 0 ? Math.round((t.eksik / t.satir) * 1000) / 10 : 0
  const ustu100PctT = t && t.hesaplanan > 0 ? Math.round((t.ustu100 / t.hesaplanan) * 1000) / 10 : 0
  const perfT = t && t.hedefToplam > 0 ? Math.round((t.gercToplam / t.hedefToplam) * 1000) / 10 : null

  return (
    <div className="space-y-6">
      {/* Filtre satırı + sağda üretim dışı listesi */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-medium" style={{ color: NAVY }}><ClipboardCheck className="h-4 w-4" /> Veri Kalitesi KPI</div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Başlangıç</span>
            <Input type="date" min="2026-07-01" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} className="w-40" />
            <span className="text-muted-foreground">Bitiş</span>
            <Input type="date" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} className="w-40" />
          </div>
        </div>
        {data?.haricBolumler.length ? (
          <div className="text-[11px] text-muted-foreground max-w-xl text-right">Üretim dışı (hariç): {data.haricBolumler.join(", ")}</div>
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
          {/* 1) Bölüm tablosu — en üstte */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-base font-semibold" style={{ color: NAVY }}>Hangi bölüm ne kadar eksik giriyor?</h3>
              {data.bolumler.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm">Seçilen aralıkta KPI'ya giren satır yok.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="w-8">#</TableHead><TableHead>Bölüm</TableHead><TableHead className="text-right">Satır</TableHead>
                      <TableHead className="text-right">Eksik</TableHead><TableHead className="w-44">Eksik oranı</TableHead><TableHead className="text-right">Eksik %</TableHead>
                      <TableHead className="text-right">Şüpheli (&gt;%100)</TableHead><TableHead className="text-right">Performans</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {data.bolumler.map((b, i) => {
                        const kE = anahtar(b.bolum, "eksik"), kS = anahtar(b.bolum, "supheli")
                        const eksikAcik = acik.has(kE), supheliAcik = acik.has(kS)
                        const rowsE = detay[kE] as EksikSatir[] | null | undefined
                        const rowsS = detay[kS] as SupheliSatir[] | null | undefined
                        return (
                          <Fragment key={b.bolum}>
                            <TableRow className="hover:bg-muted/50">
                              <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                              {/* Bölüm adı → eksik satırlar */}
                              <TableCell className="font-medium cursor-pointer" onClick={() => toggleDetay(b.bolum, "eksik")} aria-expanded={eksikAcik} title="Eksik satırları göster/gizle">
                                <span className="inline-flex items-center gap-1">
                                  {eksikAcik ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                                  {b.bolum}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">{n(b.satir)}</TableCell>
                              <TableCell className="text-right">{n(b.eksik)}</TableCell>
                              <TableCell><EksikCubuk p={b.eksikPct} /></TableCell>
                              <TableCell className="text-right font-medium" style={{ color: eksikRenk(b.eksikPct) }}>{pct(b.eksikPct)}</TableCell>
                              {/* Şüpheli hücresi → >%100 satırlar (ayrı panel) */}
                              <TableCell className={`text-right whitespace-nowrap ${b.ustu100 > 0 ? "cursor-pointer underline decoration-dotted underline-offset-4" : ""}`}
                                onClick={() => b.ustu100 > 0 && toggleDetay(b.bolum, "supheli")} aria-expanded={supheliAcik} title={b.ustu100 > 0 ? "Şüpheli satırları göster/gizle" : undefined}>
                                {n(b.ustu100)} satır{b.ustu150 > 0 ? ` (${n(b.ustu150)} ağır)` : ""}
                              </TableCell>
                              <TableCell className="text-right"><PerfHucre v={b.agirlikliPct} /></TableCell>
                            </TableRow>
                            {eksikAcik && (
                              <TableRow className="bg-muted/30 hover:bg-muted/30">
                                <TableCell colSpan={8} className="p-0">
                                  <div className="px-6 py-3">
                                    {rowsE === null || rowsE === undefined ? (
                                      <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Eksik satırlar yükleniyor…</div>
                                    ) : rowsE.length === 0 ? (
                                      <div className="text-sm text-muted-foreground">Bu bölümde eksik giriş yok.</div>
                                    ) : (
                                      <>
                                        <div className="text-xs text-muted-foreground mb-2">{b.bolum} — gerçekleşen adedi girilmemiş {n(rowsE.length)} satır</div>
                                        <Table>
                                          <TableHeader><TableRow>
                                            <TableHead>Form No</TableHead><TableHead>Tarih</TableHead><TableHead>Personel</TableHead><TableHead>Parça Kodu</TableHead><TableHead className="text-right">Hedef Adet</TableHead>
                                          </TableRow></TableHeader>
                                          <TableBody>
                                            {rowsE.map((r, k) => (
                                              <TableRow key={`${r.formId}-${k}`}>
                                                <TableCell><a href={`/forms/overtime/${r.formId}`} className="underline underline-offset-2" style={{ color: NAVY }}>{r.formNo}</a></TableCell>
                                                <TableCell>{tarihTR(r.tarih)}</TableCell>
                                                <TableCell>{r.personel} <span className="text-muted-foreground text-xs">{r.sicil}</span></TableCell>
                                                <TableCell>{r.parcaKodu}</TableCell>
                                                <TableCell className="text-right">{n(r.hedefAdet)}</TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                            {supheliAcik && (
                              <TableRow className="bg-amber-50/60 hover:bg-amber-50/60">
                                <TableCell colSpan={8} className="p-0">
                                  <div className="px-6 py-3">
                                    {rowsS === null || rowsS === undefined ? (
                                      <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Şüpheli satırlar yükleniyor…</div>
                                    ) : rowsS.length === 0 ? (
                                      <div className="text-sm text-muted-foreground">Bu bölümde %100 üstü satır yok.</div>
                                    ) : (
                                      <>
                                        <div className="text-xs text-muted-foreground mb-2">{b.bolum} — gerçekleşen &gt; hedef olan {n(rowsS.length)} satır (yüzdeye göre azalan; &gt;%150 kırmızı)</div>
                                        <Table>
                                          <TableHeader><TableRow>
                                            <TableHead>Form No</TableHead><TableHead>Tarih</TableHead><TableHead>Personel</TableHead><TableHead>Parça Kodu</TableHead>
                                            <TableHead className="text-right">Hedef</TableHead><TableHead className="text-right">Gerçekleşen</TableHead><TableHead className="text-right">%</TableHead>
                                          </TableRow></TableHeader>
                                          <TableBody>
                                            {rowsS.map((r, k) => {
                                              const agir = r.yuzde > 150
                                              return (
                                                <TableRow key={`${r.formId}-${k}`} className={agir ? "bg-red-50/70" : ""}>
                                                  <TableCell><a href={`/forms/overtime/${r.formId}`} className="underline underline-offset-2" style={{ color: NAVY }}>{r.formNo}</a></TableCell>
                                                  <TableCell>{tarihTR(r.tarih)}</TableCell>
                                                  <TableCell>{r.personel} <span className="text-muted-foreground text-xs">{r.sicil}</span></TableCell>
                                                  <TableCell>{r.parcaKodu}</TableCell>
                                                  <TableCell className="text-right">{n(r.hedefAdet)}</TableCell>
                                                  <TableCell className="text-right">{n(r.gerceklesenAdet)}</TableCell>
                                                  <TableCell className={`text-right font-medium ${agir ? "text-red-600" : "text-amber-600"}`}>{pct(r.yuzde)}</TableCell>
                                                </TableRow>
                                              )
                                            })}
                                          </TableBody>
                                        </Table>
                                      </>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 2) Özet kartları — seçili aralığın TAMAMI */}
          {t && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Card><CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Eksik veri girişi</div>
                <div className="text-2xl font-bold" style={{ color: eksikRenk(eksikPctT) }}>{pct(eksikPctT)}</div>
                <div className="text-xs text-muted-foreground mt-1">{n(t.satir)} üretim satırının {n(t.eksik)} tanesinde gerçekleşen adet hiç girilmemiş.</div>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Şüpheli performans</div>
                <div className="text-2xl font-bold" style={{ color: NAVY }}>{pct(ustu100PctT)}</div>
                <div className="text-xs text-muted-foreground mt-1">Hesaplanan {n(t.hesaplanan)} satırdan {n(t.ustu100)} tanesi %100 üstü; bunlardan {n(t.ustu150)} tanesi %150&apos;yi de aşıyor.</div>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Ağırlıklı performans</div>
                <div className="text-2xl font-bold"><PerfHucre v={perfT} /></div>
                <div className="text-xs text-muted-foreground mt-1">Toplam {n(t.gercToplam)} gerçekleşen / {n(t.hedefToplam)} hedef adet.</div>
              </CardContent></Card>
            </div>
          )}

          {/* 3) Aylık trend — kompakt tablo */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold" style={{ color: NAVY }}>Aylık trend</h3>
              {data.aylar.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground text-sm">Seçilen aralıkta veri yok.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Ay</TableHead><TableHead className="text-right">Form</TableHead><TableHead className="text-right">Satır</TableHead>
                      <TableHead className="w-44">Eksik oranı</TableHead><TableHead className="text-right">Eksik %</TableHead><TableHead className="text-right">Şüpheli %</TableHead><TableHead className="text-right">Performans</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {data.aylar.map((a) => (
                        <TableRow key={a.ay}>
                          <TableCell className="font-medium">{ayEtiket(a.ay)}</TableCell>
                          <TableCell className="text-right">{n(a.form)}</TableCell><TableCell className="text-right">{n(a.satir)}</TableCell>
                          <TableCell><EksikCubuk p={a.eksikPct} /></TableCell>
                          <TableCell className="text-right font-medium" style={{ color: eksikRenk(a.eksikPct) }}>{pct(a.eksikPct)}</TableCell>
                          <TableCell className="text-right">{pct(a.ustu100Pct)}</TableCell>
                          <TableCell className="text-right"><PerfHucre v={a.agirlikliPct} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <p className="text-xs text-muted-foreground pt-2">
                Kurallar: yalnız APPROVED mesai formları; hedef 0 (sayılamayan iş) ve üretim dışı bölümler hariç; eksik = gerçekleşen girilmemiş satır;
                şüpheli = hesaplanan satırlarda &gt;%100 (ağır: &gt;%150); performans = Σgerçekleşen / Σhedef (ağırlıklı). Pencere Temmuz 2026&apos;dan başlar.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
