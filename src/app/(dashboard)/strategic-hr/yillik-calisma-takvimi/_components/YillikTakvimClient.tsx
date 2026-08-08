'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { CalendarX2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AY_ISIMLERI, DURUM_META } from './constants'
import { AylikTakvim } from './AylikTakvim'
import { YillikTakvimListView } from './YillikTakvimListView'
import { BOS_FILTRE, YillikTakvimFilterBar, type YillikTakvimFilters } from './YillikTakvimFilterBar'
import { getAnaSorumluAdi, getKayitTarihi, type YillikTakvimKaydiRow } from './types'

export function YillikTakvimClient() {
  const [yil, setYil] = useState(new Date().getFullYear())
  const [rows, setRows] = useState<YillikTakvimKaydiRow[]>([])
  const [filters, setFilters] = useState<YillikTakvimFilters>(BOS_FILTRE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(null)
    fetch(`/api/strategic-hr/yillik-calisma-takvimi?yil=${yil}`, { signal: controller.signal })
      .then(async response => {
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(body.error || 'Kayıtlar alınamadı')
        setRows(body.data ?? [])
      })
      .catch(reason => { if (reason.name !== 'AbortError') setError(reason.message || 'Kayıtlar alınamadı') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [yil])

  const filtered = useMemo(() => rows.filter(row =>
    (!filters.anaKonu || row.anaKonu === filters.anaKonu) &&
    (!filters.sorumlu || getAnaSorumluAdi(row) === filters.sorumlu) &&
    (!filters.durum || row.durum === filters.durum) &&
    (!filters.periyot || row.periyot === filters.periyot) &&
    (!filters.oncelik || row.oncelik === filters.oncelik)
  ), [rows, filters])
  const anaKonular = useMemo(() => [...new Set(rows.map(row => row.anaKonu))].sort((a, b) => a.localeCompare(b, 'tr')), [rows])
  const sorumlular = useMemo(() => [...new Set(rows.map(getAnaSorumluAdi).filter(value => value !== '—'))].sort((a, b) => a.localeCompare(b, 'tr')), [rows])
  const gruplar = useMemo(() => {
    const result = new Map<string, YillikTakvimKaydiRow[]>()
    for (const row of filtered) result.set(row.anaKonu, [...(result.get(row.anaKonu) ?? []), row])
    return result
  }, [filtered])

  return <div className="space-y-4">
    <div className="flex items-center justify-center gap-3">
      <Button variant="outline" size="icon" onClick={() => setYil(value => value - 1)} aria-label="Önceki yıl"><ChevronLeft className="h-4 w-4" /></Button>
      <span className="min-w-20 text-center text-xl font-bold text-[#1B4F72]">{yil}</span>
      <Button variant="outline" size="icon" onClick={() => setYil(value => value + 1)} aria-label="Sonraki yıl"><ChevronRight className="h-4 w-4" /></Button>
    </div>
    <YillikTakvimFilterBar value={filters} anaKonular={anaKonular} sorumlular={sorumlular} onChange={setFilters} />
    {loading && <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}
    {!loading && error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    {!loading && !error && rows.length === 0 && <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground"><CalendarX2 className="h-9 w-9" /><p>Bu yıl için kayıt yok</p></div>}
    {!loading && !error && rows.length > 0 && <Tabs defaultValue="yillik">
      <TabsList><TabsTrigger value="yillik">Yıllık Görünüm</TabsTrigger><TabsTrigger value="liste">Liste</TabsTrigger><TabsTrigger value="aylik">Aylık</TabsTrigger></TabsList>
      <TabsContent value="yillik" className="mt-4 overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[900px] text-sm"><thead><tr className="bg-slate-50 dark:bg-slate-900">
          <th className="p-2 text-left">Süreç</th><th className="p-2 text-left">Sorumlu</th>
          {AY_ISIMLERI.map(ay => <th key={ay} className="p-2 text-center">{ay.slice(0, 3)}</th>)}<th className="p-2 text-left">Durum</th>
        </tr></thead><tbody>
          {[...gruplar].map(([anaKonu, kayitlar]) => <Fragment key={anaKonu}>
            <tr className="bg-[#1B4F72]/5"><td colSpan={15} className="p-2 font-semibold text-[#1B4F72]">{anaKonu}</td></tr>
            {kayitlar.map(row => { const tarih = getKayitTarihi(row); return <tr key={row.id} className="border-t">
              <td className="p-2">{row.kisaBaslik || row.surec}</td><td className="p-2">{getAnaSorumluAdi(row)}</td>
              {AY_ISIMLERI.map((_, ay) => <td key={ay} className="p-2 text-center">{tarih?.getMonth() === ay ? tarih.getDate() : '—'}</td>)}
              <td className="p-2"><span className={`inline-flex rounded px-2 py-1 text-xs ${DURUM_META[row.durum].className}`}>{DURUM_META[row.durum].label}</span></td>
            </tr>})}
          </Fragment>)}
        </tbody></table>
      </TabsContent>
      <TabsContent value="liste" className="mt-4"><YillikTakvimListView rows={filtered} /></TabsContent>
      <TabsContent value="aylik" className="mt-4"><AylikTakvim rows={filtered} yil={yil} /></TabsContent>
    </Tabs>}
  </div>
}
