'use client'

// PR-PERSONNEL-DEPARTMENT-TRANSFER: Bölüm değişikliği talep formu.
// Excel template gerekçe listesi + tek modal scrollable form + validation.

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect as Select } from '@/components/ui/select'
import { Loader2, Check } from 'lucide-react'
import {
  KISI_GEREKCELER,
  IS_GEREKCELER,
  TALEP_EDEN_OPTIONS,
  ONAY_OPTIONS,
} from './constants'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  personnelId: string
  personnelName: string
  currentBolum: string | null
}

interface FormState {
  talepTarihi: string
  talepEden: string
  isgOnayi: string
  doktorOnayi: string
  gerekceler: string[]
  gerekceAciklamasi: string
  gerekceDigerKisi: string
  gerekceDigerIs: string
  digerKisiChecked: boolean
  digerIsChecked: boolean
  transferEdilenBolum: string
  transferTarihi: string
}

const today = () => new Date().toISOString().slice(0, 10)

const initialForm: FormState = {
  talepTarihi: today(),
  talepEden: '',
  isgOnayi: '',
  doktorOnayi: '',
  gerekceler: [],
  gerekceAciklamasi: '',
  gerekceDigerKisi: '',
  gerekceDigerIs: '',
  digerKisiChecked: false,
  digerIsChecked: false,
  transferEdilenBolum: '',
  transferTarihi: today(),
}

interface Department {
  id: string
  name: string
}

