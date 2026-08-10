"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts"
import { Loader2, AlertTriangle, Users, TicketCheck, Inbox, Star } from "lucide-react"

const NAVY = "#1B4F72"

/** reports/route.ts yanıtı — Faz A'da genişletildi (openCount, teamPerformance, örneklem sayıları). */
interface RaporYaniti {
  period: number
  summary: {
    totalTickets: number
    openTickets: number
    resolvedTickets: number
    closedTickets: number
    slaBreached: number
    avgResolutionTime: number
    avgResponseTime: number
    avgSatisfaction: number
    resolutionRate: number
    respondedCount: number
    resolvedCountForAvg: number
    ratedCount: number
  }
  byPriority: Record<string, number>
  byStatus: Record<string, number>
  byCategory: { name: string; color: string; count: number }[]
  individualPerformance: { email: string; name: string; totalAssigned: number; openCount: number }[]
  teamPerformance: { teamId: string; name: string; poolCount: number; claimedCount: number; totalOpen: number }[]
  dailyTrend: { date: string; created: number; resolved: number }[]
}

const ONCELIK_ETIKET: Record<string, string> = {
  TICKET_CRITICAL: "Kritik",
  TICKET_HIGH: "Yüksek",
  NORMAL: "Normal",
  TICKET_LOW: "Düşük",
}
const ONCELIK_RENK: Record<string, string> = {
  TICKET_CRITICAL: "#dc2626",
  TICKET_HIGH: "#ea580c",
  NORMAL: "#2563eb",
  TICKET_LOW: "#64748b",
}

/** Örneklem az/yoksa DÜRÜST metin — yanıltıcı sayı yerine.
 *  0 kayıt → değer HİÇ gösterilmez; <3 kayıt → değer + "N kayıttan" uyarısı. */
function ornekNotu(n: number): { yeterli: boolean; not: string | null } {
  if (n === 0) return { yeterli: false, not: "henüz veri yok" }
  if (n < 3) return { yeterli: true, not: `yalnız ${n} kayıttan hesaplandı` }
  return { yeterli: true, not: `${n} kayıt` }
}

function SureKarti({
  baslik, deger, birim, ornek, ikon,
}: { baslik: string; deger: number; birim: string; ornek: number; ikon: React.ReactNode }) {
  const { yeterli, not } = ornekNotu(ornek)
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
          {ikon}
          {baslik}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {yeterli ? (
          <div className="text-2xl font-bold" style={{ color: NAVY }}>
            {deger}
            <span className="text-sm font-normal text-muted-foreground ml-1">{birim}</span>
          </div>
        ) : (
          <div className="text-lg font-medium text-muted-foreground">Henüz veri yok</div>
        )}
        {not && <p className="text-xs text-muted-foreground mt-1">{not}</p>}
      </CardContent>
    </Card>
  )
}

function OzetKarti({
  baslik, deger, vurgu, ikon,
}: { baslik: string; deger: number; vurgu?: "kirmizi"; ikon: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
          {ikon}
          {baslik}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className="text-3xl font-bold"
          style={{ color: vurgu === "kirmizi" && deger > 0 ? "#dc2626" : NAVY }}
        >
          {deger}
        </div>
      </CardContent>
    </Card>
  )
}

