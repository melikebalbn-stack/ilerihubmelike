'use client'

import { useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ResponsiveTable, type ResponsiveColumn } from '@/components/ui/responsive-table'
import { iproFetch, iproYaz, AktifRozet } from './ortak'

type Esleme = {
  id: string
  tip: 'ORG' | 'POZISYON'
  ilerihubDeger: string
  ifsKod: string
  aciklama: string | null
  aktif: boolean
}

const BOS: Omit<Esleme, 'id'> = { tip: 'ORG', ilerihubDeger: '', ifsKod: '', aciklama: '', aktif: true }

export function IfsEslemeleriClient({ canEdit }: { canEdit: boolean }) {
  const [eslemeler, setEslemeler] = useState<Esleme[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [form, setForm] = useState<(Omit<Esleme, 'id'> & { id?: string }) | null>(null)
  const [silinecek, setSilinecek] = useState<Esleme | null>(null)

  async function yukle() {
    setYukleniyor(true)
    try {
      const { ok, data } = await iproFetch<{ eslemeler: Esleme[] }>('/api/ipro/yonetim/ifs-eslemeleri')
      if (ok) setEslemeler(data.eslemeler)
    } finally {
      setYukleniyor(false)
    }
  }

  useEffect(() => {
    void yukle()
  }, [])

  const kolonlar: ResponsiveColumn<Esleme>[] = [
    { key: 'tip', label: 'Tip', badge: true, render: (e) => <Badge variant="outline">{e.tip}</Badge> },
    { key: 'ilerihubDeger', label: 'ILERIHub değeri', primary: true },
    { key: 'ifsKod', label: 'IFS kodu' },
    { key: 'aciklama', label: 'Açıklama', hideOnMobile: true, render: (e) => e.aciklama ?? '—' },
    { key: 'aktif', label: 'Durum', render: (e) => <AktifRozet aktif={e.aktif} /> },
    ...(canEdit
      ? [
          {
            key: 'islem',
            label: '',
            actions: true,
            render: (e: Esleme) => (
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setForm({ ...e })}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSilinecek(e)}>
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            ),
          } as ResponsiveColumn<Esleme>,
        ]
      : []),
  ]

  async function sil() {
    if (!silinecek) return
    const ok = await iproYaz(
      `/api/ipro/yonetim/ifs-eslemeleri/${silinecek.id}`,
      { method: 'DELETE' },
      'Eşleme silindi',
    )
    setSilinecek(null)
    if (ok) void yukle()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant="outline">{eslemeler.length} eşleme</Badge>
        {canEdit && (
          <Button onClick={() => setForm({ ...BOS })}>
            <Plus className="mr-1 h-4 w-4" /> Yeni eşleme
          </Button>
        )}
      </div>

      {yukleniyor ? (
        <p className="py-8 text-center text-sm text-slate-500">Yükleniyor…</p>
      ) : (
        <ResponsiveTable columns={kolonlar} data={eslemeler} emptyMessage="Eşleme yok" />
      )}

      <FormDialog
        form={form}
        onKapat={() => setForm(null)}
        onKaydedildi={() => {
          setForm(null)
          void yukle()
        }}
      />

      <AlertDialog open={!!silinecek} onOpenChange={(a) => !a && setSilinecek(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eşleme silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{silinecek?.ilerihubDeger}</strong> → {silinecek?.ifsKod} eşlemesi kalıcı olarak silinecek.
              Bu değere sahip personel bir sonraki senkronda <em>eşleşmeyenler</em> listesine düşer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={sil}>Sil</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function FormDialog({
  form,
  onKapat,
  onKaydedildi,
}: {
  form: (Omit<Esleme, 'id'> & { id?: string }) | null
  onKapat: () => void
  onKaydedildi: () => void
}) {
  const [d, setD] = useState<Omit<Esleme, 'id'> & { id?: string }>({ ...BOS })
  const [kaydediliyor, setKaydediliyor] = useState(false)

  useEffect(() => {
    if (form) setD({ ...form })
  }, [form])

  async function kaydet() {
    setKaydediliyor(true)
    const govde = JSON.stringify({
      tip: d.tip,
      ilerihubDeger: d.ilerihubDeger,
      ifsKod: d.ifsKod,
      aciklama: d.aciklama || null,
      aktif: d.aktif,
    })
    const ok = d.id
      ? await iproYaz(`/api/ipro/yonetim/ifs-eslemeleri/${d.id}`, { method: 'PATCH', body: govde }, 'Eşleme güncellendi')
      : await iproYaz('/api/ipro/yonetim/ifs-eslemeleri', { method: 'POST', body: govde }, 'Eşleme eklendi')
    setKaydediliyor(false)
    if (ok) onKaydedildi()
  }

  return (
    <Dialog open={!!form} onOpenChange={(a) => !a && onKapat()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{d.id ? 'Eşleme düzenle' : 'Yeni eşleme'}</DialogTitle>
          <DialogDescription>
            Personel senkronu ILERIHub bölüm/görev değerini önce bu tablodan, tutmazsa IFS’teki aynı isimden çözer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tip</Label>
            <Select value={d.tip} onValueChange={(v) => setD({ ...d, tip: v as Esleme['tip'] })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ORG">ORG — bölüm → IFS OrgCode</SelectItem>
                <SelectItem value="POZISYON">POZISYON — görev → IFS PosCode</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ie-deger">ILERIHub değeri</Label>
            <Input
              id="ie-deger"
              value={d.ilerihubDeger}
              onChange={(e) => setD({ ...d, ilerihubDeger: e.target.value })}
              placeholder={d.tip === 'ORG' ? 'ör. MÜHENDİSLİK' : 'ör. Operatör'}
            />
            <p className="text-xs text-slate-500">Personnel kaydındaki HAM değer (büyük/küçük harf farkı önemsiz).</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ie-kod">IFS kodu</Label>
            <Input
              id="ie-kod"
              value={d.ifsKod}
              onChange={(e) => setD({ ...d, ifsKod: e.target.value })}
              placeholder={d.tip === 'ORG' ? 'ör. 105' : 'ör. 100151'}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ie-aciklama">Açıklama</Label>
            <Input
              id="ie-aciklama"
              value={d.aciklama ?? ''}
              onChange={(e) => setD({ ...d, aciklama: e.target.value })}
              placeholder="Gerekçe — neden bu kod?"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border px-4 py-3">
            <Label htmlFor="ie-aktif" className="font-normal">
              Aktif
            </Label>
            <Switch id="ie-aktif" checked={d.aktif} onCheckedChange={(v) => setD({ ...d, aktif: v })} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onKapat}>
            Vazgeç
          </Button>
          <Button onClick={kaydet} disabled={kaydediliyor || !d.ilerihubDeger.trim() || !d.ifsKod.trim()}>
            {kaydediliyor ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
