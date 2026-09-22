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
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const NAVY = '#1B4F72'
const IK_ORG_UNIT_ID = 'cmrzg1kr600037jpe4ge6rxe0'

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
  const [secilenDepartmanId, setSecilenDepartmanId] = useState<string>(IK_ORG_UNIT_ID)
  const [ozet, setOzet] = useState<DepartmanOzeti[] | null>(null)
  const [mevcutYillar, setMevcutYillar] = useState<number[]>([])
  const [secilenYil, setSecilenYil] = useState<number | null>(null)
  const [ceyrekTrend, setCeyrekTrend] = useState<DepartmanCeyrekTrendi[] | null>(null)

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

      {!ozet ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !secilenOzet || secilenOzet.kpiSayisi === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {secilenDepartman?.name ?? '...'} için henüz KPI tanımlanmamış.
        </p>
      ) : (
        <>
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
            <>
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

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Tüm Departmanlar — Karşılaştırma</CardTitle>
                  <p className="text-xs text-muted-foreground">{secilenYil} yılı — her departman kendi küçük grafiğinde, karışmasın diye</p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {ceyrekTrend.map(d => {
                      const veri = d.ceyrekler.map(c => ({ ad: `Ç${c.ceyrek}`, Oran: c.oran }))
                      const sonDegerler = d.ceyrekler.filter(c => c.oran != null)
                      const sonOran = sonDegerler.length > 0 ? sonDegerler[sonDegerler.length - 1].oran : null
                      const secili = d.orgUnitId === secilenDepartmanId
                      return (
                        <button
                          key={d.orgUnitId}
                          onClick={() => setSecilenDepartmanId(d.orgUnitId)}
                          className="text-left rounded-md border p-2 transition-colors"
                          style={{
                            borderColor: secili ? NAVY : '#e2e8f0',
                            backgroundColor: secili ? '#eff6ff' : 'white',
                          }}
                        >
                          <p className="text-xs font-medium truncate mb-1" title={d.name}>{d.name}</p>
                          <ResponsiveContainer width="100%" height={50}>
                            <LineChart data={veri} margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
                              <YAxis hide domain={[0, 100]} />
                              <Tooltip formatter={(v: number) => `%${v}`} labelFormatter={(l) => l} />
                              <Line
                                type="monotone"
                                dataKey="Oran"
                                stroke={secili ? NAVY : '#94a3b8'}
                                strokeWidth={2}
                                dot={{ r: 2 }}
                                connectNulls
                                isAnimationActive={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                          <p className="text-sm font-bold" style={{ color: sonOran == null ? '#94a3b8' : NAVY }}>
                            {sonOran == null ? 'Veri yok' : `%${sonOran}`}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </>
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
      )}
    </div>
  )
}
