'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Save, Trash2, CheckCircle2, PlayCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { AsyncCombobox } from './AsyncCombobox'
import { StatusBadge } from './StatusBadge'
import {
  PERSONNEL_TYPE_OPTIONS,
  SEPARATION_TYPE_OPTIONS,
  type OffboardingPersonnelType,
  type OffboardingSeparationType,
  type OffboardingStatus,
} from './constants'

// ─────────────────────────────────────────────────────────────
// Tipler
// ─────────────────────────────────────────────────────────────
interface AssetItem {
  id: string
  sira: number
  label: string
  returned: boolean
  notApplicable: boolean
  note: string | null
}
interface AccessItem {
  id: string
  sira: number
  label: string
  revoked: boolean
  revokedAt: string | null
  appliedBy: string | null
}
interface FormState {
  adSoyad: string
  sicilNo: string
  departman: string
  gorev: string
  iseGirisTarihi: string // YYYY-MM-DD
  ayrilisTarihi: string // YYYY-MM-DD
  personelTuru: OffboardingPersonnelType
  ayrilisTuru: OffboardingSeparationType
  personnelId: string | null
  teslimEdenAd: string
  teslimAlanId: string | null
  beyanOnay: boolean
  notes: string
}
interface PersonnelHit {
  id: string
  adSoyad: string
  sicilNo: string | null
  bolum: string | null
  gorev: string | null
  iseGirisTarihi: string | null
}
interface UserHit {
  id: string
  name: string | null
  email: string
  department?: string | null
}

interface Props {
  mode: 'new' | 'edit'
  id?: string
  canEdit: boolean
  canApprove: boolean
  canDelete: boolean
}

const emptyState: FormState = {
  adSoyad: '',
  sicilNo: '',
  departman: '',
  gorev: '',
  iseGirisTarihi: '',
  ayrilisTarihi: '',
  personelTuru: 'ILERI_MEKANIK',
  ayrilisTuru: 'RESIGNATION',
  personnelId: null,
  teslimEdenAd: '',
  teslimAlanId: null,
  beyanOnay: false,
  notes: '',
}

const toDateInput = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '')
const orNull = (s: string) => (s.trim() ? s.trim() : null)

// ─────────────────────────────────────────────────────────────
// Fetchers (mevcut API'leri tüketir — yeni API yok)
// ─────────────────────────────────────────────────────────────
async function fetchPersonnel(q: string): Promise<PersonnelHit[]> {
  const params = new URLSearchParams({ limit: '20' })
  if (q.trim()) params.set('search', q.trim())
  const res = await fetch(`/api/personnel?${params.toString()}`)
  if (!res.ok) return []
  const json = await res.json()
  return (json.personnel ?? []) as PersonnelHit[]
}
async function fetchDbUsers(q: string): Promise<UserHit[]> {
  const params = new URLSearchParams({ source: 'db' })
  if (q.trim()) params.set('search', q.trim())
  const res = await fetch(`/api/users?${params.toString()}`)
  if (!res.ok) return []
  return (await res.json()) as UserHit[]
}

