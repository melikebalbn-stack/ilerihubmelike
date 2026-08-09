'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { HataKoduFormState, HataKoduRow } from './types'

const UST_YOK = '__yok__'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  /** null → yeni kayıt; dolu → düzenleme */
  kayit: HataKoduRow | null
  /** Üst kod seçeneği olarak sunulacak bölüm başlıkları */
  basliklar: HataKoduRow[]
  /** Mükerrer kod uyarısını anlık vermek için mevcut tüm kodlar */
  mevcutKodlar: number[]
  onKaydedildi: () => void
}

function bosForm(): HataKoduFormState {
  return { kod: '', ad: '', ustKodId: '', siraNo: '', aciklama: '', aktif: true }
}

/**
 * Yeni kod / kod düzenleme formu.
 *
 * `kod` YALNIZ oluşturmada girilir. Düzenlemede salt-okunur ve silik gösterilir —
 * API'nin PATCH şemasında `kod` alanı yok, gönderilse bile yok sayılır.
 * Hata mesajları API'den geldiği gibi gösterilir (409 "aktif=false yapın" dahil);
 * burada kendi metnimizi uydurmuyoruz.
 */
export function HataKoduFormDialog({
  open,
  onOpenChange,
  kayit,
  basliklar,
  mevcutKodlar,
  onKaydedildi,
}: Props) {
  const duzenleme = kayit !== null
  const [form, setForm] = useState<HataKoduFormState>(bosForm)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(
      kayit
        ? {
            kod: String(kayit.kod),
            ad: kayit.ad,
            ustKodId: kayit.ustKodId ?? '',
            siraNo: String(kayit.siraNo),
            aciklama: kayit.aciklama ?? '',
            aktif: kayit.aktif,
          }
        : bosForm(),
    )
  }, [open, kayit])

  // Mükerrer kod uyarısı — API 409'unu beklemeden, yazarken.
  const kodSayi = Number.parseInt(form.kod, 10)
  const kodGecerli = Number.isInteger(kodSayi) && kodSayi >= 1 && kodSayi <= 9999
  const mukerrer = !duzenleme && kodGecerli && mevcutKodlar.includes(kodSayi)

  // Kendi kendinin üstü olamaz — API de reddeder, listede hiç göstermiyoruz.
  const ustSecenekleri = basliklar.filter((b) => b.id !== kayit?.id)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    try {
      const ustKodId = form.ustKodId === '' ? null : form.ustKodId
      const aciklama = form.aciklama.trim() === '' ? null : form.aciklama.trim()

      const res = await fetch(
        duzenleme ? `/api/quality/hata-kodu/${kayit.id}` : '/api/quality/hata-kodu',
        {
          method: duzenleme ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            duzenleme
              ? {
                  ad: form.ad.trim(),
                  ustKodId,
                  siraNo: Number.parseInt(form.siraNo, 10),
                  aciklama,
                  aktif: form.aktif,
                }
              : {
                  kod: kodSayi,
                  ad: form.ad.trim(),
                  ustKodId,
                  aciklama,
                },
          ),
        },
      )
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(json?.error || (duzenleme ? 'Güncelleme başarısız' : 'Oluşturma başarısız'))
      }
      toast.success(duzenleme ? `${form.kod} güncellendi` : `${form.kod} eklendi`)
      onOpenChange(false)
      onKaydedildi()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'İşlem başarısız')
    } finally {
      setSubmitting(false)
    }
  }

  const kaydedilemez =
    submitting ||
    form.ad.trim().length < 2 ||
    (!duzenleme && (!kodGecerli || mukerrer)) ||
    (duzenleme && !Number.isInteger(Number.parseInt(form.siraNo, 10)))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{duzenleme ? `Hata Kodu Düzenle` : 'Yeni Hata Kodu'}</DialogTitle>
            <DialogDescription>
              {duzenleme
                ? 'Kod değeri değiştirilemez; geçmiş kalite kayıtları bu değere bağlıdır.'
                : 'Kod bir kez kaydedildikten sonra DEĞİŞTİRİLEMEZ — geçmiş kayıtlar bu değere bağlanır.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-slate-600">Kod</Label>
              {duzenleme ? (
                <>
                  <Input
                    value={form.kod}
                    readOnly
                    disabled
                    className="mt-1 h-9 font-quality-mono text-slate-400 bg-slate-50"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">kod değiştirilemez</p>
                </>
              ) : (
                <>
                  <Input
                    type="number"
                    min={1}
                    max={9999}
                    value={form.kod}
                    onChange={(e) => setForm((f) => ({ ...f, kod: e.target.value }))}
                    placeholder="örn. 462"
                    className="mt-1 h-9 font-quality-mono"
                    autoFocus
                  />
                  {form.kod !== '' && !kodGecerli && (
                    <p className="mt-1 text-[11px] text-red-600">Kod 1–9999 arası tam sayı olmalı</p>
                  )}
                  {mukerrer && (
                    <p className="mt-1 text-[11px] text-red-600">{kodSayi} kodu zaten kayıtlı</p>
                  )}
                </>
              )}
            </div>

            <div className="sm:col-span-2">
              <Label className="text-xs text-slate-600">Ad</Label>
              <Input
                value={form.ad}
                onChange={(e) => setForm((f) => ({ ...f, ad: e.target.value }))}
                placeholder="örn. Kalıp hatası"
                maxLength={200}
                className="mt-1 h-9"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className={duzenleme ? 'sm:col-span-2' : 'sm:col-span-3'}>
              <Label className="text-xs text-slate-600">Üst kod</Label>
              <Select
                value={form.ustKodId === '' ? UST_YOK : form.ustKodId}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, ustKodId: v === UST_YOK ? '' : v }))
                }
              >
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UST_YOK}>Üst yok (bölüm başlığı / genel)</SelectItem>
                  {ustSecenekleri.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.kod} — {b.ad}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {duzenleme && (
              <div>
                <Label className="text-xs text-slate-600">Sıra no</Label>
                <Input
                  type="number"
                  value={form.siraNo}
                  onChange={(e) => setForm((f) => ({ ...f, siraNo: e.target.value }))}
                  className="mt-1 h-9 font-quality-mono"
                />
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs text-slate-600">Açıklama</Label>
            <Textarea
              value={form.aciklama}
              onChange={(e) => setForm((f) => ({ ...f, aciklama: e.target.value }))}
              placeholder="İsteğe bağlı"
              rows={3}
              className="mt-1"
            />
          </div>

          {duzenleme && (
            <div className="flex items-center gap-2">
              <Switch
                checked={form.aktif}
                onCheckedChange={(v) => setForm((f) => ({ ...f, aktif: v }))}
                id="hk-aktif"
              />
              <Label htmlFor="hk-aktif" className="text-sm text-slate-600">
                Aktif
              </Label>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Vazgeç
            </Button>
            <Button
              type="submit"
              disabled={kaydedilemez}
              className="bg-[#1B4F72] hover:bg-[#1B4F72]/90"
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {duzenleme ? 'Kaydet' : 'Ekle'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
