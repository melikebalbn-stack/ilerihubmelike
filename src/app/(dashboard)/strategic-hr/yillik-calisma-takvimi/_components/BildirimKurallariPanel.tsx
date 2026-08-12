'use client'
import { useCallback, useEffect, useState } from 'react'
import { Bell, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { YillikTakvimKatilimciRol } from '@/generated/prisma'

type Rule = { id: string; tetik: string; aliciRoller: YillikTakvimKatilimciRol[]; kanal: string[]; aktif: boolean }
const roles: [YillikTakvimKatilimciRol, string][] = [['ANA_SORUMLU','Ana Sorumlu'],['YEDEK_SORUMLU','Yedek Sorumlu'],['DESTEK','Destek'],['ONAYLAYAN','Onaylayan'],['IKINCI_ONAYLAYAN','İkinci Onaylayan'],['BILGILENDIRILECEK','Bilgilendirilecek'],['GOZLEMCI','Gözlemci']]
const label = (trigger: string) => trigger === 'son_gun' ? 'Son gün' : trigger.startsWith('gun_kala:') ? `${trigger.split(':')[1]} gün kala` : `${trigger.split(':')[1]} gün gecikme (eskalasyon)`

export function BildirimKurallariPanel({ kayitId, canManage, locked, onChanged }: { kayitId: string; canManage: boolean; locked: boolean; onChanged: () => void }) {
  const [rules, setRules] = useState<Rule[]>([]), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false)
  const [kind, setKind] = useState('gun_kala'), [days, setDays] = useState('30')
  const [selectedRoles, setSelectedRoles] = useState<YillikTakvimKatilimciRol[]>(['ANA_SORUMLU']), [channels, setChannels] = useState<string[]>(['EPOSTA'])
  const load = useCallback(async () => { setLoading(true); try { const response = await fetch(`/api/strategic-hr/yillik-calisma-takvimi/${kayitId}/bildirim-kurali`); const body = await response.json(); if (!response.ok) throw new Error(body.error); setRules(body) } catch { toast.error('Bildirim kuralları yüklenemedi') } finally { setLoading(false) } }, [kayitId])
  useEffect(() => { void load() }, [load])
  const toggle = <T,>(items: T[], item: T, setter: (value: T[]) => void) => setter(items.includes(item) ? items.filter(value => value !== item) : [...items, item])
  async function mutate(url: string, method: string, body?: unknown) {
    setBusy(true); try { const response = await fetch(url, { method, headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error); await load(); onChanged(); toast.success('Bildirim kuralı güncellendi') } catch (error) { toast.error(error instanceof Error ? error.message : 'İşlem başarısız') } finally { setBusy(false) }
  }
  const base = `/api/strategic-hr/yillik-calisma-takvimi/${kayitId}/bildirim-kurali`
  return <section className="mt-6 border-t pt-5"><div className="mb-3 flex items-center gap-2"><Bell className="h-4 w-4"/><h3 className="font-semibold">Bildirim Kuralları</h3></div>
    {loading ? <Loader2 className="h-5 w-5 animate-spin"/> : <div className="space-y-2">{rules.length === 0 && <p className="text-sm text-muted-foreground">Henüz bildirim kuralı yok.</p>}{rules.map(rule => <div key={rule.id} className="flex items-center justify-between rounded border p-2 text-sm"><div><p className="font-medium">{label(rule.tetik)}</p><div className="mt-1 flex flex-wrap gap-1">{rule.aliciRoller.map(role => <Badge key={role} variant="outline">{roles.find(([key]) => key === role)?.[1]}</Badge>)}{rule.kanal.map(channel => <Badge key={channel} variant="secondary">{channel === 'HUB' ? 'Hub' : 'E-posta'}</Badge>)}</div></div>{canManage && !locked && <div className="flex items-center gap-2"><label className="flex items-center gap-1 text-xs"><Checkbox checked={rule.aktif} disabled={busy} onCheckedChange={() => void mutate(`${base}/${rule.id}`, 'PATCH', { aktif: !rule.aktif })}/>Aktif</label><Button size="icon" variant="ghost" disabled={busy} onClick={() => { if (confirm('Bu bildirim kuralı silinsin mi?')) void mutate(`${base}/${rule.id}`, 'DELETE') }}><Trash2 className="h-4 w-4 text-red-500"/></Button></div>}</div>)}</div>}
    {canManage && !locked && <div className="mt-3 space-y-3 rounded border p-3"><div className="flex items-end gap-2"><div><Label>Tetik</Label><Select value={kind} onValueChange={setKind}><SelectTrigger className="w-44"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="gun_kala">Gün kala</SelectItem><SelectItem value="son_gun">Son gün</SelectItem><SelectItem value="gun_gecikme">Gün gecikme</SelectItem></SelectContent></Select></div>{kind !== 'son_gun' && <div><Label>Gün</Label><Input className="w-20" type="number" min={1} max={999} value={days} onChange={event => setDays(event.target.value)}/></div>}</div><div><Label>Alıcı rolleri</Label><div className="flex flex-wrap gap-3">{roles.map(([role,text]) => <label key={role} className="flex items-center gap-1 text-sm"><Checkbox checked={selectedRoles.includes(role)} onCheckedChange={() => toggle(selectedRoles, role, setSelectedRoles)}/>{text}</label>)}</div></div><div><Label>Kanallar</Label><div className="flex gap-3">{['EPOSTA','HUB'].map(channel => <label key={channel} className="flex items-center gap-1 text-sm"><Checkbox checked={channels.includes(channel)} onCheckedChange={() => toggle(channels, channel, setChannels)}/>{channel === 'HUB' ? 'Hub' : 'E-posta'}</label>)}</div></div><Button size="sm" disabled={busy || selectedRoles.length === 0 || channels.length === 0} onClick={() => void mutate(base, 'POST', { tetik: kind === 'son_gun' ? kind : `${kind}:${days}`, aliciRoller: selectedRoles, kanal: channels })}><Plus className="mr-1 h-4 w-4"/>Kural Ekle</Button></div>}
  </section>
}