export function OffboardingFormClient({ mode, id, canEdit, canApprove, canDelete }: Props) {
  const router = useRouter()
  const isEdit = mode === 'edit'

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [acting, setActing] = useState(false)
  const [form, setForm] = useState<FormState>(emptyState)
  const [assetItems, setAssetItems] = useState<AssetItem[]>([])
  const [accessItems, setAccessItems] = useState<AccessItem[]>([])
  const [status, setStatus] = useState<OffboardingStatus>('DRAFT')
  const [formNo, setFormNo] = useState<string>('')
  const [hazirlayanId, setHazirlayanId] = useState<string | null>(null)
  const [onaylayan1Id, setOnaylayan1Id] = useState<string | null>(null)
  const [onaylayan2Id, setOnaylayan2Id] = useState<string | null>(null)
  const [selectedPersonnel, setSelectedPersonnel] = useState<PersonnelHit | null>(null)
  const [selectedReceiver, setSelectedReceiver] = useState<UserHit | null>(null)

  const completed = status === 'COMPLETED'
  // header/items düzenleme: yeni modda create izni, edit modda edit izni + COMPLETED değil
  const editable = isEdit ? canEdit && !completed : true

  const loadForm = useCallback(async () => {
    if (!isEdit || !id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/offboarding/${id}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const f = await res.json()
      setForm({
        adSoyad: f.adSoyad ?? '',
        sicilNo: f.sicilNo ?? '',
        departman: f.departman ?? '',
        gorev: f.gorev ?? '',
        iseGirisTarihi: toDateInput(f.iseGirisTarihi),
        ayrilisTarihi: toDateInput(f.ayrilisTarihi),
        personelTuru: f.personelTuru,
        ayrilisTuru: f.ayrilisTuru,
        personnelId: f.personnelId ?? null,
        teslimEdenAd: f.teslimEdenAd ?? '',
        teslimAlanId: f.teslimAlanId ?? null,
        beyanOnay: f.beyanOnay ?? false,
        notes: f.notes ?? '',
      })
      setAssetItems(f.assetItems ?? [])
      setAccessItems(f.accessItems ?? [])
      setStatus(f.status)
      setFormNo(f.formNo)
      setHazirlayanId(f.hazirlayanId ?? null)
      setOnaylayan1Id(f.onaylayan1Id ?? null)
      setOnaylayan2Id(f.onaylayan2Id ?? null)
      if (f.personnel) setSelectedPersonnel(f.personnel)
      if (f.teslimAlan) setSelectedReceiver(f.teslimAlan)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Form yüklenemedi')
    } finally {
      setLoading(false)
    }
  }, [isEdit, id])

  useEffect(() => {
    loadForm()
  }, [loadForm])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function onPickPersonnel(p: PersonnelHit | null) {
    setSelectedPersonnel(p)
    if (p) {
      // autofill (resolveUserPersonnel mantığına uygun: Personnel master alanları)
      setForm((prev) => ({
        ...prev,
        personnelId: p.id,
        adSoyad: p.adSoyad ?? prev.adSoyad,
        sicilNo: p.sicilNo ?? prev.sicilNo,
        departman: p.bolum ?? prev.departman,
        gorev: p.gorev ?? prev.gorev,
        iseGirisTarihi: toDateInput(p.iseGirisTarihi) || prev.iseGirisTarihi,
      }))
    } else {
      set('personnelId', null)
    }
  }

  function onPickReceiver(u: UserHit | null) {
    setSelectedReceiver(u)
    set('teslimAlanId', u ? u.id : null)
  }

  // ─── Kaydet (yeni: POST / düzenle: PATCH) ───
  async function handleSave() {
    if (!form.adSoyad.trim()) return toast.error('Ad Soyad zorunlu')
    if (!form.ayrilisTarihi) return toast.error('Ayrılış Tarihi zorunlu')
    setSaving(true)
    try {
      if (!isEdit) {
        const body = {
          adSoyad: form.adSoyad.trim(),
          sicilNo: orNull(form.sicilNo),
          departman: orNull(form.departman),
          gorev: orNull(form.gorev),
          iseGirisTarihi: form.iseGirisTarihi || null,
          ayrilisTarihi: form.ayrilisTarihi,
          personelTuru: form.personelTuru,
          ayrilisTuru: form.ayrilisTuru,
          personnelId: form.personnelId,
          notes: orNull(form.notes),
        }
        const res = await fetch('/api/offboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || 'Oluşturma başarısız')
        toast.success(`Form oluşturuldu: ${json.formNo}`)
        router.push(`/offboarding/${json.id}`)
        return
      }
      // PATCH — header + beyan/teslim + item güncellemeleri (status butonlarla)
      const body = {
        adSoyad: form.adSoyad.trim(),
        sicilNo: orNull(form.sicilNo),
        departman: orNull(form.departman),
        gorev: orNull(form.gorev),
        iseGirisTarihi: form.iseGirisTarihi || null,
        ayrilisTarihi: form.ayrilisTarihi,
        personelTuru: form.personelTuru,
        ayrilisTuru: form.ayrilisTuru,
        personnelId: form.personnelId,
        teslimEdenAd: orNull(form.teslimEdenAd),
        teslimAlanId: form.teslimAlanId,
        beyanOnay: form.beyanOnay,
        notes: orNull(form.notes),
        assetItems: assetItems.map((i) => ({
          id: i.id,
          returned: i.returned,
          notApplicable: i.notApplicable,
          note: i.note,
        })),
        accessItems: accessItems.map((i) => ({
          id: i.id,
          revoked: i.revoked,
          revokedAt: i.revokedAt,
          appliedBy: i.appliedBy,
        })),
      }
      const res = await fetch(`/api/offboarding/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Kaydetme başarısız')
      toast.success('Form güncellendi')
      await loadForm()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  // ─── Durum geçişi: İncelemeye Al (DRAFT→IN_PROGRESS) ───
  async function handleStart() {
    setActing(true)
    try {
      const res = await fetch(`/api/offboarding/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'IN_PROGRESS' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Durum güncellenemedi')
      toast.success('Form incelemeye alındı')
      await loadForm()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setActing(false)
    }
  }

  // ─── Onay (approve) ───
  async function handleApprove(field: 'hazirlayanId' | 'onaylayan1Id' | 'onaylayan2Id') {
    setActing(true)
    try {
      const res = await fetch(`/api/offboarding/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Onay başarısız')
      toast.success(json.status === 'COMPLETED' ? 'Onay alındı — form tamamlandı' : 'Onay kaydedildi')
      await loadForm()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setActing(false)
    }
  }

  // ─── Sil ───
  async function handleDelete() {
    setActing(true)
    try {
      const res = await fetch(`/api/offboarding/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error || 'Silme başarısız')
      }
      toast.success('Form silindi')
      router.push('/offboarding')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
      setActing(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-6 py-16 text-center text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
        Yükleniyor...
      </div>
    )
  }

  const canCompleteHint =
    isEdit && status === 'IN_PROGRESS' && form.beyanOnay && !!hazirlayanId && !!onaylayan1Id

  return (
    <div className="container mx-auto px-6 py-8 max-w-5xl space-y-5">
      {/* Başlık */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1 text-slate-500">
            <Link href="/offboarding">
              <ArrowLeft className="h-4 w-4 mr-1" /> İlişik Kesme Listesi
            </Link>
          </Button>
          <h1 className="text-2xl font-bold text-[#1B4F72]">
            {isEdit ? formNo : 'Yeni İlişik Kesme / Zimmet İade'}
          </h1>
          {isEdit && (
            <div className="mt-1">
              <StatusBadge status={status} />
            </div>
          )}
        </div>
        {isEdit && canDelete && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={acting} className="text-destructive border-destructive/30">
                <Trash2 className="h-4 w-4 mr-1" /> Sil
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Form silinsin mi?</AlertDialogTitle>
                <AlertDialogDescription>
                  {formNo} numaralı ilişik kesme formu ve tüm checklist satırları kalıcı olarak silinecek.
                  Bu işlem geri alınamaz.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>İptal</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                  Evet, sil
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {completed && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Bu form tamamlanmıştır ve salt-okunurdur.
        </div>
      )}

      {/* ═══ Bölüm 1 — Personel Bilgileri ═══ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-[#1B4F72]">1 · Personel Bilgileri</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-slate-600">Personel Bağla (opsiyonel — seçince alanlar dolar)</Label>
            <div className="mt-1">
              <AsyncCombobox<PersonnelHit>
                value={selectedPersonnel}
                onSelect={onPickPersonnel}
                fetcher={fetchPersonnel}
                getPrimary={(p) => p.adSoyad}
                getSecondary={(p) => [p.sicilNo, p.bolum].filter(Boolean).join(' · ') || null}
                placeholder="Personel ara..."
                disabled={!editable}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-slate-600">Ad Soyad *</Label>
              <Input value={form.adSoyad} onChange={(e) => set('adSoyad', e.target.value)} disabled={!editable} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-slate-600">Sicil No</Label>
              <Input value={form.sicilNo} onChange={(e) => set('sicilNo', e.target.value)} disabled={!editable} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-slate-600">Departman</Label>
              <Input value={form.departman} onChange={(e) => set('departman', e.target.value)} disabled={!editable} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-slate-600">Görev / Pozisyon</Label>
              <Input value={form.gorev} onChange={(e) => set('gorev', e.target.value)} disabled={!editable} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-slate-600">İşe Giriş Tarihi</Label>
              <Input type="date" value={form.iseGirisTarihi} onChange={(e) => set('iseGirisTarihi', e.target.value)} disabled={!editable} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-slate-600">Ayrılış Tarihi *</Label>
              <Input type="date" value={form.ayrilisTarihi} onChange={(e) => set('ayrilisTarihi', e.target.value)} disabled={!editable} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-slate-600">Personel Türü</Label>
              <Select value={form.personelTuru} onValueChange={(v) => set('personelTuru', v as OffboardingPersonnelType)} disabled={!editable}>
                <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERSONNEL_TYPE_OPTIONS.map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-600">Ayrılış Türü</Label>
              <Select value={form.ayrilisTuru} onValueChange={(v) => set('ayrilisTuru', v as OffboardingSeparationType)} disabled={!editable}>
                <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEPARATION_TYPE_OPTIONS.map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs text-slate-600">Notlar</Label>
            <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} disabled={!editable} className="mt-1" rows={2} />
          </div>
        </CardContent>
      </Card>

      {!isEdit && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Form kaydedildiğinde varsayılan <strong>10 fiziksel varlık</strong> ve{' '}
          <strong>8 yetki/erişim</strong> kalemi otomatik oluşturulur; kaydetme sonrası bu sayfada
          işaretleyebilirsiniz.
        </div>
      )}

      {/* ═══ Bölüm 2/3/4 sadece edit modunda (itemlar create'te üretilir) ═══ */}
      {isEdit && (
        <>
          {/* Bölüm 2 — Fiziksel Varlık İadesi */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-[#1B4F72]">2 · Fiziksel Varlık İadesi</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Varlık</TableHead>
                    <TableHead className="w-28 text-center">İade Edildi</TableHead>
                    <TableHead className="w-28 text-center">İlgili Değil</TableHead>
                    <TableHead>Açıklama / Seri No</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assetItems.map((it, idx) => (
                    <TableRow key={it.id}>
                      <TableCell className="text-xs text-slate-500 tabular-nums">{it.sira}</TableCell>
                      <TableCell className="font-medium text-sm">{it.label}</TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={it.returned}
                          onCheckedChange={(v) => setAssetItems((p) => p.map((x, i) => (i === idx ? { ...x, returned: v } : x)))}
                          disabled={!editable}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={it.notApplicable}
                          onCheckedChange={(v) => setAssetItems((p) => p.map((x, i) => (i === idx ? { ...x, notApplicable: v } : x)))}
                          disabled={!editable}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={it.note ?? ''}
                          onChange={(e) => setAssetItems((p) => p.map((x, i) => (i === idx ? { ...x, note: e.target.value || null } : x)))}
                          disabled={!editable}
                          className="h-8 text-sm"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Bölüm 3 — Mantıksal Yetki / Erişim İadesi */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-[#1B4F72]">3 · Mantıksal Yetki / Erişim İadesi</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Yetki / Erişim</TableHead>
                    <TableHead className="w-28 text-center">Kapatıldı</TableHead>
                    <TableHead className="w-40">Tarih</TableHead>
                    <TableHead>Uygulayan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accessItems.map((it, idx) => (
                    <TableRow key={it.id}>
                      <TableCell className="text-xs text-slate-500 tabular-nums">{it.sira}</TableCell>
                      <TableCell className="font-medium text-sm">{it.label}</TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={it.revoked}
                          onCheckedChange={(v) => setAccessItems((p) => p.map((x, i) => (i === idx ? { ...x, revoked: v } : x)))}
                          disabled={!editable}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={toDateInput(it.revokedAt)}
                          onChange={(e) => setAccessItems((p) => p.map((x, i) => (i === idx ? { ...x, revokedAt: e.target.value || null } : x)))}
                          disabled={!editable}
                          className="h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={it.appliedBy ?? ''}
                          onChange={(e) => setAccessItems((p) => p.map((x, i) => (i === idx ? { ...x, appliedBy: e.target.value || null } : x)))}
                          disabled={!editable}
                          className="h-8 text-sm"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Bölüm 4 — Beyan ve Teslim */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-[#1B4F72]">4 · Beyan ve Teslim</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Switch checked={form.beyanOnay} onCheckedChange={(v) => set('beyanOnay', v)} disabled={!editable} id="beyanOnay" />
                <Label htmlFor="beyanOnay" className="text-sm">
                  Tüm zimmetli varlıkları iade ettiğimi ve yetkilerimin kaldırıldığını beyan ederim.
                </Label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-slate-600">Teslim Eden (Ad)</Label>
                  <Input value={form.teslimEdenAd} onChange={(e) => set('teslimEdenAd', e.target.value)} disabled={!editable} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Teslim Alan (kullanıcı)</Label>
                  <div className="mt-1">
                    <AsyncCombobox<UserHit>
                      value={selectedReceiver}
                      onSelect={onPickReceiver}
                      fetcher={fetchDbUsers}
                      getPrimary={(u) => u.name || u.email}
                      getSecondary={(u) => [u.email, u.department].filter(Boolean).join(' · ') || null}
                      placeholder="Kullanıcı ara..."
                      disabled={!editable}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Durum ve Onay Akışı */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-[#1B4F72]">Durum ve Onay Akışı</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={status} />
                {status === 'DRAFT' && canEdit && (
                  <Button variant="outline" size="sm" onClick={handleStart} disabled={acting}>
                    <PlayCircle className="h-4 w-4 mr-1" /> İncelemeye Al
                  </Button>
                )}
              </div>

              {status === 'IN_PROGRESS' && canApprove && (
                <div className="flex flex-wrap gap-2">
                  <Button variant={hazirlayanId ? 'secondary' : 'default'} size="sm" onClick={() => handleApprove('hazirlayanId')} disabled={acting} className={hazirlayanId ? '' : 'bg-[#1B4F72] hover:bg-[#1B4F72]/90'}>
                    {hazirlayanId ? <CheckCircle2 className="h-4 w-4 mr-1" /> : null}
                    Hazırlayan Onayı
                  </Button>
                  <Button variant={onaylayan1Id ? 'secondary' : 'default'} size="sm" onClick={() => handleApprove('onaylayan1Id')} disabled={acting} className={onaylayan1Id ? '' : 'bg-[#1B4F72] hover:bg-[#1B4F72]/90'}>
                    {onaylayan1Id ? <CheckCircle2 className="h-4 w-4 mr-1" /> : null}
                    1. Onaylayan
                  </Button>
                  <Button variant={onaylayan2Id ? 'secondary' : 'outline'} size="sm" onClick={() => handleApprove('onaylayan2Id')} disabled={acting}>
                    {onaylayan2Id ? <CheckCircle2 className="h-4 w-4 mr-1" /> : null}
                    2. Onaylayan (opsiyonel)
                  </Button>
                </div>
              )}

              {canCompleteHint && (
                <p className="text-xs text-emerald-700">
                  Beyan + Hazırlayan + 1. Onaylayan tamam — bir sonraki onay formu otomatik tamamlar.
                </p>
              )}
              {status === 'IN_PROGRESS' && canApprove && !canCompleteHint && (
                <p className="text-xs text-slate-500">
                  Tamamlanma için: beyan onayı, Hazırlayan ve 1. Onaylayan gerekli.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Kaydet bar */}
      {editable && (
        <div className="sticky bottom-0 -mx-6 border-t bg-white/95 px-6 py-3 backdrop-blur flex items-center justify-end gap-2">
          <Button asChild variant="outline" size="sm" disabled={saving}>
            <Link href="/offboarding">Vazgeç</Link>
          </Button>
          <Button onClick={handleSave} disabled={saving} size="sm" className="bg-[#1B4F72] hover:bg-[#1B4F72]/90">
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            {isEdit ? 'Kaydet' : 'Oluştur'}
          </Button>
        </div>
      )}
    </div>
  )
}
