'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import { OeeHalka, esikRenk, yuzdeMetin } from '@/components/ipro/OeeHalka'

type Metrik = { availability: number | null; performance: number | null; quality: number | null; oee: number | null }
type ParetoSatiri = { ad: string; deger: number; kumulatifYuzde: number; tezgahDagilim?: { kod: string; deger: number }[] }
type TezgahSatiri = Metrik & { kod: string; bolum: string | null; adet: number; hurda: number; durusDk: number; cevrimDurum: 'TANIMSIZ' | 'YAVAŞ' | 'HIZLI' | null }
type AnalizData = {
  donem: Metrik & { oncekiFark: Metrik }
  trend: (Metrik & { etiket: string })[]
  durusPareto: { plansiz: ParetoSatiri[]; planli: ParetoSatiri[] }
  hurdaPareto: { kayit: ParetoSatiri[]; adet: ParetoSatiri[] }
  tezgahlar: TezgahSatiri[]
  cevrimRaporId: string | null
  secenekler: { vardiyalar: { id: string; ad: string }[]; bolumler: string[]; tezgahlar: string[] }
}

const isoGun = (d: Date) => d.toISOString().slice(0, 10)
const trGun = (iso: string) => { const [y, m, g] = iso.split('-'); return `${g}.${m}.${y}` }

function fark(v: number | null) {
  if (v == null) return { metin: '—', renk: '#5b6472' }
  const puan = v * 100
  const isaret = puan >= 0 ? '+' : '−'
  return { metin: `${isaret}${Math.abs(puan).toFixed(1).replace('.', ',')} puan`, renk: puan >= 0 ? '#15803d' : '#b91c1c' }
}

const CIZGI = { oee: '#1d4ed8', availability: '#0f766e', performance: '#c2410c', quality: '#7c3aed' } as const

