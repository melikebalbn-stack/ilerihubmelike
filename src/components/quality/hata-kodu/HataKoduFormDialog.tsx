'use client'

import { useEffect, useMemo, useState } from 'react'
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
import { UstKodSecici } from './UstKodSecici'
import type { HataKoduFormState, HataKoduRow } from './types'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  /** null → yeni kayıt; dolu → düzenleme */
  kayit: HataKoduRow | null
  /** Tüm kayıtlar — üst kod adayları ve mükerrer kontrolü buradan türetilir */
  tumKayitlar: HataKoduRow[]
  /**
   * Bölüm modu: yeni ANA BAŞLIK açar. Üst kod alanı gösterilmez ve kayıt
   * her hâlükârda `ustKodId = null` gider. Yalnız yeni kayıtta anlamlı —
   * düzenlemede yok sayılır (mevcut bir kaydın üstü hâlâ değiştirilebilir).
   */
  bolumModu?: boolean
  onKaydedildi: () => void
}

function bosForm(ustKodId = ''): HataKoduFormState {
  return { kod: '', ad: '', ustKodId, siraNo: '', aciklama: '', aktif: true }
}

/**
 * `kokId`'nin alt ağacındaki tüm id'ler (kendisi HARİÇ).
 * Üst kod listesinden çıkarmak için — bir kayıt kendi altına bağlanamaz.
 * API'de de döngü kontrolü var; bu, kullanıcıya en baştan göstermemek için.
 */
function altAgacIdleri(kokId: string, rows: HataKoduRow[]): Set<string> {
  const cocuklar = new Map<string, string[]>()
  for (const r of rows) {
    if (!r.ustKodId) continue
    const l = cocuklar.get(r.ustKodId)
    if (l) l.push(r.id)
    else cocuklar.set(r.ustKodId, [r.id])
  }
  const sonuc = new Set<string>()
  const kuyruk = [...(cocuklar.get(kokId) ?? [])]
  while (kuyruk.length > 0) {
    const id = kuyruk.pop()!
    if (sonuc.has(id)) continue // bozuk veriye karşı sonsuz döngü koruması
    sonuc.add(id)
    kuyruk.push(...(cocuklar.get(id) ?? []))
  }
  return sonuc
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
  tumKayitlar,
  bolumModu = false,
  onKaydedildi,
}: Props) {
  const duzenleme = kayit !== null
  /** Bölüm modu yalnız YENİ kayıtta geçerli. */
  const bolum = bolumModu && !duzenleme
  const [form, setForm] = useState<HataKoduFormState>(() => bosForm())
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
        : // Yeni kayıtta üst kod varsayılanı BOŞ (ana başlık).
          bosForm(),
    )
  }, [open, kayit])

  // Mükerrer kod uyarısı — API 409'unu beklemeden, yazarken.
  const kodSayi = Number.parseInt(form.kod, 10)
  const kodGecerli = Number.isInteger(kodSayi) && kodSayi >= 1 && kodSayi <= 9999
  const mukerrer =
    !duzenleme && kodGecerli && tumKayitlar.some((r) => r.kod === kodSayi)

  /**
   * Üst kod adayları: `tip = BOLUM` olan TÜM kayıtlar — altı boş olanlar dahil.
   *
   * Eskiden koşul `ustKodId === null` idi; o eksen yanlıştı çünkü 9 genel
   * uygunsuzluk (kod 1..9) da köktedir ve listeye sızıyordu — bir hata kodu
   * "İş emri yok"un altına bağlanabiliyordu. Artık yalnız gerçek bölümler.
   *
   * Kendisi ve kendi alt ağacı çıkarılır (döngü koruması).
   */
  const ustSecenekleri = useMemo(() => {
    const haric = kayit ? altAgacIdleri(kayit.id, tumKayitlar) : new Set<string>()
    if (kayit) haric.add(kayit.id)
    return tumKayitlar
      .filter((r) => r.tip === 'BOLUM' && !haric.has(r.id))
      .sort((a, b) => a.siraNo - b.siraNo || a.kod - b.kod)
  }, [kayit, tumKayitlar])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    try {
      // Bölüm modunda üst kod alanı hiç gösterilmez → her hâlükârda null gider.
      const ustKodId = bolum || form.ustKodId === '' ? null : form.ustKodId
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
                  // Yeni kayıtta tür açıkça gönderilir. Düzenlemede GÖNDERİLMEZ —
                  // PATCH şemasında `tip` yok, zod zaten soyar.
                  tip: bolum ? 'BOLUM' : 'KOD',
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
            <DialogTitle>
              {duzenleme ? 'Hata Kodu Düzenle' : bolum ? 'Yeni Bölüm' : 'Yeni Hata Kodu'}
            </DialogTitle>
            <DialogDescription>
              {duzenleme
                ? 'Kod değeri değiştirilemez; geçmiş kalite kayıtları bu değere bağlıdır.'
                : bolum
                  ? 'Ana başlık açar — üst kodu olmaz. Kod bir kez kaydedildikten sonra DEĞİŞTİRİLEMEZ.'
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
            {!bolum && (
            <div className={duzenleme ? 'sm:col-span-2' : 'sm:col-span-3'}>
              <Label className="text-xs text-slate-600">Üst kod</Label>
              <div className="mt-1">
                <UstKodSecici
                  value={form.ustKodId === '' ? null : form.ustKodId}
                  onChange={(id) => setForm((f) => ({ ...f, ustKodId: id ?? '' }))}
                  secenekler={ustSecenekleri}
                />
              </div>
              {form.ustKodId === '' && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Üst kod seçilmezse bu kayıt ana başlık olur. Altına kod eklendiğinde ağaçta
                  bölüm olarak görünür.
                </p>
              )}
            </div>
            )}

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
