'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AlertTriangle, Loader2, RotateCw } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { RMA_DURUM_LABELS, RMA_IADE_TURU_LABELS, RMA_KARAR_LABELS } from '@/lib/quality/rma-labels'
// TYPE-ONLY: rma-kpi sunucu tarafı (prisma) çeker; `import type` derlemede silinir.
import type { Metrik, RmaKpi } from '@/lib/quality/rma-kpi'

const NAVY = '#1B4F72'

/**
 * Yüzde gösterimi. Sıfır OLMAYAN ama 1 ondalığa yuvarlandığında 0 çıkan oranlar
 * (örn. 5/18027 = %0,03) "%0" diye yanıltmasın → "<%0,1".
 */
function yuzdeMetni(oran: number, adet: number): string {
  if (adet > 0 && oran === 0) return '<%0,1'
  return `%${oran}`
}

// ── Küçük sunum parçaları ──

function StatKart({ baslik, deger, alt }: { baslik: string; deger: string | number; alt?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{baslik}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: NAVY }}>{deger}</div>
        {alt && <div className="mt-0.5 text-xs text-muted-foreground">{alt}</div>}
      </CardContent>
    </Card>
  )
}

function BolumBaslik({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</h3>
  )
}

/** Etiket + CSS bar + sayı. Dağılım listeleri için (modal içinde 3 ayrı grafik yerine). */
function OranSatiri({
  etiket,
  adet,
  yuzdeDeger,
  mono = false,
}: {
  etiket: string
  adet: number
  yuzdeDeger: number
  mono?: boolean
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`w-40 shrink-0 truncate text-slate-700 ${mono ? 'font-mono text-xs' : ''}`} title={etiket}>
        {etiket}
      </span>
      <span className="h-2 min-w-0 flex-1 rounded bg-slate-100">
        <span
          className="block h-2 rounded"
          style={{ width: `${Math.max(yuzdeDeger, 0)}%`, backgroundColor: NAVY }}
        />
      </span>
      <span className="w-24 shrink-0 text-right tabular-nums text-slate-600">
        {adet} <span className="text-slate-400">({yuzdeMetni(yuzdeDeger, adet)})</span>
      </span>
    </div>
  )
}

/** "Yetersiz veri" rozeti + tek satır sebep; hesaplandıysa çocukları render eder. */
function MetrikBlok<T>({
  baslik,
  metrik,
  children,
}: {
  baslik: string
  metrik: Metrik<T>
  children: (veri: T) => React.ReactNode
}) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-700">{baslik}</span>
        {metrik.durum === 'yetersiz' && (
          <Badge variant="outline" className="shrink-0 gap-1 border-amber-200 bg-amber-50 text-amber-800">
            <AlertTriangle className="h-3 w-3" />
            Yetersiz veri
          </Badge>
        )}
      </div>
      {metrik.durum === 'yetersiz' ? (
        <p className="mt-1 text-xs text-slate-500">{metrik.sebep}</p>
      ) : (
        <div className="mt-2 space-y-2">
          {children(metrik.veri)}
          {metrik.not && <p className="text-xs text-slate-400">{metrik.not}</p>}
        </div>
      )}
    </div>
  )
}

function Iskelet() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[86px] animate-pulse rounded-lg border bg-slate-50" />
        ))}
      </div>
      <div className="h-[200px] animate-pulse rounded-md border bg-slate-50" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-[180px] animate-pulse rounded-md border bg-slate-50" />
        <div className="h-[180px] animate-pulse rounded-md border bg-slate-50" />
      </div>
    </div>
  )
}

// ── Ana bileşen ──

