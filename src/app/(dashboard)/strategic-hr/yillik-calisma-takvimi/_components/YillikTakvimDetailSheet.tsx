'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import type { YillikTakvimGerceklesmeDurumu, YillikTakvimOncelik, YillikTakvimPeriyot } from '@/generated/prisma'
import { CalendarClock, CalendarPlus, CheckCircle2, Ellipsis, Loader2, Pencil, Save, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { AsyncCombobox, type AsyncComboboxOption } from './AsyncCombobox'
import { DURUM_META, ONCELIK_META, PERIYOT_META } from './constants'
import type { YillikTakvimKaydiDetail } from './types'
import { ChecklistPanel } from './ChecklistPanel'
import { OnayPanel } from './OnayPanel'
import { EkKanitPanel } from './EkKanitPanel'
import { IslemGecmisiPanel, type HistorySummary } from './IslemGecmisiPanel'
import { BildirimKurallariPanel } from './BildirimKurallariPanel'
import { isYillikTakvimWorkflowLocked } from '@/lib/yillik-calisma-takvimi/state'

const GERCEKLESME: Record<YillikTakvimGerceklesmeDurumu, string> = {
  BEKLIYOR: 'Bekliyor', GERCEKLESTI: 'Gerçekleşti', GERCEKLESMEDI: 'Gerçekleşmedi', DEVREDILDI: 'Devredildi', PLANDISI: 'Plan Dışı',
}
const dateInput = (value: string | null) => value?.slice(0, 10) ?? ''
const nullable = (value: string) => value.trim() || null

interface FormState {
  anaKonu: string; surec: string; kisaBaslik: string; aciklama: string
  nihaiSonTarih: string; plananUygulamaTarihi: string; periyot: YillikTakvimPeriyot
  oncelik: YillikTakvimOncelik; disKurum: string
  gerceklesmeDurumu: YillikTakvimGerceklesmeDurumu; gerceklesmeTarihi: string; gerceklesmemeNedeni: string
}
interface Props { kayitId: string | null; open: boolean; onOpenChange: (open: boolean) => void; onUpdated: () => void }

export function YillikTakvimDetailSheet({ kayitId, open, onOpenChange, onUpdated }: Props) {
  const { data: session } = useSession()
  const permissions = session?.user?.permissions ?? []
  const canEdit = permissions.includes('yilliktakvim.edit') || permissions.includes('yilliktakvim.admin')
  const canCancel = permissions.includes('yilliktakvim.cancel') || permissions.includes('yilliktakvim.admin')
  const canComplete = permissions.includes('yilliktakvim.complete') || permissions.includes('yilliktakvim.admin')
  const canManageAttachments = permissions.includes('yilliktakvim.attachment.manage') || permissions.includes('yilliktakvim.admin')
  const canManageNotifications = permissions.includes('yilliktakvim.notification.manage') || permissions.includes('yilliktakvim.admin')
  const [detail, setDetail] = useState<YillikTakvimKaydiDetail | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [department, setDepartment] = useState<AsyncComboboxOption | null>(null)
  const [responsible, setResponsible] = useState<AsyncComboboxOption | null>(null)
  const [initialResponsibleId, setInitialResponsibleId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [creatingNextPeriod, setCreatingNextPeriod] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attachmentVersion, setAttachmentVersion] = useState(0)
  const [historyVersion, setHistoryVersion] = useState(0)
  const [activeTab, setActiveTab] = useState('temel')
  const [checklistCount, setChecklistCount] = useState(0)
  const [attachmentCount, setAttachmentCount] = useState(0)
  const [historySummary, setHistorySummary] = useState<HistorySummary | null>(null)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [completeReady, setCompleteReady] = useState(false)
  const completeActionRef = useRef<(() => void) | null>(null)
  const dateFieldRef = useRef<HTMLInputElement>(null)
  const mutationCompleted = () => { setHistoryVersion(value => value + 1); onUpdated() }
  const registerCompleteAction = useCallback((action: (() => void) | null) => {
    completeActionRef.current = action
    setCompleteReady(!!action)
  }, [])

  const load = useCallback(async () => {
    if (!kayitId) return
    setLoading(true); setError(null); setEditing(false)
    try {
      const response = await fetch(`/api/strategic-hr/yillik-calisma-takvimi/${kayitId}`)
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Kayıt detayı alınamadı')
      const next = body as YillikTakvimKaydiDetail
      const ana = next.katilimcilar[0]?.user ?? null
      setDetail(next)
      setForm({
        anaKonu: next.anaKonu, surec: next.surec, kisaBaslik: next.kisaBaslik ?? '', aciklama: next.aciklama ?? '',
        nihaiSonTarih: dateInput(next.nihaiSonTarih), plananUygulamaTarihi: dateInput(next.plananUygulamaTarihi),
        periyot: next.periyot, oncelik: next.oncelik, disKurum: next.disKurum ?? '',
        gerceklesmeDurumu: next.gerceklesmeDurumu, gerceklesmeTarihi: dateInput(next.gerceklesmeTarihi),
        gerceklesmemeNedeni: next.gerceklesmemeNedeni ?? '',
      })
      setDepartment(next.department ? { id: next.department.id, label: next.department.name } : null)
      setResponsible(ana ? { id: ana.id, label: ana.name ?? 'İsimsiz kullanıcı' } : null)
      setInitialResponsibleId(ana?.id ?? null)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Kayıt detayı alınamadı') }
    finally { setLoading(false) }
  }, [kayitId])

  useEffect(() => { if (open) { setActiveTab('temel'); void load() } }, [load, open])

  const loadDepartments = useCallback(async (query: string) => {
    const response = await fetch('/api/departments'); if (!response.ok) throw new Error('Departmanlar alınamadı')
    const rows: { id: string; name: string; code: string }[] = await response.json(); const needle = query.toLocaleLowerCase('tr')
    return rows.filter(row => `${row.name} ${row.code}`.toLocaleLowerCase('tr').includes(needle)).map(row => ({ id: row.id, label: row.name, description: row.code }))
  }, [])
  const loadUsers = useCallback(async (query: string) => {
    const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}&limit=20`); if (!response.ok) throw new Error('Kullanıcılar alınamadı')
    const body: { users?: { name: string; email: string; department?: string | null; jobTitle?: string | null }[] } = await response.json()
    return (body.users ?? []).filter(user => user.email).map(user => ({ id: user.email, label: user.name, description: [user.jobTitle, user.department].filter(Boolean).join(' · ') }))
  }, [])

  if (!form || !detail) return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent className="flex flex-col items-center justify-center gap-3">
    <DialogPrimitive.Title className="text-lg font-semibold">Kayıt Detayı</DialogPrimitive.Title>
    <DialogPrimitive.Description className="sr-only">Yıllık çalışma takvimi kayıt ayrıntıları yükleniyor.</DialogPrimitive.Description>
    {loading && <Loader2 className="h-6 w-6 animate-spin" />}
    {!loading && error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
  </SheetContent></Sheet>
  const external = !!detail.kaynakModul
  const workflowLocked = isYillikTakvimWorkflowLocked(detail.durum)
  const disabled = !editing || saving
  const sourceDisabled = disabled || external
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm(current => current ? { ...current, [key]: value } : current)

  async function save() {
    const currentForm = form
    const currentDetail = detail
    if (!currentForm || !currentDetail) return
    if (!department || !responsible) { setError('Departman ve ana sorumlu seçilmelidir'); return }
    setSaving(true); setError(null)
    const payload: Record<string, unknown> = {
      aciklama: nullable(currentForm.aciklama), oncelik: currentForm.oncelik, disKurum: nullable(currentForm.disKurum),
      gerceklesmeDurumu: currentForm.gerceklesmeDurumu, gerceklesmeTarihi: currentForm.gerceklesmeTarihi || null,
      gerceklesmemeNedeni: nullable(currentForm.gerceklesmemeNedeni),
    }
    if (!external) Object.assign(payload, {
      anaKonu: currentForm.anaKonu, surec: currentForm.surec, kisaBaslik: nullable(currentForm.kisaBaslik), departmentId: department.id,
      nihaiSonTarih: currentForm.nihaiSonTarih, plananUygulamaTarihi: currentForm.plananUygulamaTarihi || null, periyot: currentForm.periyot,
    })
    if (responsible.id !== initialResponsibleId) payload.anaSorumluEmail = responsible.id
    try {
      const response = await fetch(`/api/strategic-hr/yillik-calisma-takvimi/${currentDetail.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'Kayıt güncellenemedi')
      toast.success('Yıllık takvim kaydı güncellendi'); setEditing(false); await load(); mutationCompleted()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Kayıt güncellenemedi') }
    finally { setSaving(false) }
  }

  async function cancelRecord() {
    if (!detail) return
    setCancelling(true); setError(null)
    try {
      const response = await fetch(`/api/strategic-hr/yillik-calisma-takvimi/${detail.id}`, { method: 'DELETE' })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Kayıt iptal edilemedi')
      toast.success(body.alreadyCancelled ? 'Kayıt zaten iptal edilmiş' : 'Yıllık takvim kaydı iptal edildi')
      onOpenChange(false)
      onUpdated()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Kayıt iptal edilemedi') }
    finally { setCancelling(false) }
  }

  async function createNextPeriod() {
    if (!detail) return
    const currentDetail = detail
    setCreatingNextPeriod(true); setError(null)
    try {
      const response = await fetch(`/api/strategic-hr/yillik-calisma-takvimi/${currentDetail.id}/sonraki-donem`, { method: 'POST' })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Sonraki dönem oluşturulamadı')
      toast.success(`Sonraki dönem oluşturuldu (yıl: ${body.yil})`)
      await load(); mutationCompleted()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Sonraki dönem oluşturulamadı') }
    finally { setCreatingNextPeriod(false) }
  }

  function beginEditing(focusDates = false) {
    setActiveTab('temel')
    setEditing(true)
    if (focusDates) requestAnimationFrame(() => dateFieldRef.current?.focus())
  }

  const terminalLocked = detail.iptalMi || detail.arsivMi || workflowLocked
  const isAdmin = permissions.includes('yilliktakvim.admin')
  const canCreateNextPeriod = detail.durum === 'ONAYLANDI' && (isAdmin || detail.createdById === session?.user?.id || detail.katilimcilar.some(item => item.user.id === session?.user?.id))
  const hasActiveNextPeriod = detail.sonrakiKayitlar.length > 0
  const formatDate = (value: string | null) => value ? new Date(value).toLocaleDateString('tr-TR') : '—'

  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent className="w-full overflow-y-auto p-0 sm:max-w-3xl">
    <DialogPrimitive.Description className="sr-only">Yıllık çalışma takvimi kayıt ayrıntıları ve işlemleri.</DialogPrimitive.Description>
    <header className="border-b px-5 py-4 pr-12 sm:px-7"><DialogPrimitive.Title className="text-lg font-semibold">{kayitId ? 'Kayıt Detayı' : 'Yeni Kayıt'}</DialogPrimitive.Title></header>
    <div className="space-y-6 px-5 py-5 sm:px-7">
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2"><Badge variant="secondary" className="bg-[#E8F1F8] text-[#1B4F72] hover:bg-[#E8F1F8]">{detail.anaKonu}</Badge><h2 className="text-xl font-semibold leading-tight sm:text-2xl">{detail.surec}</h2>{detail.kisaBaslik && <p className="text-sm text-muted-foreground">{detail.kisaBaslik}</p>}</div>
        <Badge className={DURUM_META[detail.durum].className}>{DURUM_META[detail.durum].label}</Badge>
      </div>
    </section>
    {detail.kaynakModul && <p className="mt-3 rounded border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800">Kaynak: {detail.kaynakModul}. Kaynak tarafından yönetilen alanlar salt okunurdur.</p>}

    <nav aria-label="Kayıt işlemleri" className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/20 p-2 sm:grid-cols-4">
      <ToolbarAction icon={Pencil} label="Düzenle" disabled={!canEdit || terminalLocked || editing} onClick={() => beginEditing()} />
      <ToolbarAction icon={CheckCircle2} label="Tamamla" disabled={!canComplete || terminalLocked || editing || !completeReady} onClick={() => completeActionRef.current?.()} />
      <ToolbarAction icon={CalendarClock} label="Tarih Değiştir" disabled={!canEdit || terminalLocked || editing || external} onClick={() => beginEditing(true)} />
      <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="ghost" className="h-auto min-h-14 flex-col gap-1.5" disabled={editing}><Ellipsis className="h-5 w-5" /><span className="text-xs font-medium">Diğer</span></Button></DropdownMenuTrigger><DropdownMenuContent align="end">{canCreateNextPeriod && <DropdownMenuItem disabled={hasActiveNextPeriod || creatingNextPeriod} onSelect={() => void createNextPeriod()}><CalendarPlus className="mr-2 h-4 w-4" />{hasActiveNextPeriod ? 'Aktif sonraki dönem mevcut' : 'Sonraki Dönemi Oluştur'}</DropdownMenuItem>}<DropdownMenuItem className="text-destructive focus:text-destructive" disabled={!canCancel || detail.iptalMi || detail.arsivMi || !!detail.kaynakModul || cancelling} onSelect={() => setCancelDialogOpen(true)}><Trash2 className="mr-2 h-4 w-4" />Kaydı İptal Et</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
    </nav>

    <section className="rounded-lg border bg-card p-4">
      <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
        <MetaRow label="Sorumlu" value={responsible?.label ?? '—'} /><MetaRow label="Departman" value={department?.label ?? '—'} />
        <MetaRow label="Öncelik" value={ONCELIK_META[detail.oncelik]} /><MetaRow label="Periyot" value={PERIYOT_META[detail.periyot]} />
        <MetaRow label="Planlanan Uygulama Tarihi" value={formatDate(detail.plananUygulamaTarihi)} /><MetaRow label="Nihai Son Tarih" value={formatDate(detail.nihaiSonTarih)} />
        <MetaRow label="Gerçekleşme Durumu" value={GERCEKLESME[detail.gerceklesmeDurumu]} /><MetaRow label="Gerçekleşme Tarihi" value={formatDate(detail.gerceklesmeTarihi)} />
        <MetaRow label="Durum" value={DURUM_META[detail.durum].label} />
      </div>
      <div className="mt-4 border-t pt-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Açıklama</p><p className="mt-1 whitespace-pre-wrap text-sm">{detail.aciklama || '—'}</p></div>
      {detail.gerceklesmemeNedeni && <div className="mt-4 rounded-md bg-amber-50 p-3"><p className="text-xs font-medium text-amber-800">Gerçekleşmeme / Devir Nedeni</p><p className="mt-1 text-sm text-amber-900">{detail.gerceklesmemeNedeni}</p></div>}
    </section>

    {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</p>}
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <div className="overflow-x-auto pb-1"><TabsList className="h-auto min-w-max justify-start"><TabsTrigger value="temel">Temel Bilgiler</TabsTrigger><TabsTrigger value="checklist">Checklist ({checklistCount})</TabsTrigger><TabsTrigger value="onay">Onay</TabsTrigger><TabsTrigger value="hatirlatma">Hatırlatma</TabsTrigger><TabsTrigger value="ekler">Ekler ({attachmentCount})</TabsTrigger><TabsTrigger value="gecmis">Geçmiş</TabsTrigger></TabsList></div>
      <TabsContent value="temel" className="mt-4">
      {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div> : editing ? <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
      <Field label="Yıl"><Input value={detail.yil} disabled /></Field><Field label="Kayıt Türü"><Input value={detail.kayitTuru} disabled /></Field>
      <Field label="Ana Konu"><Input value={form.anaKonu} disabled={sourceDisabled} onChange={e => set('anaKonu', e.target.value)} /></Field>
      <Field label="Başlık / Süreç"><Input value={form.surec} disabled={sourceDisabled} onChange={e => set('surec', e.target.value)} /></Field>
      <Field label="Kısa Başlık"><Input value={form.kisaBaslik} disabled={sourceDisabled} onChange={e => set('kisaBaslik', e.target.value)} /></Field>
      <Field label="Dış Kurum"><Input value={form.disKurum} disabled={disabled} onChange={e => set('disKurum', e.target.value)} /></Field>
      <Field label="Departman"><AsyncCombobox value={department} onChange={setDepartment} loadOptions={loadDepartments} placeholder="Departman seçin" searchPlaceholder="Departman ara" disabled={sourceDisabled} /></Field>
      <Field label="Ana Sorumlu"><AsyncCombobox value={responsible} onChange={setResponsible} loadOptions={loadUsers} placeholder="Ana sorumlu seçin" searchPlaceholder="Ad veya e-posta ara" minSearchLength={2} disabled={disabled} /></Field>
      <Field label="Nihai Son Tarih"><Input type="date" value={form.nihaiSonTarih} disabled={sourceDisabled} onChange={e => set('nihaiSonTarih', e.target.value)} /></Field>
      <Field label="Planlanan Tarih"><Input ref={dateFieldRef} type="date" value={form.plananUygulamaTarihi} disabled={sourceDisabled} onChange={e => set('plananUygulamaTarihi', e.target.value)} /></Field>
      <Field label="Periyot"><EnumSelect value={form.periyot} options={PERIYOT_META} disabled={sourceDisabled} onChange={v => set('periyot', v as YillikTakvimPeriyot)} /></Field>
      <Field label="Öncelik"><EnumSelect value={form.oncelik} options={ONCELIK_META} disabled={disabled} onChange={v => set('oncelik', v as YillikTakvimOncelik)} /></Field>
      <Field label="Gerçekleşme"><EnumSelect value={form.gerceklesmeDurumu} options={GERCEKLESME} disabled={disabled} onChange={v => set('gerceklesmeDurumu', v as YillikTakvimGerceklesmeDurumu)} /></Field>
      <Field label="Gerçekleşme Tarihi"><Input type="date" value={form.gerceklesmeTarihi} disabled={disabled} onChange={e => set('gerceklesmeTarihi', e.target.value)} /></Field>
      <div className="sm:col-span-2"><Field label="Açıklama"><Textarea rows={4} value={form.aciklama} disabled={disabled} onChange={e => set('aciklama', e.target.value)} /></Field></div>
      {(form.gerceklesmeDurumu === 'GERCEKLESMEDI' || form.gerceklesmeDurumu === 'DEVREDILDI') && <div className="sm:col-span-2"><Field label="Gerçekleşmeme / Devir Nedeni"><Textarea rows={3} value={form.gerceklesmemeNedeni} disabled={disabled} onChange={e => set('gerceklesmemeNedeni', e.target.value)} /></Field></div>}
    </div> : <div className="rounded-lg border bg-muted/10 p-4 text-sm"><div className="grid gap-2 sm:grid-cols-2"><MetaRow label="Yıl" value={String(detail.yil)} /><MetaRow label="Kayıt Türü" value={detail.kayitTuru} /><MetaRow label="Dış Kurum" value={detail.disKurum || '—'} /><MetaRow label="Kaynak" value={detail.kaynakModul || 'Manuel kayıt'} /></div></div>}
      {editing && <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => void load()} disabled={saving}><X className="mr-1 h-4 w-4" />Vazgeç</Button><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}Kaydet</Button></div>}
      </TabsContent>
      <TabsContent forceMount className="data-[state=inactive]:hidden" value="checklist"><ChecklistPanel kayitId={detail.id} canEdit={canEdit} canComplete={canComplete} locked={terminalLocked} refreshKey={attachmentVersion} onCountChange={setChecklistCount} registerCompleteAction={registerCompleteAction} onRecordChanged={() => { void load(); mutationCompleted() }} /></TabsContent>
      <TabsContent forceMount className="data-[state=inactive]:hidden" value="onay"><OnayPanel kayitId={detail.id} onChanged={() => { void load(); mutationCompleted() }} /></TabsContent>
      <TabsContent forceMount className="data-[state=inactive]:hidden" value="hatirlatma"><BildirimKurallariPanel kayitId={detail.id} canManage={canManageNotifications} locked={detail.iptalMi || detail.arsivMi} onChanged={mutationCompleted} /></TabsContent>
      <TabsContent forceMount className="data-[state=inactive]:hidden" value="ekler"><EkKanitPanel kayitId={detail.id} canManage={canManageAttachments} locked={terminalLocked} onCountChange={setAttachmentCount} onChanged={() => { setAttachmentVersion(value => value + 1); mutationCompleted() }} /></TabsContent>
      <TabsContent forceMount className="data-[state=inactive]:hidden" value="gecmis"><IslemGecmisiPanel kayitId={detail.id} refreshKey={historyVersion} onSummaryChange={setHistorySummary} /></TabsContent>
    </Tabs>
    <footer className="grid gap-2 border-t pt-4 text-xs text-muted-foreground sm:grid-cols-2"><p><span className="font-medium text-foreground">Oluşturan:</span> {historySummary ? `${historySummary.creatorName} · ${new Date(historySummary.createdAt).toLocaleString('tr-TR')}` : '—'}</p><p className="sm:text-right"><span className="font-medium text-foreground">Son Güncelleme:</span> {historySummary ? new Date(historySummary.updatedAt).toLocaleString('tr-TR') : '—'}</p></footer>
    </div>
    <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Kayıt iptal edilsin mi?</AlertDialogTitle><AlertDialogDescription>Bu işlem kaydı fiziksel olarak silmez; kayıt iptal edilmiş olarak işaretlenir.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Vazgeç</AlertDialogCancel><AlertDialogAction onClick={() => void cancelRecord()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">İptal Et</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </SheetContent></Sheet>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label>{label}</Label>{children}</div> }
function EnumSelect({ value, options, disabled, onChange }: { value: string; options: Record<string, string>; disabled: boolean; onChange: (value: string) => void }) {
  return <Select value={value} disabled={disabled} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(options).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select>
}
function MetaRow({ label, value }: { label: string; value: string }) { return <div className="flex items-baseline justify-between gap-4 border-b border-dashed py-1.5 last:border-0"><span className="text-xs text-muted-foreground">{label}</span><span className="text-right text-sm font-medium">{value}</span></div> }
function ToolbarAction({ icon: Icon, label, disabled, onClick }: { icon: typeof Pencil; label: string; disabled: boolean; onClick: () => void }) { return <Button type="button" variant="ghost" className="h-auto min-h-14 flex-col gap-1.5" disabled={disabled} onClick={onClick}><Icon className="h-5 w-5" /><span className="text-xs font-medium">{label}</span></Button> }
