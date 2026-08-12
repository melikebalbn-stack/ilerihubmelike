'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { BookOpen, CalendarX2, ChevronLeft, ChevronRight, FileDown, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AY_ISIMLERI, DURUM_META } from './constants'
import { AylikTakvim } from './AylikTakvim'
import { YillikTakvimListView } from './YillikTakvimListView'
import { BOS_FILTRE, YillikTakvimFilterBar, type YillikTakvimFilters } from './YillikTakvimFilterBar'
import { getAnaSorumluAdi, getKayitTarihi, type YillikTakvimKaydiRow } from './types'
import { YillikTakvimCreateDialog } from './YillikTakvimCreateDialog'
import { YillikTakvimDetailSheet } from './YillikTakvimDetailSheet'
import { calculateYillikTakvimSummary } from './summary'
import { YillikTakvimSummaryCards } from './YillikTakvimSummaryCards'
import { exportYillikTakvimToExcel } from '@/lib/yillik-calisma-takvimi/excel'
import { YillikTakvimKullanimKilavuzu } from './YillikTakvimKullanimKilavuzu'

export function YillikTakvimClient() {
  const { data: session } = useSession()
  const [yil, setYil] = useState(new Date().getFullYear())
  const [rows, setRows] = useState<YillikTakvimKaydiRow[]>([])
  const [filters, setFilters] = useState<YillikTakvimFilters>(BOS_FILTRE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const permissions = session?.user?.permissions ?? []
  const canCreate = permissions.includes('yilliktakvim.create') || permissions.includes('yilliktakvim.admin')
  const canExport = permissions.includes('yilliktakvim.view') || permissions.includes('yilliktakvim.admin')
  const openDetail = (id: string) => { setSelectedId(id); setDetailOpen(true) }

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
  }, [yil, refreshKey])

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
  const summary = useMemo(() => calculateYillikTakvimSummary(rows, yil), [rows, yil])

  async function handleExport() {
    setExporting(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 0))
      exportYillikTakvimToExcel(filtered.map(row => ({
        anaKonu: row.anaKonu, surec: row.surec, kisaBaslik: row.kisaBaslik,
        sorumluAdi: getAnaSorumluAdi(row), departmentAdi: row.department?.name ?? '',
        plananUygulamaTarihi: row.plananUygulamaTarihi, nihaiSonTarih: row.nihaiSonTarih,
        periyot: row.periyot, oncelik: row.oncelik, durum: row.durum,
        gerceklesmeDurumu: row.gerceklesmeDurumu, gerceklesmeTarihi: row.gerceklesmeTarihi,
        iptalMi: row.iptalMi, kalanGun: row.kalanGun,
      })), yil)
      toast.success('Excel dosyası hazırlandı')
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Excel dosyası oluşturulamadı')
    } finally { setExporting(false) }
  }

  return <div className="space-y-4">
    <div className="grid grid-cols-3 items-center gap-3">
      <div><Button type="button" variant="outline" onClick={() => setGuideOpen(true)}><BookOpen className="mr-1 h-4 w-4" />Kullanım Kılavuzu</Button></div>
      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" size="icon" onClick={() => setYil(value => value - 1)} aria-label="Önceki yıl"><ChevronLeft className="h-4 w-4" /></Button>
        <span className="min-w-20 text-center text-xl font-bold text-[#1B4F72]">{yil}</span>
        <Button variant="outline" size="icon" onClick={() => setYil(value => value + 1)} aria-label="Sonraki yıl"><ChevronRight className="h-4 w-4" /></Button>
      </div>
      <div className="flex justify-end">{canCreate && <Button type="button" onClick={() => setCreateOpen(true)}><Plus className="mr-1 h-4 w-4" />Yeni Kayıt</Button>}</div>
    </div>
    {!loading && !error && <YillikTakvimSummaryCards items={summary} />}
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <YillikTakvimFilterBar value={filters} anaKonular={anaKonular} sorumlular={sorumlular} onChange={setFilters} />
      {canExport && <Button type="button" variant="outline" disabled={exporting || filtered.length === 0} onClick={() => void handleExport()}>{exporting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileDown className="mr-1 h-4 w-4" />}Excel&apos;e Aktar</Button>}
    </div>
    {loading && <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}
    {!loading && error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    {!loading && !error && rows.length === 0 && <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground"><CalendarX2 className="h-9 w-9" /><p>Bu yıl için kayıt yok</p></div>}
    {!loading && !error && rows.length > 0 && <Tabs defaultValue="yillik">
      <TabsList><TabsTrigger value="yillik">Yıllık Görünüm</TabsTrigger><TabsTrigger value="liste">Liste Görünümü</TabsTrigger><TabsTrigger value="aylik">Aylık Takvim</TabsTrigger></TabsList>
      <TabsContent value="yillik" className="mt-4 space-y-3">
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[1020px] text-sm"><thead><tr className="bg-slate-50 dark:bg-slate-900">
            <th className="p-2 text-left">Ana Konu</th><th className="p-2 text-left">Süreç</th><th className="p-2 text-left">Sorumlu</th>
            {AY_ISIMLERI.map(ay => <th key={ay} className="p-2 text-center">{ay.slice(0, 3)}</th>)}<th className="p-2 text-left">Durum</th>
          </tr></thead><tbody>
            {[...gruplar].map(([anaKonu, kayitlar]) => <Fragment key={anaKonu}>
              <tr className="bg-[#1B4F72]/5"><td colSpan={16} className="p-2 font-semibold text-[#1B4F72]">{anaKonu}</td></tr>
              {kayitlar.map(row => { const tarih = getKayitTarihi(row); return <tr key={row.id} className="cursor-pointer border-t hover:bg-accent/50" onClick={() => openDetail(row.id)}>
                <td className="p-2 font-medium text-[#1B4F72]">{row.anaKonu}</td><td className="p-2">{row.kisaBaslik || row.surec}</td><td className="p-2">{getAnaSorumluAdi(row)}</td>
                {AY_ISIMLERI.map((_, ay) => <td key={ay} className="p-2 text-center">{tarih?.getMonth() === ay
                  ? <span
                      aria-label={`${DURUM_META[row.durum].label}, ayın ${tarih.getDate()}. günü`}
                      className={`mx-auto block h-3 w-3 rounded-full ${DURUM_META[row.durum].dot}`}
                      title={`Ayın ${tarih.getDate()}. günü · ${DURUM_META[row.durum].label}`}
                    />
                  : null}</td>)}
                <td className="p-2"><span className={`inline-flex rounded px-2 py-1 text-xs ${DURUM_META[row.durum].className}`}>{DURUM_META[row.durum].label}</span></td>
              </tr>})}
            </Fragment>)}
          </tbody></table>
        </div>
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
          <div aria-label="Durum lejantı" className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {Object.entries(DURUM_META).map(([durum, meta]) => <span key={durum} className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />{meta.label}
            </span>)}
          </div>
          <p className="shrink-0 font-medium text-foreground">Toplam: {filtered.length} kayıt</p>
        </div>
      </TabsContent>
      <TabsContent value="liste" className="mt-4"><YillikTakvimListView rows={filtered} onRowClick={openDetail} /></TabsContent>
      <TabsContent value="aylik" className="mt-4"><AylikTakvim rows={filtered} yil={yil} onRowClick={openDetail} /></TabsContent>
    </Tabs>}
    <YillikTakvimCreateDialog open={createOpen} onOpenChange={setCreateOpen} yil={yil} onCreated={() => setRefreshKey(value => value + 1)} />
    <YillikTakvimDetailSheet kayitId={selectedId} open={detailOpen} onOpenChange={setDetailOpen} onUpdated={() => setRefreshKey(value => value + 1)} />
    <YillikTakvimKullanimKilavuzu open={guideOpen} onOpenChange={setGuideOpen} />
  </div>
}
