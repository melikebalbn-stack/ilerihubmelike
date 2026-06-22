'use client'

// PR-PERSONEL-CIKIS-FORMU: Personel pasife alma + çıkış bilgileri formu.
//
// Kullanım modları:
//   create — toggle ile pasife alınan personel için ilk kayıt
//   edit   — zaten pasif olan personelin çıkış bilgileri güncellemesi

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
import { Loader2 } from 'lucide-react'

export interface ExitData {
  exitDate: string
  exitParty: string
  exitCode: string
  exitReason: string
  exitRootCause: string
  exitTurnoverType: string
  exitGeneralNote: string
}

interface Props {
  open: boolean
  onClose: () => void
  onSave: (data: ExitData) => Promise<void>
  personnelName: string
  hireDate: string | null
  initialData?: Partial<ExitData>
  mode: 'create' | 'edit'
}

const EMPTY: ExitData = {
  exitDate: '',
  exitParty: '',
  exitCode: '',
  exitReason: '',
  exitRootCause: '',
  exitTurnoverType: '',
  exitGeneralNote: '',
}

const PARTY_OPTIONS = ['İŞÇİ', 'İŞVEREN', 'KARŞILIKLI']
const TURNOVER_OPTIONS = ['İSTENEN', 'İSTENMEYEN']

function calcWorkingPeriod(hire: string | null, exit: string): { years: number; months: number } | null {
  if (!hire || !exit) return null
  const start = new Date(hire)
  const end = new Date(exit)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null
  let total = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  if (end.getDate() < start.getDate()) total -= 1
  if (total < 0) return null
  return { years: Math.floor(total / 12), months: total % 12 }
}

export function PersonnelExitModal({
  open,
  onClose,
  onSave,
  personnelName,
  hireDate,
  initialData,
  mode,
}: Props) {
  const [data, setData] = useState<ExitData>(EMPTY)
  const [saving, setSaving] = useState(false)

  // open/initialData değişince formu reset et (edit mode için)
  useEffect(() => {
    if (open) {
      setData({
        exitDate: initialData?.exitDate ?? '',
        exitParty: initialData?.exitParty ?? '',
        exitCode: initialData?.exitCode ?? '',
        exitReason: initialData?.exitReason ?? '',
        exitRootCause: initialData?.exitRootCause ?? '',
        exitTurnoverType: initialData?.exitTurnoverType ?? '',
        exitGeneralNote: initialData?.exitGeneralNote ?? '',
      })
    }
  }, [open, initialData])

  const workingPeriod = calcWorkingPeriod(hireDate, data.exitDate)

  const isValid =
    data.exitDate &&
    data.exitParty &&
    data.exitCode &&
    data.exitReason &&
    data.exitRootCause &&
    data.exitTurnoverType

  const handleSave = async () => {
    if (!isValid) return
    setSaving(true)
    try {
      await onSave(data)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Personel Çıkışı' : 'Çıkış Bilgilerini Düzenle'}</DialogTitle>
          <DialogDescription>{personnelName} için çıkış bilgileri</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="exitDate">Çıkış Tarihi *</Label>
            <Input
              id="exitDate"
              type="date"
              value={data.exitDate}
              onChange={(e) => setData({ ...data, exitDate: e.target.value })}
            />
          </div>

          {workingPeriod && (
            <div className="bg-muted px-3 py-2 rounded text-sm">
              Çalışma Süresi:{' '}
              <strong>
                {workingPeriod.years} yıl {workingPeriod.months} ay
              </strong>
              {hireDate && (
                <span className="text-muted-foreground ml-2">
                  ({hireDate.split('T')[0]} → {data.exitDate})
                </span>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="exitParty">Taraf *</Label>
            <Select
              id="exitParty"
              value={data.exitParty}
              onChange={(e) => setData({ ...data, exitParty: e.target.value })}
            >
              <option value="">Seçiniz</option>
              {PARTY_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="exitCode">Çıkış Kodu *</Label>
            <Input
              id="exitCode"
              placeholder="Örn. İSTİFA - DENEME"
              value={data.exitCode}
              onChange={(e) => setData({ ...data, exitCode: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="exitReason">Çıkış Nedeni Açıklama *</Label>
            <Input
              id="exitReason"
              value={data.exitReason}
              onChange={(e) => setData({ ...data, exitReason: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="exitRootCause">Kök Neden *</Label>
            <Input
              id="exitRootCause"
              value={data.exitRootCause}
              onChange={(e) => setData({ ...data, exitRootCause: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="exitTurnoverType">İstenen / İstenmeyen *</Label>
            <Select
              id="exitTurnoverType"
              value={data.exitTurnoverType}
              onChange={(e) => setData({ ...data, exitTurnoverType: e.target.value })}
            >
              <option value="">Seçiniz</option>
              {TURNOVER_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="exitGeneralNote">Açıklama Genel</Label>
            <Textarea
              id="exitGeneralNote"
              rows={3}
              value={data.exitGeneralNote}
              onChange={(e) => setData({ ...data, exitGeneralNote: e.target.value })}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            İptal
          </Button>
          <Button onClick={handleSave} disabled={!isValid || saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
