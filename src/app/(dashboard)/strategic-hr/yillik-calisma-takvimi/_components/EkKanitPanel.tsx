'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, FileText, Loader2, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { YillikTakvimAttachment } from './types'

export function EkKanitPanel({ kayitId, canManage, locked, onChanged, onCountChange }: { kayitId: string; canManage: boolean; locked: boolean; onChanged: () => void; onCountChange?: (count: number) => void }) {
  const [items, setItems] = useState<YillikTakvimAttachment[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const response = await fetch(`/api/strategic-hr/yillik-calisma-takvimi/${kayitId}/ek`)
      const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'Ekler alınamadı')
      setItems(body.data ?? [])
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Ekler alınamadı') }
    finally { setLoading(false) }
  }, [kayitId])
  useEffect(() => { void load() }, [load])
  useEffect(() => { onCountChange?.(items.length) }, [items.length, onCountChange])

  async function upload(file: File) {
    setBusy(true); setError(null)
    const form = new FormData(); form.set('file', file)
    try {
      const response = await fetch(`/api/strategic-hr/yillik-calisma-takvimi/${kayitId}/ek`, { method: 'POST', body: form })
      const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'Dosya yüklenemedi')
      toast.success('Ek/kanıt yüklendi'); await load(); onChanged()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Dosya yüklenemedi') }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = '' }
  }
  async function remove(id: string) {
    if (!window.confirm('Bu ek kalıcı olarak silinsin mi?')) return
    setBusy(true); setError(null)
    try {
      const response = await fetch(`/api/strategic-hr/yillik-calisma-takvimi/ek/${id}`, { method: 'DELETE' })
      const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'Ek silinemedi')
      toast.success('Ek silindi'); await load(); onChanged()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Ek silinemedi') }
    finally { setBusy(false) }
  }
  return <section className="mt-6 space-y-3 border-t pt-5">
    <div className="flex items-center justify-between"><div><h3 className="font-semibold">Ekler ve Kanıtlar</h3><p className="text-xs text-muted-foreground">Ekler kayıt seviyesinde kanıt olarak değerlendirilir.</p></div>{canManage && !locked && <><input ref={inputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.zip" onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file) }} /><Button size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}><Upload className="mr-1 h-4 w-4" />Yükle</Button></>}</div>
    {loading && <Loader2 className="h-5 w-5 animate-spin" />}
    {!loading && items.length === 0 && <p className="text-sm text-muted-foreground">Yüklenmiş ek yok.</p>}
    {items.map(item => <div key={item.id} className="flex items-center gap-3 rounded border p-3"><FileText className="h-5 w-5 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.dosyaAdi}</p><p className="text-xs text-muted-foreground">{item.dosyaTuru} · {formatSize(item.boyut)} · {new Date(item.createdAt).toLocaleDateString('tr-TR')}</p></div><Button size="icon" variant="ghost" asChild><a href={`/api/strategic-hr/yillik-calisma-takvimi/ek/${item.id}/download`}><Download className="h-4 w-4" /></a></Button>{canManage && !locked && <Button size="icon" variant="ghost" disabled={busy} onClick={() => void remove(item.id)}><Trash2 className="h-4 w-4" /></Button>}</div>)}
    {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</p>}
  </section>
}
function formatSize(value: number | null) { if (value === null) return 'Boyut bilinmiyor'; return value < 1024 * 1024 ? `${Math.ceil(value / 1024)} KB` : `${(value / 1024 / 1024).toFixed(1)} MB` }
