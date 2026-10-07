'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Loader2, LayoutDashboard } from 'lucide-react'
import {
  Bar, ComposedChart, Line, Legend, LabelList, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const NAVY = '#1B4F72'
const GENEL_ID = 'GENEL'
// Ç1-Ç4 bir SIRA (zaman içinde ilerleme) — kategorik (rastgele/kimlik) renk değil, TEK ton
// açıktan koyuya kademeli "ordinal" renk kullanılır (dataviz skill: sıralı veri tek hue ile
// gösterilir). Lacivert ilerihub'ın marka rengiyle (#1B4F72) bitiyor, validator ile doğrulandı.
const CEYREK_RENKLERI = ['#86B6DE', '#5285B2', '#2E6690', '#1B4F72']

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

// Basit doğrusal regresyon (en küçük kareler) — çubukların üzerine genel eğilimi (yukarı/aşağı)
// gösteren kesikli bir çizgi koymak için. Eksik (null) noktaları atlar, sıra numarasını x kabul eder.
function egilimEkle<T extends Record<string, unknown>>(
  veri: T[],
  alan: keyof T,
): (T & { Egilim: number | null })[] {
  const noktalar = veri
    .map((v, i) => ({ x: i, y: v[alan] as number | null }))
    .filter((n): n is { x: number; y: number } => n.y != null)
  if (noktalar.length < 2) return veri.map(v => ({ ...v, Egilim: null }))
  const n = noktalar.length
  const sumX = noktalar.reduce((t, p) => t + p.x, 0)
  const sumY = noktalar.reduce((t, p) => t + p.y, 0)
  const sumXY = noktalar.reduce((t, p) => t + p.x * p.y, 0)
  const sumXX = noktalar.reduce((t, p) => t + p.x * p.x, 0)
  const payda = n * sumXX - sumX * sumX
  if (payda === 0) return veri.map(v => ({ ...v, Egilim: null }))
  const egim = (n * sumXY - sumX * sumY) / payda
  const kesisim = (sumY - egim * sumX) / n
  return veri.map((v, i) => ({ ...v, Egilim: Math.round(egim * i + kesisim) }))
}

export default function KpiOzetClient() {
  const searchParams = useSearchParams()
  const [departmanlar, setDepartmanlar] = useState<Departman[]>([])
  // KPI Takip sayfasından belirli bir departmandayken "KPI Özet →" ile gelindiyse o departmanın
  // özetine düşsün — direkt ana sekmeden/menüden açıldıysa (departman parametresi yoksa) Şirket
  // Geneli ile başlasın.
  const [secilenDepartmanId, setSecilenDepartmanId] = useState<string>(() => searchParams.get('departman') || GENEL_ID)
  const [ozet, setOzet] = useState<DepartmanOzeti[] | null>(null)
  const [mevcutYillar, setMevcutYillar] = useState<number[]>([])
  const [secilenYil, setSecilenYil] = useState<number | null>(null)
  const [ceyrekTrend, setCeyrekTrend] = useState<DepartmanCeyrekTrendi[] | null>(null)
  const [genelToplam, setGenelToplam] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/yonetim/kpi/departmanlar')
      .then(res => res.json())
      .then(d => setDepartmanlar(d.departmanlar ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    // 2025 ve 2026 birlikte ortalanmasın diye "genel başarı" hep TEK bir yılı yansıtır —
    // yıl seçilmediyse API en güncel yılı seçip döner, seçiciyi de ona göre dolduruyoruz.
    const q = secilenYil != null ? `?yil=${secilenYil}` : ''
    fetch(`/api/yonetim/kpi/ozet${q}`)
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
    fetch(`/api/yonetim/kpi/ceyrek-trend?yil=${secilenYil}`)
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

  // Şirket geneli çeyrek ORTALAMASI (tüm departmanların o çeyrekteki ortalaması) — departman
  // karşılaştırma grafiğinin x ekseni departman olduğu için eğilim çizgisi oraya oturmuyordu,
  // bunun için ayrı, çeyreklerin kendisinin x ekseni olduğu küçük bir grafik.
  const sirketGeneliCeyrekOrtalama = useMemo(() => {
    if (!ceyrekTrend || ceyrekTrend.length === 0) return []
    return [1, 2, 3, 4].map(ceyrek => {
      const degerler = ceyrekTrend
        .map(d => d.ceyrekler.find(c => c.ceyrek === ceyrek)?.oran)
        .filter((o): o is number => o != null)
      const oran = degerler.length > 0 ? Math.round(degerler.reduce((t, o) => t + o, 0) / degerler.length) : null
      return { ad: `Ç${ceyrek}`, Oran: oran }
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
        <Link href="/yonetim/kpi">
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
                <ComposedChart data={departmanCeyrekKarsilastirma} margin={{ left: 4, right: 8, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="departman" tick={{ fontSize: 12 }} interval={0} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(v: number) => (v == null ? '—' : `%${v}`)}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.tamAd ?? ''}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {[1, 2, 3, 4].map((ceyrek, i) => (
                    <Bar key={ceyrek} dataKey={`Ç${ceyrek}`} fill={CEYREK_RENKLERI[i]} radius={[3, 3, 0, 0]}>
                      <LabelList
                        dataKey={`Ç${ceyrek}`}
                        position="top"
                        fontSize={9}
                        fill="#52514e"
                        formatter={(v: number | null) => (v == null ? '' : `%${v}`)}
                      />
                    </Bar>
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            )}
            {ceyrekTrend && ceyrekTrend.length > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                {ceyrekTrend.map(d => `${kisaltDepartman(d.name)} = ${d.name}`).join(' · ')}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Şirket geneli çeyrek ORTALAMASI + eğilim çizgisi — departman karşılaştırmasının x ekseni
          departman olduğu için eğilim orada gösterilemiyordu, bunun için ayrı küçük grafik */}
      {secilenDepartmanId === GENEL_ID && sirketGeneliCeyrekOrtalama.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Şirket Geneli — Çeyreklik Ortalama Eğilimi</CardTitle>
            <p className="text-xs text-muted-foreground">{secilenYil} yılı, tüm departmanların çeyrek bazında ortalaması</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={egilimEkle(sirketGeneliCeyrekOrtalama, 'Oran')} margin={{ left: 4, right: 8, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="ad" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => (v == null ? '—' : `%${v}`)} />
                <Bar dataKey="Oran" radius={[4, 4, 0, 0]}>
                  {[1, 2, 3, 4].map(ceyrek => (
                    <Cell key={ceyrek} fill={CEYREK_RENKLERI[ceyrek - 1]} />
                  ))}
                  <LabelList
                    dataKey="Oran"
                    position="top"
                    fontSize={11}
                    fill="#52514e"
                    formatter={(v: number | null) => (v == null ? '' : `%${v}`)}
                  />
                </Bar>
                <Line
                  type="linear"
                  dataKey="Egilim"
                  stroke="#dc2626"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                  legendType="none"
                  name="Eğilim"
                />
              </ComposedChart>
            </ResponsiveContainer>
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
                  <ComposedChart
                    data={egilimEkle(
                      ceyrekTrend.find(d => d.orgUnitId === secilenDepartmanId)?.ceyrekler.map(c => ({
                        ad: `Ç${c.ceyrek}`, Oran: c.oran,
                      })) ?? [],
                      'Oran',
                    )}
                    margin={{ left: 4, right: 8, top: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="ad" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => (v == null ? '—' : `%${v}`)} />
                    <Bar dataKey="Oran" radius={[4, 4, 0, 0]}>
                      {[1, 2, 3, 4].map(ceyrek => (
                        <Cell key={ceyrek} fill={CEYREK_RENKLERI[ceyrek - 1]} />
                      ))}
                      <LabelList
                        dataKey="Oran"
                        position="top"
                        fontSize={11}
                        fill="#52514e"
                        formatter={(v: number | null) => (v == null ? '' : `%${v}`)}
                      />
                    </Bar>
                    <Line
                      type="linear"
                      dataKey="Egilim"
                      stroke="#dc2626"
                      strokeWidth={2}
                      strokeDasharray="5 4"
                      dot={false}
                      legendType="none"
                      name="Eğilim"
                    />
                  </ComposedChart>
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
                      href={`/yonetim/kpi?departman=${secilenDepartmanId}&kpi=${k.id}`}
                      className="flex items-center justify-between rounded-md px-3 py-2 hover:brightness-95 transition-[filter]"
                      style={{ backgroundColor: oranBgRengi(k.oran) }}
                    >
                      {/* Arka plan her zaman açık pastel (tema fark etmez) — koyu temada yazı
                          rengi sayfanın varsayılanına (beyaza yakın) düşüp okunmaz oluyordu,
                          burada sabit koyu renk veriyoruz. */}
                      <span className="text-sm font-medium" style={{ color: '#1f2937' }}>{k.name}</span>
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
