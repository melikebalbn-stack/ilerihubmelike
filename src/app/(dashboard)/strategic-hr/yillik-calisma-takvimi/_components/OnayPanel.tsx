'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Clock3, Loader2, RotateCcw, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { YillikTakvimApprovalStep } from './types'

interface ApprovalResponse {
  history: YillikTakvimApprovalStep[]
  currentSteps: YillikTakvimApprovalStep[]
  activeStepId: string | null
  snapshotPending: boolean
  canAct: boolean
  canRevert: boolean
}
export function OnayPanel({ kayitId, onChanged }: { kayitId: string; onChanged: () => void }) {
  const [data, setData] = useState<ApprovalResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [revisionOpen, setRevisionOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [revertOpen, setRevertOpen] = useState(false)
  const [revertReason, setRevertReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const response = await fetch(`/api/strategic-hr/yillik-calisma-takvimi/${kayitId}/onay`)
      const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'Onay bilgileri alınamadı')
      setData(body)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Onay bilgileri alınamadı') }
    finally { setLoading(false) }
  }, [kayitId])
  useEffect(() => { void load() }, [load])

  async function decide(karar: 'ONAYLANDI' | 'REVIZYON_ISTENDI') {
    if (karar === 'REVIZYON_ISTENDI' && !reason.trim()) { setError('Revizyon gerekçesi zorunludur'); return }
    setBusy(true); setError(null)
    try {
      const response = await fetch(`/api/strategic-hr/yillik-calisma-takvimi/${kayitId}/onay`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ karar, yorum: reason.trim() || null }),
      })
      const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'Onay kararı kaydedilemedi')
      toast.success(karar === 'ONAYLANDI' ? 'Onay kararı kaydedildi' : 'Kayıt revizyona gönderildi')
      setRevisionOpen(false); setReason(''); await load(); onChanged()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Onay kararı kaydedilemedi') }
    finally { setBusy(false) }
  }
  async function revertDecision() {
    if (revertReason.trim().length < 3) { setError('Geri alma gerekçesi en az 3 karakter olmalıdır'); return }
    setBusy(true); setError(null)
    try {
      const response = await fetch(`/api/strategic-hr/yillik-calisma-takvimi/${kayitId}/onay/geri-al`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gerekce: revertReason.trim() }),
      })
      const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'Onay kararı geri alınamadı')
      toast.success('Onay kararı geri alındı')
      setRevertOpen(false); setRevertReason(''); await load(); onChanged()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Onay kararı geri alınamadı') }
    finally { setBusy(false) }
  }
  const turns = data ? [...new Set(data.history.map(step => step.tur))].sort((a, b) => b - a) : []
  return <section className="mt-6 space-y-3 border-t pt-5">
    <h3 className="font-semibold">Onay Akışı</h3>
    {loading && <Loader2 className="h-5 w-5 animate-spin" />}
    {!loading && data?.currentSteps.length === 0 && <p className="text-sm text-muted-foreground">Bu kayıt için onay akışı başlatılmamış.</p>}
    {data?.snapshotPending && <p className="rounded border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800">Aktif onay kademeleri ilk kararla birlikte kayıt bazında sabitlenecek.</p>}
    {data?.currentSteps.map(step => <Step key={step.id} step={step} active={step.id === data.activeStepId} />)}
    {data?.canAct && <div className="space-y-2 rounded border p-3">
      <div className="flex gap-2"><Button size="sm" onClick={() => void decide('ONAYLANDI')} disabled={busy}><CheckCircle2 className="mr-1 h-4 w-4" />Onayla</Button><Button size="sm" variant="outline" onClick={() => setRevisionOpen(value => !value)} disabled={busy}><RotateCcw className="mr-1 h-4 w-4" />Revizyon İste</Button></div>
      {revisionOpen && <div className="space-y-2"><Textarea maxLength={2000} value={reason} onChange={event => setReason(event.target.value)} placeholder="Revizyon gerekçesi *" /><Button size="sm" variant="destructive" disabled={busy || !reason.trim()} onClick={() => void decide('REVIZYON_ISTENDI')}>Revizyona Gönder</Button></div>}
    </div>}
    {data?.canRevert && <div className="space-y-2 rounded border border-amber-200 bg-amber-50/50 p-3">
      <Button size="sm" variant="outline" onClick={() => setRevertOpen(value => !value)} disabled={busy}><Undo2 className="mr-1 h-4 w-4" />Geri Al</Button>
      {revertOpen && <div className="space-y-2"><Textarea maxLength={2000} value={revertReason} onChange={event => setRevertReason(event.target.value)} placeholder="Geri alma gerekçesi *" /><Button size="sm" variant="destructive" disabled={busy || revertReason.trim().length < 3} onClick={() => void revertDecision()}>Kararı Geri Al</Button></div>}
    </div>}
    {turns.length > 0 && <details><summary className="cursor-pointer text-sm font-medium">Geçmiş onay turları</summary><div className="mt-2 space-y-3">{turns.map(turn => <div key={turn}><p className="mb-1 text-xs font-semibold text-muted-foreground">Tur {turn}</p>{data?.history.filter(step => step.tur === turn).map(step => <Step key={step.id} step={step} active={false} />)}</div>)}</div></details>}
    {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</p>}
  </section>
}

function Step({ step, active }: { step: YillikTakvimApprovalStep; active: boolean }) {
  const label = step.karar === 'ONAYLANDI' ? 'Onaylandı' : step.karar === 'REVIZYON_ISTENDI' ? 'Revizyon' : active ? 'Aktif' : 'Bekliyor'
  return <div className={`mb-2 rounded border p-3 ${active ? 'border-blue-300 bg-blue-50/50' : ''}`}><div className="flex items-center justify-between gap-2"><div><p className="font-medium">{step.adimSira}. {step.unvan}</p><p className="text-xs text-muted-foreground">{step.onaylayan?.name ?? 'Onaylayan atanmamış'}</p></div><Badge variant="outline"><Clock3 className="mr-1 h-3 w-3" />{label}</Badge></div>{step.yorum && <p className="mt-2 whitespace-pre-wrap text-sm">{step.yorum}</p>}</div>
}
