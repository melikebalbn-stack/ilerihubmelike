'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Loader2, Pencil, Plus, Send, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AsyncCombobox, type AsyncComboboxOption } from './AsyncCombobox'
import type { YillikTakvimChecklistItem } from './types'

interface Props {
  kayitId: string; canEdit: boolean; canComplete: boolean; locked: boolean; refreshKey?: number
  onRecordChanged: () => void; onCountChange?: (count: number) => void
  registerCompleteAction?: (action: (() => void) | null) => void
}
interface Form { baslik: string; aciklama: string; sonTarih: string; zorunlu: boolean; kanitGerekli: boolean }
const EMPTY: Form = { baslik: '', aciklama: '', sonTarih: '', zorunlu: false, kanitGerekli: false }

export function ChecklistPanel({ kayitId, canEdit, canComplete, locked, refreshKey = 0, onRecordChanged, onCountChange, registerCompleteAction }: Props) {
  const [items, setItems] = useState<YillikTakvimChecklistItem[]>([])
  const [attachmentCount, setAttachmentCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<Form>(EMPTY)
  const [responsible, setResponsible] = useState<AsyncComboboxOption | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const response = await fetch(`/api/strategic-hr/yillik-calisma-takvimi/${kayitId}/checklist`)
      const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'Checklist alınamadı')
      setItems(body.data ?? [])
      setAttachmentCount(body.ekSayisi ?? 0)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Checklist alınamadı') }
    finally { setLoading(false) }
  }, [kayitId])
  useEffect(() => { void load() }, [load, refreshKey])
  useEffect(() => { onCountChange?.(items.length) }, [items.length, onCountChange])

  const loadUsers = useCallback(async (query: string) => {
    const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}&limit=20`); if (!response.ok) throw new Error('Kullanıcılar alınamadı')
    const body: { users?: { name: string; email: string; department?: string | null; jobTitle?: string | null }[] } = await response.json()
    return (body.users ?? []).filter(user => user.email).map(user => ({ id: user.email, label: user.name, description: [user.jobTitle, user.department].filter(Boolean).join(' · ') }))
  }, [])
  const reset = () => { setForm(EMPTY); setResponsible(null); setEditingId(null); setShowForm(false); setError(null) }
  const edit = (item: YillikTakvimChecklistItem) => {
    setForm({ baslik: item.baslik, aciklama: item.aciklama ?? '', sonTarih: item.sonTarih?.slice(0, 10) ?? '', zorunlu: item.zorunlu, kanitGerekli: item.kanitGerekli })
    setResponsible(item.sorumlu ? { id: item.sorumlu.id, label: item.sorumlu.name ?? 'İsimsiz kullanıcı' } : null)
    setEditingId(item.id); setShowForm(true)
  }
  async function save() {
    setBusy(true); setError(null)
    const payload: Record<string, unknown> = { ...form, aciklama: form.aciklama.trim() || null, sonTarih: form.sonTarih || null }
    if (!editingId || responsible?.id.includes('@') || responsible === null) payload.sorumluEmail = responsible?.id ?? null
    try {
      const response = await fetch(editingId
        ? `/api/strategic-hr/yillik-calisma-takvimi/${kayitId}/checklist/${editingId}`
        : `/api/strategic-hr/yillik-calisma-takvimi/${kayitId}/checklist`, {
        method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'Checklist kaydedilemedi')
      toast.success(editingId ? 'Checklist maddesi güncellendi' : 'Checklist maddesi eklendi'); reset(); await load()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Checklist kaydedilemedi') }
    finally { setBusy(false) }
  }
  async function mutate(item: YillikTakvimChecklistItem, method: 'PATCH' | 'DELETE') {
    if (method === 'DELETE' && !window.confirm('Checklist maddesi silinsin mi?')) return
    setBusy(true); setError(null)
    try {
      const response = await fetch(`/api/strategic-hr/yillik-calisma-takvimi/${kayitId}/checklist/${item.id}`, {
        method, ...(method === 'PATCH' && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tamamlandi: !item.tamamlandi }) }),
      })
      const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'İşlem başarısız')
      await load()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'İşlem başarısız') }
    finally { setBusy(false) }
  }
  async function completeRecord() {
    setBusy(true); setError(null)
    try {
      const response = await fetch(`/api/strategic-hr/yillik-calisma-takvimi/${kayitId}/tamamla`, { method: 'POST' })
      const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'Kayıt gönderilemedi')
      toast.success('Kayıt tamamlanmaya gönderildi'); onRecordChanged()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Kayıt gönderilemedi') }
    finally { setBusy(false) }
  }
  useEffect(() => {
    registerCompleteAction?.(() => { void completeRecord() })
    return () => registerCompleteAction?.(null)
    // Handler intentionally remains inside this panel so its existing security/error flow is reused.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kayitId, registerCompleteAction])

  return <section className="mt-6 space-y-3 border-t pt-5">
    <div className="flex items-center justify-between"><h3 className="font-semibold">Checklist</h3>{canEdit && !locked && <Button size="sm" variant="outline" onClick={() => { reset(); setShowForm(true) }}><Plus className="mr-1 h-4 w-4" />Madde Ekle</Button>}</div>
    {loading && <Loader2 className="h-5 w-5 animate-spin" />}
    {!loading && items.length === 0 && <p className="text-sm text-muted-foreground">Checklist maddesi bulunmuyor.</p>}
    {items.map(item => <div key={item.id} className="flex items-start gap-3 rounded border p-3">
      <Checkbox checked={item.tamamlandi} disabled={!canEdit || locked || busy || (item.kanitGerekli && attachmentCount === 0 && !item.tamamlandi)} onCheckedChange={() => void mutate(item, 'PATCH')} />
      <div className="min-w-0 flex-1"><p className={item.tamamlandi ? 'line-through' : 'font-medium'}>{item.baslik}</p><p className="text-xs text-muted-foreground">{item.sorumlu?.name ?? 'Sorumlu atanmamış'}{item.zorunlu ? ' · Zorunlu' : ''}{item.kanitGerekli ? ' · Kanıt gerekli' : ''}</p>{item.kanitGerekli && attachmentCount === 0 && !item.tamamlandi && <p className="mt-1 text-xs text-amber-700">Kanıt gerekli — ek/kanıt yükleyin.</p>}</div>
      {canEdit && !locked && <><Button size="icon" variant="ghost" onClick={() => edit(item)}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={() => void mutate(item, 'DELETE')}><Trash2 className="h-4 w-4" /></Button></>}
    </div>)}
    {showForm && <div className="grid gap-3 rounded border bg-muted/20 p-3 sm:grid-cols-2">
      <div className="sm:col-span-2"><Label>Madde *</Label><Input maxLength={300} value={form.baslik} onChange={e => setForm(v => ({ ...v, baslik: e.target.value }))} /></div>
      <div className="sm:col-span-2"><Label>Açıklama</Label><Textarea maxLength={2000} value={form.aciklama} onChange={e => setForm(v => ({ ...v, aciklama: e.target.value }))} /></div>
      <div><Label>Sorumlu</Label><AsyncCombobox value={responsible} onChange={setResponsible} loadOptions={loadUsers} placeholder="Sorumlu seçin" searchPlaceholder="Kullanıcı ara" minSearchLength={2} /></div>
      <div><Label>Son Tarih</Label><Input type="date" value={form.sonTarih} onChange={e => setForm(v => ({ ...v, sonTarih: e.target.value }))} /></div>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.zorunlu} onCheckedChange={v => setForm(f => ({ ...f, zorunlu: v === true }))} />Zorunlu</label>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.kanitGerekli} onCheckedChange={v => setForm(f => ({ ...f, kanitGerekli: v === true }))} />Kanıt gerekli</label>
      <div className="flex gap-2 sm:col-span-2"><Button size="sm" onClick={() => void save()} disabled={busy || !form.baslik.trim()}>{busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}Kaydet</Button><Button size="sm" variant="outline" onClick={reset}><X className="mr-1 h-4 w-4" />Vazgeç</Button></div>
    </div>}
    {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</p>}
    {canComplete && !locked && <div className="flex justify-end"><Button onClick={() => void completeRecord()} disabled={busy}><Send className="mr-1 h-4 w-4" />Tamamlamaya Gönder</Button></div>}
  </section>
}