export function PersonnelTransferModal({
  open,
  onClose,
  onSaved,
  personnelId,
  personnelName,
  currentBolum,
}: Props) {
  const [form, setForm] = useState<FormState>(initialForm)
  const [departments, setDepartments] = useState<Department[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setForm(initialForm)
      setError(null)
      return
    }
    // Bölüm listesi
    fetch('/api/settings/hr-departments')
      .then((r) => (r.ok ? r.json() : []))
      .then((d: Department[]) => setDepartments(d ?? []))
      .catch(() => setDepartments([]))
  }, [open])

  const toggleGerekce = (value: string) => {
    setForm((prev) => {
      const has = prev.gerekceler.includes(value)
      return {
        ...prev,
        gerekceler: has ? prev.gerekceler.filter((g) => g !== value) : [...prev.gerekceler, value],
      }
    })
  }

  const isValid =
    form.talepTarihi &&
    form.talepEden &&
    form.isgOnayi &&
    form.doktorOnayi &&
    (form.gerekceler.length > 0 || form.digerKisiChecked || form.digerIsChecked) &&
    (!form.digerKisiChecked || form.gerekceDigerKisi.trim().length > 0) &&
    (!form.digerIsChecked || form.gerekceDigerIs.trim().length > 0) &&
    form.transferEdilenBolum &&
    form.transferEdilenBolum.trim() !== (currentBolum ?? '').trim() &&
    form.transferTarihi

  const handleSave = async () => {
    if (!isValid) {
      setError('Tüm zorunlu alanları doldurun ve yeni bölüm mevcut bölümden farklı olsun.')
      return
    }
    setSaving(true)
    setError(null)

    const payload = {
      talepTarihi: form.talepTarihi,
      talepEden: form.talepEden,
      isgOnayi: form.isgOnayi,
      doktorOnayi: form.doktorOnayi,
      gerekceler: form.gerekceler,
      gerekceAciklamasi: form.gerekceAciklamasi.trim() || null,
      gerekceDigerKisi: form.digerKisiChecked ? form.gerekceDigerKisi.trim() : null,
      gerekceDigerIs: form.digerIsChecked ? form.gerekceDigerIs.trim() : null,
      transferEdilenBolum: form.transferEdilenBolum.trim(),
      transferTarihi: form.transferTarihi,
    }

    try {
      const res = await fetch(`/api/personnel/${personnelId}/department-transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Kaydedilemedi.')
        return
      }
      onSaved()
      onClose()
    } catch {
      setError('Sunucu hatası.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bölüm Değişikliği</DialogTitle>
          <DialogDescription>
            {personnelName} — mevcut bölüm: <strong>{currentBolum ?? '(belirtilmemiş)'}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Talep + Onaylar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="talepTarihi">Talep Tarihi *</Label>
              <Input
                id="talepTarihi"
                type="date"
                value={form.talepTarihi}
                onChange={(e) => setForm({ ...form, talepTarihi: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="talepEden">Talep Eden *</Label>
              <Select
                id="talepEden"
                value={form.talepEden}
                onChange={(e) => setForm({ ...form, talepEden: e.target.value })}
              >
                <option value="">Seçiniz</option>
                {TALEP_EDEN_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="isgOnayi">İSG Onayı *</Label>
              <Select
                id="isgOnayi"
                value={form.isgOnayi}
                onChange={(e) => setForm({ ...form, isgOnayi: e.target.value })}
              >
                <option value="">Seçiniz</option>
                {ONAY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="doktorOnayi">Doktor Onayı *</Label>
              <Select
                id="doktorOnayi"
                value={form.doktorOnayi}
                onChange={(e) => setForm({ ...form, doktorOnayi: e.target.value })}
              >
                <option value="">Seçiniz</option>
                {ONAY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </div>
          </div>

          {/* Gerekçeler */}
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Kişi ile ilgili gerekçeler</p>
              <div className="space-y-1.5">
                {KISI_GEREKCELER.map((g) => {
                  const checked = form.gerekceler.includes(g.value)
                  return (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => toggleGerekce(g.value)}
                      className={
                        'w-full text-left flex items-start gap-2 px-3 py-2 rounded-md border text-sm transition-colors ' +
                        (checked
                          ? 'border-[#1B4F72] bg-[#1B4F72]/[0.06] text-slate-900'
                          : 'border-slate-200 hover:border-[#1B4F72]/60')
                      }
                    >
                      <span
                        className={
                          'flex-shrink-0 mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center ' +
                          (checked ? 'border-[#1B4F72] bg-[#1B4F72]' : 'border-slate-300')
                        }
                      >
                        {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                      </span>
                      <span>{g.label}</span>
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => setForm({ ...form, digerKisiChecked: !form.digerKisiChecked })}
                  className={
                    'w-full text-left flex items-start gap-2 px-3 py-2 rounded-md border text-sm transition-colors ' +
                    (form.digerKisiChecked
                      ? 'border-[#1B4F72] bg-[#1B4F72]/[0.06]'
                      : 'border-slate-200 hover:border-[#1B4F72]/60')
                  }
                >
                  <span
                    className={
                      'flex-shrink-0 mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center ' +
                      (form.digerKisiChecked ? 'border-[#1B4F72] bg-[#1B4F72]' : 'border-slate-300')
                    }
                  >
                    {form.digerKisiChecked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                  </span>
                  <span>Diğer (belirtin)</span>
                </button>
                {form.digerKisiChecked && (
                  <Input
                    placeholder="Kişi ile ilgili diğer gerekçe"
                    value={form.gerekceDigerKisi}
                    onChange={(e) => setForm({ ...form, gerekceDigerKisi: e.target.value })}
                  />
                )}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">İş ile ilgili gerekçeler</p>
              <div className="space-y-1.5">
                {IS_GEREKCELER.map((g) => {
                  const checked = form.gerekceler.includes(g.value)
                  return (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => toggleGerekce(g.value)}
                      className={
                        'w-full text-left flex items-start gap-2 px-3 py-2 rounded-md border text-sm transition-colors ' +
                        (checked
                          ? 'border-[#1B4F72] bg-[#1B4F72]/[0.06] text-slate-900'
                          : 'border-slate-200 hover:border-[#1B4F72]/60')
                      }
                    >
                      <span
                        className={
                          'flex-shrink-0 mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center ' +
                          (checked ? 'border-[#1B4F72] bg-[#1B4F72]' : 'border-slate-300')
                        }
                      >
                        {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                      </span>
                      <span>{g.label}</span>
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => setForm({ ...form, digerIsChecked: !form.digerIsChecked })}
                  className={
                    'w-full text-left flex items-start gap-2 px-3 py-2 rounded-md border text-sm transition-colors ' +
                    (form.digerIsChecked
                      ? 'border-[#1B4F72] bg-[#1B4F72]/[0.06]'
                      : 'border-slate-200 hover:border-[#1B4F72]/60')
                  }
                >
                  <span
                    className={
                      'flex-shrink-0 mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center ' +
                      (form.digerIsChecked ? 'border-[#1B4F72] bg-[#1B4F72]' : 'border-slate-300')
                    }
                  >
                    {form.digerIsChecked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                  </span>
                  <span>Diğer (belirtin)</span>
                </button>
                {form.digerIsChecked && (
                  <Input
                    placeholder="İş ile ilgili diğer gerekçe"
                    value={form.gerekceDigerIs}
                    onChange={(e) => setForm({ ...form, gerekceDigerIs: e.target.value })}
                  />
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="gerekceAciklamasi">Genel Açıklama (opsiyonel)</Label>
              <Textarea
                id="gerekceAciklamasi"
                rows={2}
                placeholder="Örn: SAĞLIK RAPORU NEDENİYLE"
                value={form.gerekceAciklamasi}
                onChange={(e) => setForm({ ...form, gerekceAciklamasi: e.target.value })}
              />
            </div>
          </div>

          {/* Transfer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div>
              <Label>Mevcut Bölüm</Label>
              <Input value={currentBolum ?? '(belirtilmemiş)'} disabled className="bg-slate-50" />
            </div>
            <div>
              <Label htmlFor="transferEdilenBolum">Yeni Bölüm *</Label>
              <Select
                id="transferEdilenBolum"
                value={form.transferEdilenBolum}
                onChange={(e) => setForm({ ...form, transferEdilenBolum: e.target.value })}
              >
                <option value="">Seçiniz</option>
                {departments
                  .filter((d) => d.name !== (currentBolum ?? ''))
                  .map((d) => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="transferTarihi">Transfer Tarihi *</Label>
              <Input
                id="transferTarihi"
                type="date"
                value={form.transferTarihi}
                onChange={(e) => setForm({ ...form, transferTarihi: e.target.value })}
              />
            </div>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-md p-3 text-sm text-rose-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            İptal
          </Button>
          <Button onClick={handleSave} disabled={!isValid || saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Kaydet
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
