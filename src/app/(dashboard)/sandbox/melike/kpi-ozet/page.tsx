'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Loader2, LayoutDashboard } from 'lucide-react'
import {
  LineChart, Line, Bar, BarChart, Legend, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const NAVY = '#1B4F72'
const GENEL_ID = 'GENEL'
// Doğrulanmış kategorik paletin ilk 4 rengi (renk körlüğü güvenli, bkz. faturalar sayfasındaki PALETTE) —
// burada sadece 4 seri (Ç1-Ç4) olduğu için tüm 8 renge gerek yok.
const CEYREK_RENKLERI = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100']

const MUDURLUK_EKI = /\s*müdürlüğü\s*$/i
const BAGLAC_KELIMELER = new Set(['ve', 'ile'])

// "Sistem Geliştirme Müdürlüğü" -> "SG" — grafikte/eksende uzun isimler yer kaplamasın diye.
function kisaltDepartman(ad: string): string {
  const temiz = ad.replace(MUDURLUK_EKI, '').trim()
  const kelimeler = temiz
    .split(/[\s&/-]+/)
    .filter(k => k.length > 0 && !BAGLAC_KELIMELER.has(k.toLocaleLowerCase('tr')))
  if (kelimeler.length === 0) return ad.slice(0, 2).toLocaleUpperCase('tr')
  if (kelimeler.length === 1) return kelimeler[0].slice(0, 2).toLocaleUpperCase('tr')
  return (kelimeler[0][0] + kelimeler[1][0]).toLocaleUpperCase('tr')
}

interface Departman {
  id: string
  name: string
}

interface DepartmanCeyrekTrendi {
  orgUnitId: string
  name: string
  ceyrekler: { ceyrek: number; oran: number | null }[]
}

interface OzetKpiSirasi {
  id: string
  name: string
  oran: number
}

interface DepartmanOzeti {
  orgUnitId: string
  name: string
  kpiSayisi: number
  genelOran: number | null
  kpiler: OzetKpiSirasi[]
}

function oranRengi(oran: number): string {
  if (oran >= 80) return '#16a34a'
  if (oran >= 50) return '#d97706'
  return '#dc2626'
}

function oranBgRengi(oran: number): string {
  if (oran >= 80) return '#dcfce7'
  if (oran >= 50) return '#fef3c7'
  return '#fee2e2'
}

export default function KpiOzetPage() {
  const [departmanlar, setDepartmanlar] = useState<Departman[]>([])
  const [secilenDepartmanId, setSecilenDepartmanId] = useState<string>(GENEL_ID)
  const [ozet, setOzet] = useState<DepartmanOzeti[] | null>(null)
  const [mevcutYillar, setMevcutYillar] = useState<number[]>([])
  const [secilenYil, setSecilenYil] = useState<number | null>(null)
  const [ceyrekTrend, setCeyrekTrend] = useState<DepartmanCeyrekTrendi[] | null>(null)
  const [genelToplam, setGenelToplam] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/sandbox/melike/kpi/departmanlar')
      .then(res => res.json())
      .then(d => setDepartmanlar(d.departmanlar ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    // 2025 ve 2026 birlikte ortalanmasın diye "genel başarı" hep TEK bir yılı yansıtır —
    // yıl seçilmediyse API en güncel yılı seçip döner, seçiciyi de ona göre dolduruyoruz.
    const q = secilenYil != null ? `?yil=${secilenYil}` : ''
    fetch(`/api/sandbox/melike/kpi/ozet${q}`)
      .then(res => res.json())
      .then(d => {
        setOzet(d.ozet ?? [])
        setMevcutYillar(d.mevcutYillar ?? [])
        setGenelToplam(d.genelToplam ?? null)
        if (secilenYil == null && d.aktifYil != null) setSecilenYil(d.aktifYil)
      })
      .catch(() => setOzet([]))
  }, [secilenYil])

  useEffect(() => {
    if (secilenYil == null) return
    fetch(`/api/sandbox/melike/kpi/ceyrek-trend?yil=${secilenYil}`)
      .then(res => res.json())
      .then(d => setCeyrekTrend(d.trend ?? []))
      .catch(() => setCeyrekTrend([]))
  }, [secilenYil])

  const secilenOzet = useMemo(
    () => ozet?.find(d => d.orgUnitId === secilenDepartmanId) ?? null,
    [ozet, secilenDepartmanId],
  )
  const secilenDepartman = departmanlar.find(d => d.id === secilenDepartmanId)

  // Şirket geneli çeyrek kıyası: her departman için tek kısa çubuk grubu (Ç1-Ç4) —
  // "hangi departman hangi çeyrekte nasıldı" tek bakışta görünsün.
  const departmanCeyrekKarsilastirma = useMemo(() => {
    if (!ceyrekTrend) return []
    return ceyrekTrend.map(d => {
      const row: Record<string, string | number | null> = { departman: kisaltDepartman(d.name), tamAd: d.name }
      for (const c of d.ceyrekler) row[`Ç${c.ceyrek}`] = c.oran
      return row
    })
  }, [ceyrekTrend])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-3xl font-bold tracking-tight flex items-center gap-3">
            <LayoutDashboard className="h-6 w-6 lg:h-7 lg:w-7" style={{ color: NAVY }} />
            KPI Özet
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Departmanın genel başarı durumu, tüm KPI'lar sıralı</p>
        </div>
        <Link href="/sandbox/melike/kpi">
          <Button size="sm" variant="outline">← KPI Takip</Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Departman</Label>
          <Select value={secilenDepartmanId} onValueChange={setSecilenDepartmanId}>
            <SelectTrigger className="w-full sm:w-80 mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={GENEL_ID}>Şirket Geneli</SelectItem>
              {departmanlar.map(d => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {mevcutYillar.length > 0 && (
          <div>
            <Label className="text-xs text-muted-foreground">Yıl</Label>
            <Select value={secilenYil != null ? String(secilenYil) : undefined} onValueChange={v => setSecilenYil(Number(v))}>
              <SelectTrigger className="w-28 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {mevcutYillar.map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Şirket geneli — sadece "Şirket Geneli" seçiliyken görünür */}
      {secilenDepartmanId === GENEL_ID && (
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Genel Özet — Şirket Geneli</CardTitle>
              <p className="text-xs text-muted-foreground">{secilenYil} yılı, departmanların çeyrek çeyrek kıyası</p>
            </div>
            {genelToplam != null && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Genel başarı</p>
                <p className="text-3xl font-bold" style={{ color: oranRengi(genelToplam) }}>%{genelToplam}</p>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {!ceyrekTrend ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={departmanCeyrekKarsilastirma} margin={{ left: 4, right: 8, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="departman" tick={{ fontSize: 12 }} interval={0} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(v: number) => (v == null ? '—' : `%${v}`)}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.tamAd ?? ''}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {[1, 2, 3, 4].map((ceyrek, i) => (
                    <Bar key={ceyrek} dataKey={`Ç${ceyrek}`} fill={CEYREK_RENKLERI[i]} radius={[3, 3, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Departmana özel detay — bir departman seçiliyken görünür */}
      {secilenDepartmanId !== GENEL_ID && (
      !ozet ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !secilenOzet || secilenOzet.kpiSayisi === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {secilenDepartman?.name ?? '...'} için henüz KPI tanımlanmamış.
        </p>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setSecilenDepartmanId(GENEL_ID)}
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            ← Şirket Geneline dön
          </button>

          <Card>
            <CardContent className="pt-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{secilenDepartman?.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{secilenOzet.kpiSayisi} KPI</p>
              </div>
              {secilenOzet.genelOran != null ? (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Genel başarı ({secilenYil})</p>
                  <p className="text-3xl font-bold" style={{ color: oranRengi(secilenOzet.genelOran) }}>
                    %{secilenOzet.genelOran}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Henüz ölçüm verisi yok</p>
              )}
            </CardContent>
          </Card>

          {ceyrekTrend && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{secilenDepartman?.name} — Çeyreklik Gidişat</CardTitle>
                <p className="text-xs text-muted-foreground">{secilenYil} yılı, çeyrek çeyrek genel başarı — iyileşme/kötüleşme trendi</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart
                    data={
                      ceyrekTrend.find(d => d.orgUnitId === secilenDepartmanId)?.ceyrekler.map(c => ({
                        ad: `Ç${c.ceyrek}`, Oran: c.oran,
                      })) ?? []
                    }
                    margin={{ left: 4, right: 8, top: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="ad" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                    <Tooltip formatter={(v: number) => `%${v}`} />
                    <Line type="monotone" dataKey="Oran" stroke={NAVY} strokeWidth={2} dot={{ r: 4 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">KPI'lar — en başarılıdan en başarısıza</CardTitle>
            </CardHeader>
            <CardContent>
              {secilenOzet.kpiler.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Henüz ölçüm verisi girilmiş bir KPI yok</p>
              ) : (
                <div className="space-y-2">
                  {secilenOzet.kpiler.map(k => (
                    <Link
                      key={k.id}
                      href={`/sandbox/melike/kpi?departman=${secilenDepartmanId}&kpi=${k.id}`}
                      className="flex items-center justify-between rounded-md px-3 py-2 hover:brightness-95 transition-[filter]"
                      style={{ backgroundColor: oranBgRengi(k.oran) }}
                    >
                      <span className="text-sm font-medium">{k.name}</span>
                      <span className="text-sm font-bold" style={{ color: oranRengi(k.oran) }}>%{k.oran}</span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )
      )}
    </div>
  )
}
