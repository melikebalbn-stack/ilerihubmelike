'use client'

import { useCallback, useEffect, useState } from 'react'
import type { YillikTakvimKayitTuru, YillikTakvimOncelik, YillikTakvimPeriyot } from '@/generated/prisma'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ONCELIK_META, PERIYOT_META } from './constants'
import { AsyncCombobox, type AsyncComboboxOption } from './AsyncCombobox'

const KAYIT_TURLERI: Record<YillikTakvimKayitTuru, string> = {
  SON_TARIH: 'Son Tarih', TUM_GUN_ETKINLIK: 'Tüm Gün Etkinlik', SAATLI_ETKINLIK: 'Saatli Etkinlik',
  TOPLANTI: 'Toplantı', TEAMS_TOPLANTISI: 'Teams Toplantısı', EGITIM: 'Eğitim',
  DENETIM: 'Denetim', KONTROL: 'Kontrol', HATIRLATMA: 'Hatırlatma',
}

interface FormState {
  yil: number
  anaKonu: string
  surec: string
  kisaBaslik: string
  aciklama: string
  nihaiSonTarih: string
  plananUygulamaTarihi: string
  periyot: YillikTakvimPeriyot
  oncelik: YillikTakvimOncelik
  kayitTuru: YillikTakvimKayitTuru
  disKurum: string
}
const emptyForm = (yil: number): FormState => ({
  yil, anaKonu: '', surec: '', kisaBaslik: '', aciklama: '', nihaiSonTarih: '',
  plananUygulamaTarihi: '', periyot: 'YILLIK', oncelik: 'ORTA', kayitTuru: 'SON_TARIH', disKurum: '',
})

interface Props { open: boolean; onOpenChange: (open: boolean) => void; yil: number; onCreated: () => void }

export function YillikTakvimCreateDialog({ open, onOpenChange, yil, onCreated }: Props) {
  const [form, setForm] = useState<FormState>(() => emptyForm(yil))
  const [department, setDepartment] = useState<AsyncComboboxOption | null>(null)
  const [anaSorumlu, setAnaSorumlu] = useState<AsyncComboboxOption | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) { setForm(emptyForm(yil)); setDepartment(null); setAnaSorumlu(null); setError(null) }
  }, [open, yil])

  const loadDepartments = useCallback(async (query: string) => {
    const response = await fetch('/api/departments')
    if (!response.ok) throw new Error('Departmanlar alınamadı')
    const rows: { id: string; name: string; code: string }[] = await response.json()
    const needle = query.toLocaleLowerCase('tr')
    return rows.filter(row => `${row.name} ${row.code}`.toLocaleLowerCase('tr').includes(needle))
      .map(row => ({ id: row.id, label: row.name, description: row.code }))
  }, [])

  const loadUsers = useCallback(async (query: string) => {
    const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}&limit=20`)
    if (!response.ok) throw new Error('Kullanıcılar alınamadı')
    const body: { users?: { name: string; email: string; department?: string | null; jobTitle?: string | null }[] } = await response.json()
    return (body.users ?? []).filter(user => user.email).map(user => ({
      id: user.email, label: user.name, description: [user.jobTitle, user.department].filter(Boolean).join(' · '),
    }))
  }, [])

  async function submit() {
    if (!department || !anaSorumlu) { setError('Departman ve ana sorumlu seçilmelidir'); return }
    setSaving(true); setError(null)
    try {
      const response = await fetch('/api/strategic-hr/yillik-calisma-takvimi', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          departmentId: department.id,
          anaSorumluEmail: anaSorumlu.id,
          kisaBaslik: form.kisaBaslik.trim() || null,
          aciklama: form.aciklama.trim() || null,
          disKurum: form.disKurum.trim() || null,
          plananUygulamaTarihi: form.plananUygulamaTarihi || null,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Kayıt oluşturulamadı')
      toast.success('Yıllık takvim kaydı oluşturuldu')
      onOpenChange(false)
      onCreated()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Kayıt oluşturulamadı')
    } finally { setSaving(false) }
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm(current => ({ ...current, [key]: value }))
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>Yeni Yıllık Takvim Kaydı</DialogTitle><DialogDescription>Yeni kayıt varsayılan olarak Taslak durumunda oluşturulur.</DialogDescription></DialogHeader>
      <div className="grid gap-4 py-2 sm:grid-cols-2">
        <Field label="Yıl *"><Input type="number" min={2000} max={2100} value={form.yil} onChange={e => set('yil', Number(e.target.value))} /></Field>
        <Field label="Durum"><Input value="Taslak" disabled /></Field>
        <Field label="Ana Konu *"><Input maxLength={300} value={form.anaKonu} onChange={e => set('anaKonu', e.target.value)} /></Field>
        <Field label="Başlık / Süreç *"><Input maxLength={300} value={form.surec} onChange={e => set('surec', e.target.value)} /></Field>
        <Field label="Kısa Başlık"><Input maxLength={200} value={form.kisaBaslik} onChange={e => set('kisaBaslik', e.target.value)} /></Field>
        <Field label="Dış Kurum"><Input maxLength={200} value={form.disKurum} onChange={e => set('disKurum', e.target.value)} /></Field>
        <Field label="Departman *"><AsyncCombobox value={department} onChange={setDepartment} loadOptions={loadDepartments} placeholder="Departman seçin" searchPlaceholder="Departman ara" /></Field>
        <Field label="Ana Sorumlu *"><AsyncCombobox value={anaSorumlu} onChange={setAnaSorumlu} loadOptions={loadUsers} placeholder="Ana sorumlu seçin" searchPlaceholder="Ad veya e-posta ara" minSearchLength={2} /></Field>
        <Field label="Nihai Son Tarih *"><Input type="date" value={form.nihaiSonTarih} onChange={e => set('nihaiSonTarih', e.target.value)} /></Field>
        <Field label="Planlanan Uygulama Tarihi"><Input type="date" value={form.plananUygulamaTarihi} onChange={e => set('plananUygulamaTarihi', e.target.value)} /></Field>
        <Field label="Periyot *"><EnumSelect value={form.periyot} options={PERIYOT_META} onChange={value => set('periyot', value as YillikTakvimPeriyot)} /></Field>
        <Field label="Öncelik *"><EnumSelect value={form.oncelik} options={ONCELIK_META} onChange={value => set('oncelik', value as YillikTakvimOncelik)} /></Field>
        <Field label="Kayıt Türü *"><EnumSelect value={form.kayitTuru} options={KAYIT_TURLERI} onChange={value => set('kayitTuru', value as YillikTakvimKayitTuru)} /></Field>
        <div className="sm:col-span-2"><Field label="Açıklama"><Textarea rows={4} maxLength={5000} value={form.aciklama} onChange={e => set('aciklama', e.target.value)} /></Field></div>
      </div>
      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Vazgeç</Button><Button type="button" onClick={submit} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Kaydet</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label>{label}</Label>{children}</div> }
function EnumSelect({ value, options, onChange }: { value: string; options: Record<string, string>; onChange: (value: string) => void }) {
  return <Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(options).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select>
}