export function KpiDashboard() {
  const [veri, setVeri] = useState<RaporYaniti | null>(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)

  useEffect(() => {
    let iptal = false
    ;(async () => {
      try {
        const res = await fetch("/api/tickets/reports?period=30")
        if (!res.ok) {
          const e = await res.json().catch(() => ({}))
          if (!iptal) setHata(e.error || "Rapor yüklenemedi")
          return
        }
        const d = await res.json()
        if (!iptal) setVeri(d)
      } catch {
        if (!iptal) setHata("Rapor yüklenemedi — bağlantı hatası")
      } finally {
        if (!iptal) setYukleniyor(false)
      }
    })()
    return () => { iptal = true }
  }, [])

  if (yukleniyor) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (hata || !veri) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">{hata ?? "Rapor verisi yok"}</p>
      </div>
    )
  }

  const s = veri.summary
  // "Bu hafta açılan" — dailyTrend son 7 günü zaten kapsıyor, ek istek gerekmiyor.
  const buHaftaAcilan = veri.dailyTrend.reduce((t, g) => t + g.created, 0)

  const oncelikVerisi = Object.entries(veri.byPriority)
    .map(([k, v]) => ({ ad: ONCELIK_ETIKET[k] ?? k, sayi: v, renk: ONCELIK_RENK[k] ?? NAVY }))
    .filter((x) => x.sayi > 0)

  const kategoriVerisi = veri.byCategory.map((c) => ({ ad: c.name, sayi: c.count, renk: c.color }))

  // Yalnız üzerinde AÇIK iş olanlar — sıfır yüklü kişiyle grafik şişmesin.
  const kisiVerisi = veri.individualPerformance
    .filter((k) => k.openCount > 0)
    .map((k) => ({ ad: k.name, sayi: k.openCount }))
    .sort((a, b) => b.sayi - a.sayi)

  return (
    <div className="space-y-6">
      {/* A) Özet kartlar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <OzetKarti baslik="Açık talep" deger={s.openTickets} ikon={<Inbox className="h-4 w-4" />} />
        <OzetKarti baslik="Son 7 günde açılan" deger={buHaftaAcilan} ikon={<TicketCheck className="h-4 w-4" />} />
        <OzetKarti baslik="Çözülen + kapanan" deger={s.resolvedTickets + s.closedTickets} ikon={<TicketCheck className="h-4 w-4" />} />
        <OzetKarti baslik="SLA ihlali" deger={s.slaBreached} vurgu="kirmizi" ikon={<AlertTriangle className="h-4 w-4" />} />
      </div>

      {/* B) Dağılımlar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Kategoriye göre</CardTitle>
          </CardHeader>
          <CardContent>
            {kategoriVerisi.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Veri yok</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(160, kategoriVerisi.length * 38)}>
                <BarChart data={kategoriVerisi} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="ad" width={150} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => [`${v} talep`, "Adet"]} />
                  <Bar dataKey="sayi" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                    {/* Kategori kendi rengini taşıyor (TicketCategory.color) */}
                    {kategoriVerisi.map((k, i) => <Cell key={i} fill={k.renk} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Önceliğe göre</CardTitle>
          </CardHeader>
          <CardContent>
            {oncelikVerisi.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Veri yok</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(160, oncelikVerisi.length * 38)}>
                <BarChart data={oncelikVerisi} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="ad" width={80} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => [`${v} talep`, "Adet"]} />
                  <Bar dataKey="sayi" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                    {oncelikVerisi.map((o, i) => <Cell key={i} fill={o.renk} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* C) İş yükü */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Kişi bazlı açık iş
            </CardTitle>
          </CardHeader>
          <CardContent>
            {kisiVerisi.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Kimsenin üzerinde açık talep yok</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(160, kisiVerisi.length * 38)}>
                <BarChart data={kisiVerisi} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="ad" width={140} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => [`${v} açık talep`, "Adet"]} />
                  <Bar dataKey="sayi" fill={NAVY} radius={[0, 4, 4, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Takım havuzu
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Havuz modeli yeni; kategori-takım bağı kurulana ve o kategorilerde
                talep açılana kadar bu liste BOŞ gelir — bozuk sanılmasın diye
                açık bir mesaj gösteriliyor. */}
            {veri.teamPerformance.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Takıma düşmüş açık talep yok
              </p>
            ) : (
              <div className="space-y-3">
                {veri.teamPerformance.map((t) => (
                  <div key={t.teamId} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{t.name}</span>
                      <span className="text-sm font-bold" style={{ color: NAVY }}>{t.totalOpen}</span>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5">
                        Havuzda bekleyen: {t.poolCount}
                      </span>
                      <span className="rounded-full bg-blue-100 text-blue-800 px-2 py-0.5">
                        Üstlenilmiş: {t.claimedCount}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* D) Süre metrikleri — örneklem sayısına göre DÜRÜST */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SureKarti
          baslik="Ort. ilk yanıt"
          deger={s.avgResponseTime}
          birim="saat"
          ornek={s.respondedCount}
          ikon={<Loader2 className="h-4 w-4" />}
        />
        <SureKarti
          baslik="Ort. çözüm"
          deger={s.avgResolutionTime}
          birim="saat"
          ornek={s.resolvedCountForAvg}
          ikon={<TicketCheck className="h-4 w-4" />}
        />
        <SureKarti
          baslik="Memnuniyet"
          deger={s.avgSatisfaction}
          birim="/ 5"
          ornek={s.ratedCount}
          ikon={<Star className="h-4 w-4" />}
        />
      </div>

      {/* E) Trend — dailyTrend API'de HAZIR ama şimdilik gizli.
          Prod'da toplam birkaç talep var; 7 noktalı bir çizgi grafiği anlam
          taşımaz, hatta "düşüş/artış" gibi yanlış okunur. Veri birikince
          buraya LineChart(created/resolved) eklenecek — endpoint değişmeyecek. */}

      <p className="text-xs text-muted-foreground text-center">
        Son {veri.period} gün · toplam {s.totalTickets} talep · çözüm oranı %{s.resolutionRate}
      </p>
    </div>
  )
}