export function RmaKpiDialog({
  open,
  onOpenChange,
  filtreParams,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  /** Listede o an aktif olan filtre query-string'i (buildFilterParams çıktısı). */
  filtreParams: string
}) {
  const [data, setData] = useState<RmaKpi | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const yukle = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setErr(null)
    try {
      const res = await fetch(`/api/quality/rma/kpi${filtreParams ? `?${filtreParams}` : ''}`, { signal })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e?.error ?? `KPI alınamadı (HTTP ${res.status})`)
      }
      const json: RmaKpi = await res.json()
      if (!signal?.aborted) setData(json)
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return
      setErr(e instanceof Error ? e.message : 'KPI alınamadı')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [filtreParams])

  // LAZY: yalnız açılışta çeker. Kapanınca state sıfırlanır → art arda açılışta
  // BAYAT VERİ GÖSTERİLMEZ (önceki filtrenin sonucu ekranda kalmaz).
  useEffect(() => {
    if (!open) {
      setData(null)
      setErr(null)
      setLoading(false)
      return
    }
    const ac = new AbortController()
    void yukle(ac.signal)
    return () => ac.abort()
  }, [open, yukle])

  const bosKume = data !== null && data.toplam.kayit === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>RMA/SMA KPI</DialogTitle>
          <DialogDescription>
            {data
              ? `${data.filtreAktif ? 'Aktif filtreye göre' : 'Tüm kayıtlar'} · ${data.toplam.kayit} kayıt`
              : 'Hesaplanıyor…'}
          </DialogDescription>
        </DialogHeader>

        {loading && !data && <Iskelet />}

        {err && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <span className="min-w-0 truncate">{err}</span>
            <Button variant="outline" size="sm" className="shrink-0" onClick={() => void yukle()} disabled={loading}>
              {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RotateCw className="mr-1 h-4 w-4" />}
              Tekrar dene
            </Button>
          </div>
        )}

        {/* Sıfır kayıt: boş kart yığını YERİNE tek mesaj. */}
        {bosKume && !err && (
          <p className="py-10 text-center text-sm text-slate-500">Seçili filtreye uyan kayıt yok.</p>
        )}

        {data && !bosKume && !err && (
          <div className="space-y-6">
            {/* ── GENEL ── */}
            <section className="space-y-3">
              <BolumBaslik>Genel</BolumBaslik>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatKart baslik="Toplam kayıt" deger={data.toplam.kayit} />
                <StatKart baslik="Toplam satır" deger={data.toplam.satir} />
                <StatKart baslik="Toplam iade miktarı" deger={data.toplam.iadeMiktari} />
                <StatKart baslik="Kayıt başına satır" deger={data.toplam.ortSatirPerKayit} alt="ortalama" />
              </div>
              <div className="space-y-1.5">
                {data.tipKirilim.map((t) => (
                  <OranSatiri key={t.tip} etiket={t.tip} adet={t.adet} yuzdeDeger={t.yuzde} />
                ))}
              </div>
            </section>

            {/* ── AYLIK ── */}
            <section className="space-y-2">
              <BolumBaslik>Aylık iade — son 12 ay (irsaliye tarihi)</BolumBaslik>
              <div className="rounded-md border p-2">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.aylik} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                    <Tooltip formatter={(v: number) => [`${v} kayıt`, 'Adet']} />
                    <Bar dataKey="adet" fill={NAVY} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* ── EN ÇOK İADE ── */}
            <section className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <BolumBaslik>Müşteri — ilk 10 (kayıt adedine göre)</BolumBaslik>
                {data.topMusteri.length === 0 ? (
                  <p className="text-sm text-slate-500">Kayıt yok.</p>
                ) : (
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-500">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Kod</th>
                          <th className="px-3 py-2 text-left font-medium">Müşteri</th>
                          <th className="px-3 py-2 text-right font-medium">Kayıt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.topMusteri.map((m) => (
                          <tr key={m.musteriId} className="border-t">
                            <td className="px-3 py-1.5 font-mono text-xs text-slate-600">{m.kod}</td>
                            <td className="px-3 py-1.5 text-slate-800">{m.ad}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{m.kayit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <BolumBaslik>Ürün kodu — ilk 10 (tekrar eden)</BolumBaslik>
                {data.topUrun.length === 0 ? (
                  <p className="text-sm text-slate-500">Satır yok.</p>
                ) : (
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-500">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Ürün kodu</th>
                          <th className="px-3 py-2 text-right font-medium">Satır</th>
                          <th className="px-3 py-2 text-right font-medium">Miktar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.topUrun.map((u) => (
                          <tr key={u.urunKodu} className="border-t">
                            <td className="px-3 py-1.5 font-mono text-xs text-slate-800">{u.urunKodu}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{u.satir}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{u.miktar}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>

            {/* ── KARAR & SONUÇ ── */}
            <section className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <BolumBaslik>Karar dağılımı (satır bazlı)</BolumBaslik>
                {data.kararDagilim.length === 0 ? (
                  <p className="text-sm text-slate-500">Satır yok.</p>
                ) : (
                  <div className="space-y-1.5">
                    {data.kararDagilim.map((k) => (
                      <OranSatiri
                        key={k.karar ?? 'yok'}
                        etiket={k.karar ? RMA_KARAR_LABELS[k.karar] : 'Karar bekliyor'}
                        adet={k.adet}
                        yuzdeDeger={k.yuzde}
                      />
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <BolumBaslik>Hurda / Rework / Müşteri İade</BolumBaslik>
                <div className="grid grid-cols-3 gap-3">
                  <StatKart
                    baslik="Hurda adedi"
                    deger={data.hurdaRework.hurda}
                    alt={`iade miktarının ${yuzdeMetni(data.hurdaRework.hurdaOran, data.hurdaRework.hurda)}'i`}
                  />
                  <StatKart
                    baslik="Rework adedi"
                    deger={data.hurdaRework.rework}
                    alt={`iade miktarının ${yuzdeMetni(data.hurdaRework.reworkOran, data.hurdaRework.rework)}'i`}
                  />
                  <StatKart
                    baslik="Müşteri iade adedi"
                    deger={data.hurdaRework.musteriIade}
                    alt={`iade miktarının ${yuzdeMetni(data.hurdaRework.musteriIadeOran, data.hurdaRework.musteriIade)}'i`}
                  />
                </div>
              </div>
            </section>

            {/* ── EŞİĞE TAKILANLAR / AÇILANLAR ── */}
            <section className="space-y-2">
              <BolumBaslik>Veri doluluğuna bağlı metrikler</BolumBaslik>
              <div className="grid gap-2 lg:grid-cols-2">
                <MetrikBlok baslik="Ortalama kapanma süresi" metrik={data.yetersiz.kapanmaSuresi}>
                  {(v) => (
                    <div className="grid grid-cols-2 gap-3">
                      <StatKart baslik="Ortalama" deger={`${v.ortalamaGun} gün`} alt={`${v.kapaliSayi} kapalı kayıt`} />
                      <StatKart baslik="Medyan" deger={`${v.medyanGun} gün`} />
                    </div>
                  )}
                </MetrikBlok>

                <MetrikBlok baslik="Açık / Kapalı oranı" metrik={data.yetersiz.acikKapali}>
                  {(v) => (
                    <div className="space-y-1.5">
                      {v.dagilim.map((d) => (
                        <OranSatiri
                          key={d.durum}
                          etiket={RMA_DURUM_LABELS[d.durum]}
                          adet={d.adet}
                          yuzdeDeger={d.yuzde}
                        />
                      ))}
                    </div>
                  )}
                </MetrikBlok>

                <MetrikBlok baslik="İade türü dağılımı" metrik={data.yetersiz.iadeTuru}>
                  {(v) => (
                    <div className="space-y-1.5">
                      {v.dagilim.map((d) => (
                        <OranSatiri
                          key={d.iadeTuru}
                          etiket={RMA_IADE_TURU_LABELS[d.iadeTuru]}
                          adet={d.adet}
                          yuzdeDeger={d.yuzde}
                        />
                      ))}
                    </div>
                  )}
                </MetrikBlok>

                <MetrikBlok baslik="Sorumlu bazlı yük" metrik={data.yetersiz.sorumluYuk}>
                  {(v) => (
                    <div className="space-y-1.5">
                      {v.dagilim.map((d) => (
                        <OranSatiri
                          key={d.sorumluId}
                          etiket={d.ad}
                          adet={d.adet}
                          yuzdeDeger={data.toplam.kayit > 0 ? Math.round((d.adet / data.toplam.kayit) * 1000) / 10 : 0}
                        />
                      ))}
                    </div>
                  )}
                </MetrikBlok>

                <MetrikBlok baslik="Kök neden dağılımı" metrik={data.yetersiz.kokNeden}>
                  {(v) => (
                    <div className="space-y-1.5">
                      {v.dagilim.map((d) => (
                        <OranSatiri
                          key={d.kokNeden}
                          etiket={d.kokNeden}
                          adet={d.adet}
                          yuzdeDeger={data.toplam.satir > 0 ? Math.round((d.adet / data.toplam.satir) * 1000) / 10 : 0}
                        />
                      ))}
                    </div>
                  )}
                </MetrikBlok>
              </div>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
