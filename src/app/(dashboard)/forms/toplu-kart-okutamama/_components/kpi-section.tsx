"use client"

import { useEffect, useState } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Istatistik = {
  kapsam: "kendi" | "ekip"
  erisim: "SELF" | "GRI" | "FULL"
  toplamKayit: number
  aylik: { ay: string; label: string; sayi: number }[]
  nedenDagilim: { neden: string; label: string; sayi: number }[]
  kayitSaatiToplamiDk: number
  bekleyen: { onay: number; iv: number }
  bolumKirilim: { bolum: string; sayi: number }[]
}

const NAVY = "#1B4F72"
const NEDEN_RENK = ["#2563eb", "#0891b2", "#7c3aed", "#059669", "#94a3b8"]

function dkFormat(dk: number): string {
  const h = Math.floor(dk / 60)
  const m = dk % 60
  if (h > 0) return `${h} sa ${m} dk`
  return `${m} dk`
}

function StatKart({ baslik, deger, alt }: { baslik: string; deger: string | number; alt?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{baslik}</div>
        <div className="mt-1 text-2xl font-semibold" style={{ color: NAVY }}>{deger}</div>
        {alt && <div className="mt-0.5 text-xs text-muted-foreground">{alt}</div>}
      </CardContent>
    </Card>
  )
}

export function KpiSection({ kapsam }: { kapsam: "kendi" | "ekip" }) {
  const [data, setData] = useState<Istatistik | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let iptal = false
    setLoading(true)
    fetch(`/api/toplu-kart-okutamama/istatistik?kapsam=${kapsam}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!iptal) setData(d) })
      .finally(() => { if (!iptal) setLoading(false) })
    return () => { iptal = true }
  }, [kapsam])

  if (loading) return <div className="py-6 text-sm text-muted-foreground">İstatistik yükleniyor…</div>
  if (!data) return null

  // Rozet: Kişisel (kendi) · Ekibiniz/Fabrika geneli (ekip, erişime göre).
  const kapsamEtiket =
    kapsam === "kendi" ? "Kişisel" : data.erisim === "FULL" ? "Fabrika geneli" : "Ekibiniz"
  const nedenVar = data.nedenDagilim.some((n) => n.sayi > 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        İstatistikler
        <span className="rounded-full border px-2 py-0.5 text-xs">{kapsamEtiket}</span>
      </div>

      {/* Sayaç kartları */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatKart baslik="Toplam kayıt" deger={data.toplamKayit} />
        <StatKart baslik="Kayıt saatleri toplamı" deger={dkFormat(data.kayitSaatiToplamiDk)} alt="07:00 üzeri farkların toplamı" />
        <StatKart baslik="Onay bekleyen" deger={data.bekleyen.onay} />
        <StatKart baslik="İV onayı bekleyen" deger={data.bekleyen.iv} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Aylık trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Aylık kayıt sayısı (son 6 ay)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.aylik} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} width={28} />
                <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                <Bar dataKey="sayi" name="Kayıt" fill={NAVY} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Neden dağılımı */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Neden dağılımı</CardTitle>
          </CardHeader>
          <CardContent>
            {nedenVar ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.nedenDagilim} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis type="category" dataKey="label" width={90} tickLine={false} axisLine={false} fontSize={12} />
                  <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                  <Bar dataKey="sayi" name="Kayıt" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                    {data.nedenDagilim.map((_, i) => <Cell key={i} fill={NEDEN_RENK[i % NEDEN_RENK.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="py-12 text-center text-sm text-muted-foreground">Henüz veri yok</div>
            )}
          </CardContent>
        </Card>

        {/* Bölüm sıralaması — yalnız FULL */}
        {data.bolumKirilim.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Bölüm sıralaması (en çok kayıt — ilk 12)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={Math.max(180, data.bolumKirilim.length * 34)}>
                <BarChart data={data.bolumKirilim} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis type="category" dataKey="bolum" width={160} tickLine={false} axisLine={false} fontSize={11} />
                  <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                  <Bar dataKey="sayi" name="Kayıt" fill={NAVY} radius={[0, 4, 4, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