export function AnalizClient() {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()

  // Varsayılan son 30 gün (URL boşsa)
  const bugun = useMemo(() => new Date(), [])
  const bas = sp.get('bas') || isoGun(new Date(bugun.getTime() - 30 * 86400000))
  const bit = sp.get('bit') || isoGun(bugun)
  const gruplama = sp.get('gruplama') || 'gun'
  const vardiya = sp.get('vardiya') || ''
  const bolum = sp.get('bolum') || ''
  const tezgah = sp.get('tezgah') || ''

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    p.set('bas', bas); p.set('bit', bit); p.set('gruplama', gruplama)
    if (vardiya) p.set('vardiya', vardiya)
    if (bolum) p.set('bolum', bolum)
    if (tezgah) p.set('tezgah', tezgah)
    return p.toString()
  }, [bas, bit, gruplama, vardiya, bolum, tezgah])

  const setParam = useCallback((k: string, v: string) => {
    const p = new URLSearchParams(sp.toString())
    if (v) p.set(k, v); else p.delete(k)
    router.push(`${pathname}?${p.toString()}`)
  }, [sp, router, pathname])

  const [data, setData] = useState<AnalizData | null>(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)
  const [durusMod, setDurusMod] = useState<'plansiz' | 'planli'>('plansiz')
  const [hurdaMod, setHurdaMod] = useState<'kayit' | 'adet'>('kayit')
  const [acikDurus, setAcikDurus] = useState<string | null>(null)
  const [sirala, setSirala] = useState<{ alan: keyof TezgahSatiri; yon: 1 | -1 }>({ alan: 'oee', yon: -1 })

  useEffect(() => {
    let iptal = false
    setYukleniyor(true); setHata(null)
    fetch(`/api/ipro/analiz?${qs}`)
      .then((r) => r.json())
      .then((j) => { if (iptal) return; if (j.ok) setData(j); else setHata(j.error || 'Veri alınamadı') })
      .catch(() => { if (!iptal) setHata('Veri alınamadı') })
      .finally(() => { if (!iptal) setYukleniyor(false) })
    return () => { iptal = true }
  }, [qs])

  const kpis = data ? [
    { ad: 'OEE', v: data.donem.oee, f: data.donem.oncekiFark.oee },
    { ad: 'Kullanılabilirlik', v: data.donem.availability, f: data.donem.oncekiFark.availability },
    { ad: 'Performans', v: data.donem.performance, f: data.donem.oncekiFark.performance },
    { ad: 'Kalite', v: data.donem.quality, f: data.donem.oncekiFark.quality },
  ] : []

  const trendVeri = (data?.trend ?? []).map((t) => ({
    etiket: t.etiket,
    OEE: t.oee != null ? +(t.oee * 100).toFixed(1) : null,
    Kullanılabilirlik: t.availability != null ? +(t.availability * 100).toFixed(1) : null,
    Performans: t.performance != null ? +(t.performance * 100).toFixed(1) : null,
    Kalite: t.quality != null ? +(t.quality * 100).toFixed(1) : null,
  }))

  const durusSatir = data ? data.durusPareto[durusMod] : []
  const hurdaSatir = data ? data.hurdaPareto[hurdaMod] : []
  const durusMax = durusSatir[0]?.deger || 1
  const hurdaMax = hurdaSatir[0]?.deger || 1

  const tezgahlar = useMemo(() => {
    if (!data) return []
    const arr = [...data.tezgahlar]
    arr.sort((a, b) => {
      const av = a[sirala.alan], bv = b[sirala.alan]
      if (typeof av === 'string' || typeof bv === 'string') return String(av).localeCompare(String(bv), 'tr') * sirala.yon
      return (((av as number) ?? -1) - ((bv as number) ?? -1)) * sirala.yon
    })
    return arr
  }, [data, sirala])

  const sirBaslik = (alan: keyof TezgahSatiri, ad: string, saga = true) => (
    <button type="button" onClick={() => setSirala((s) => ({ alan, yon: s.alan === alan && s.yon === -1 ? 1 : -1 }))}
      className={`flex w-full items-center gap-1 text-xs font-medium text-slate-500 ${saga ? 'justify-end' : ''}`}>
      {ad}{sirala.alan === alan ? <span>{sirala.yon === -1 ? '↓' : '↑'}</span> : null}
    </button>
  )

  const cevrimRozet = (t: TezgahSatiri) => {
    if (!t.cevrimDurum || t.cevrimDurum === 'HIZLI') return null
    const tanimsiz = t.cevrimDurum === 'TANIMSIZ'
    const stil = tanimsiz ? { c: '#991b1b', bg: '#fee2e2' } : { c: '#92400e', bg: '#fef3c7' }
    const metin = tanimsiz ? 'Çevrim tanımsız' : 'Çevrim bayat'
    const govde = (
      <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold" style={{ color: stil.c, background: stil.bg }}>
        {metin}{data?.cevrimRaporId ? ' ↗' : ''}
      </span>
    )
    return data?.cevrimRaporId ? <Link href={`/raporlar/${data.cevrimRaporId}`}>{govde}</Link> : govde
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Süzgeçler */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[#dde1e7] bg-white p-4">
        <label className="flex flex-col gap-1 text-xs text-slate-500">Başlangıç
          <input type="date" value={bas} onChange={(e) => setParam('bas', e.target.value)} className="h-9 rounded-lg border border-[#cfd5dd] px-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">Bitiş
          <input type="date" value={bit} onChange={(e) => setParam('bit', e.target.value)} className="h-9 rounded-lg border border-[#cfd5dd] px-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">Gruplama
          <select value={gruplama} onChange={(e) => setParam('gruplama', e.target.value)} className="h-9 rounded-lg border border-[#cfd5dd] bg-white px-2 text-sm">
            <option value="gun">Gün</option><option value="vardiya">Vardiya</option><option value="hafta">Hafta</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">Vardiya
          <select value={vardiya} onChange={(e) => setParam('vardiya', e.target.value)} className="h-9 rounded-lg border border-[#cfd5dd] bg-white px-2 text-sm">
            <option value="">Tümü</option>
            {data?.secenekler.vardiyalar.map((v) => <option key={v.id} value={v.id}>{v.ad}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">Bölüm
          <select value={bolum} onChange={(e) => setParam('bolum', e.target.value)} className="h-9 rounded-lg border border-[#cfd5dd] bg-white px-2 text-sm">
            <option value="">Tümü</option>
            {data?.secenekler.bolumler.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">Tezgah
          <select value={tezgah} onChange={(e) => setParam('tezgah', e.target.value)} className="h-9 rounded-lg border border-[#cfd5dd] bg-white px-2 text-sm">
            <option value="">Tümü</option>
            {data?.secenekler.tezgahlar.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <div className="grow" />
        <span className="pb-2 text-xs text-slate-500">Karşılaştırma: önceki eşit dönem</span>
        <a href={`/api/ipro/analiz/excel?${qs}`} className="flex overflow-hidden rounded-lg border border-[#cfd5dd] bg-white text-sm">
          <span className="border-r border-[#cfd5dd] px-3 py-2 text-slate-500">Excel</span>
          <span className="px-3 py-2 font-semibold">İndir ↗</span>
        </a>
      </div>

      {hata ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{hata}</div> : null}

      {/* KPI kartları */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(kpis.length ? kpis : Array.from({ length: 4 })).map((k: unknown, i) => {
          const kk = k as { ad: string; v: number | null; f: number | null } | undefined
          const ff = kk ? fark(kk.f) : null
          return (
            <div key={i} className="flex items-center gap-4 rounded-xl border border-[#dde1e7] bg-white p-5">
              <OeeHalka deger={kk?.v ?? null} />
              <div className="flex flex-col gap-0.5">
                <div className="text-sm font-medium text-slate-500">{kk?.ad ?? '—'}</div>
                <div className="font-mono text-3xl font-semibold tabular-nums tracking-tight" style={{ color: esikRenk(kk?.v ?? null) }}>{yuzdeMetin(kk?.v ?? null)}</div>
                {ff ? <div className="text-xs font-semibold" style={{ color: ff.renk }}>{ff.metin} <span className="font-normal text-slate-500">önceki döneme göre</span></div> : null}
              </div>
            </div>
          )
        })}
      </div>

      {/* OEE trendi */}
      <div className="rounded-xl border border-[#dde1e7] bg-white p-5">
        <div className="mb-3 text-base font-semibold">OEE trendi <span className="text-xs font-normal text-slate-500">· hedef %85</span></div>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <LineChart data={trendVeri} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="#eceef2" vertical={false} />
              <XAxis dataKey="etiket" tick={{ fontSize: 11, fill: '#5b6472' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#5b6472' }} tickFormatter={(v) => `%${v}`} />
              <Tooltip formatter={(v: number) => `%${v}`} />
              <ReferenceLine y={85} stroke="#8a93a1" strokeDasharray="5 5" />
              <Line type="monotone" dataKey="Kalite" stroke={CIZGI.quality} strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="Kullanılabilirlik" stroke={CIZGI.availability} strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="Performans" stroke={CIZGI.performance} strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="OEE" stroke={CIZGI.oee} strokeWidth={3} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Paretolar */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Duruş */}
        <div className="flex flex-col gap-3 rounded-xl border border-[#dde1e7] bg-white p-5">
          <div className="flex items-center justify-between">
            <div className="text-base font-semibold">Duruş Pareto</div>
            <div className="flex gap-0.5 rounded-lg bg-[#f1f3f6] p-0.5">
              {(['plansiz', 'planli'] as const).map((m) => (
                <button key={m} type="button" onClick={() => setDurusMod(m)}
                  className={`rounded-md px-3 py-1.5 text-sm ${durusMod === m ? 'bg-white font-semibold shadow-sm' : 'text-slate-500'}`}>
                  {m === 'plansiz' ? 'Plansız' : 'Planlı'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            {durusSatir.length === 0 ? <div className="text-sm text-slate-400">Kayıt yok</div> : null}
            {durusSatir.map((d) => (
              <div key={d.ad}>
                <button type="button" onClick={() => setAcikDurus(acikDurus === d.ad ? null : d.ad)}
                  className="grid w-full grid-cols-[180px_1fr_60px_48px] items-center gap-3 py-1 text-left text-sm">
                  <span className="truncate">{d.ad}</span>
                  <span className="h-3.5 rounded bg-[#f1f3f6]"><span className="block h-3.5 rounded" style={{ width: `${(d.deger / durusMax) * 100}%`, background: '#c2410c' }} /></span>
                  <span className="text-right font-mono tabular-nums">{d.deger}</span>
                  <span className="text-right font-mono tabular-nums text-slate-500">%{d.kumulatifYuzde}</span>
                </button>
                {acikDurus === d.ad && d.tezgahDagilim?.length ? (
                  <div className="mb-1 ml-2 flex flex-wrap gap-2 border-l-2 border-[#eceef2] pl-3 pt-1">
                    {d.tezgahDagilim.map((td) => (
                      <span key={td.kod} className="rounded bg-[#f1f3f6] px-2 py-0.5 text-xs"><span className="font-mono font-semibold">{td.kod}</span> {td.deger} dk</span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <div className="text-xs text-slate-500">Satıra tıklayınca o sebebin tezgah dağılımı açılır (dk).</div>
        </div>

        {/* Hurda */}
        <div className="flex flex-col gap-3 rounded-xl border border-[#dde1e7] bg-white p-5">
          <div className="flex items-center justify-between">
            <div className="text-base font-semibold">Hurda Pareto</div>
            <div className="flex gap-0.5 rounded-lg bg-[#f1f3f6] p-0.5">
              {(['kayit', 'adet'] as const).map((m) => (
                <button key={m} type="button" onClick={() => setHurdaMod(m)}
                  className={`rounded-md px-3 py-1.5 text-sm ${hurdaMod === m ? 'bg-white font-semibold shadow-sm' : 'text-slate-500'}`}>
                  {m === 'kayit' ? 'Kayıt' : 'Adet'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            {hurdaSatir.length === 0 ? <div className="text-sm text-slate-400">Kayıt yok</div> : null}
            {hurdaSatir.map((h) => (
              <div key={h.ad} className="grid grid-cols-[180px_1fr_60px_48px] items-center gap-3 py-1 text-sm">
                <span className="truncate">{h.ad}</span>
                <span className="h-3.5 rounded bg-[#f1f3f6]"><span className="block h-3.5 rounded" style={{ width: `${(h.deger / hurdaMax) * 100}%`, background: '#7c3aed' }} /></span>
                <span className="text-right font-mono tabular-nums">{h.deger}</span>
                <span className="text-right font-mono tabular-nums text-slate-500">%{h.kumulatifYuzde}</span>
              </div>
            ))}
          </div>
          <div className="text-xs text-slate-500">MAS hurda, rework hariç. Kayıt / adet ile sıralama.</div>
        </div>
      </div>

      {/* Tezgah tablosu */}
      <div className="rounded-xl border border-[#dde1e7] bg-white p-5">
        <div className="mb-2 text-base font-semibold">Tezgah bazında <span className="text-xs font-normal text-slate-500">· satıra tıkla → tezgah detayı · başlıkla sırala</span></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-[#dde1e7]">
                <th className="px-2.5 py-2 text-left">{sirBaslik('kod', 'Tezgah', false)}</th>
                <th className="px-2.5 py-2 text-left">{sirBaslik('bolum', 'Bölüm', false)}</th>
                <th className="px-2.5 py-2">{sirBaslik('oee', 'OEE')}</th>
                <th className="px-2.5 py-2">{sirBaslik('availability', 'Kullan.')}</th>
                <th className="px-2.5 py-2">{sirBaslik('performance', 'Perf.')}</th>
                <th className="px-2.5 py-2">{sirBaslik('quality', 'Kalite')}</th>
                <th className="px-2.5 py-2">{sirBaslik('adet', 'Adet')}</th>
                <th className="px-2.5 py-2">{sirBaslik('hurda', 'Hurda')}</th>
                <th className="px-2.5 py-2">{sirBaslik('durusDk', 'Duruş dk')}</th>
                <th className="px-2.5 py-2 text-left text-xs font-medium text-slate-500">Çevrim</th>
              </tr>
            </thead>
            <tbody>
              {tezgahlar.map((t) => (
                <tr key={t.kod} className="border-b border-[#eceef2] hover:bg-[#f8f9fb]">
                  <td className="px-2.5 py-2.5 font-mono font-semibold">
                    <Link href={`/ipro/izleme?tezgah=${encodeURIComponent(t.kod)}`} className="text-[#1d4ed8] hover:underline">{t.kod}</Link>
                  </td>
                  <td className="px-2.5 py-2.5 text-slate-600">{t.bolum ?? '—'}</td>
                  <td className="px-2.5 py-2.5 text-right font-mono font-semibold tabular-nums" style={{ color: esikRenk(t.oee) }}>{yuzdeMetin(t.oee)}</td>
                  <td className="px-2.5 py-2.5 text-right font-mono tabular-nums">{yuzdeMetin(t.availability)}</td>
                  <td className="px-2.5 py-2.5 text-right font-mono tabular-nums">{yuzdeMetin(t.performance)}</td>
                  <td className="px-2.5 py-2.5 text-right font-mono tabular-nums">{yuzdeMetin(t.quality)}</td>
                  <td className="px-2.5 py-2.5 text-right font-mono tabular-nums">{t.adet.toLocaleString('tr-TR')}</td>
                  <td className="px-2.5 py-2.5 text-right font-mono tabular-nums">{t.hurda}</td>
                  <td className="px-2.5 py-2.5 text-right font-mono tabular-nums">{t.durusDk}</td>
                  <td className="px-2.5 py-2.5">{cevrimRozet(t)}</td>
                </tr>
              ))}
              {tezgahlar.length === 0 && !yukleniyor ? <tr><td colSpan={10} className="px-2.5 py-6 text-center text-slate-400">Seçili dönemde kayıt yok</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-xs text-slate-500">Çevrim rozeti "IPRO Çevrim Sapma" raporuna gider. Tarih {trGun(bas)} – {trGun(bit)}.</div>
      </div>

      {yukleniyor ? <div className="text-center text-sm text-slate-400">Yükleniyor…</div> : null}
    </div>
  )
}
