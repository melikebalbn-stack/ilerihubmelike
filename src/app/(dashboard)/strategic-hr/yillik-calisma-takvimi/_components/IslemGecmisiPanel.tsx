'use client'

import { useCallback, useEffect, useState } from 'react'
import { Clock3, Loader2 } from 'lucide-react'

interface HistoryEntry { action: string; label: string; timestamp: string; actorName: string; details: string[] }
export interface HistorySummary { creatorName: string; createdAt: string; updatedAt: string }
export function IslemGecmisiPanel({ kayitId, refreshKey = 0, onSummaryChange }: { kayitId: string; refreshKey?: number; onSummaryChange?: (summary: HistorySummary | null) => void }) {
  const [items, setItems] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const response = await fetch(`/api/strategic-hr/yillik-calisma-takvimi/${kayitId}/gecmis`)
      const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'İşlem geçmişi alınamadı')
      setItems(body.data ?? [])
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'İşlem geçmişi alınamadı') }
    finally { setLoading(false) }
  }, [kayitId])
  useEffect(() => { void load() }, [load, refreshKey])
  useEffect(() => {
    if (items.length === 0) { onSummaryChange?.(null); return }
    const chronological = [...items].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    const created = chronological.find(item => item.action === 'OLUSTUR') ?? chronological[0]
    onSummaryChange?.({ creatorName: created.actorName, createdAt: created.timestamp, updatedAt: chronological.at(-1)!.timestamp })
  }, [items, onSummaryChange])
  return <section className="mt-6 space-y-3 border-t pt-5">
    <h3 className="font-semibold">İşlem Geçmişi</h3>
    {loading && <Loader2 className="h-5 w-5 animate-spin" />}
    {!loading && items.length === 0 && <p className="text-sm text-muted-foreground">İşlem geçmişi bulunmuyor.</p>}
    <div className="space-y-0">{items.map((item, index) => <div key={`${item.timestamp}-${index}`} className="relative border-l-2 border-muted pb-4 pl-5 last:pb-0"><span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-background bg-[#1B4F72]" /><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">{item.label}</p><time className="flex items-center text-xs text-muted-foreground"><Clock3 className="mr-1 h-3 w-3" />{new Date(item.timestamp).toLocaleString('tr-TR')}</time></div><p className="text-xs text-muted-foreground">{item.actorName}</p>{item.details.map(detail => <p key={detail} className="mt-1 text-xs">{detail}</p>)}</div>)}</div>
    {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</p>}
  </section>
}
