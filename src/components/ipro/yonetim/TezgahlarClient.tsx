'use client'

import { useEffect, useMemo, useState } from 'react'
import { Pencil, Search, Signal, SignalZero } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ResponsiveTable, type ResponsiveColumn } from '@/components/ui/responsive-table'
import { iproFetch, iproYaz, AktifRozet } from './ortak'

type Tezgah = {
  id: string
  kod: string
  ad: string
  masGrupKodu: string | null
  masGrupAdi: string | null
  ifsWorkCenterNo: string | null
  ifsResourceId: string | null
  aktif: boolean
  sinyalli: boolean
  operatorSayisi: number
}

type Filtre = 'hepsi' | 'aktif' | 'pasif' | 'sinyalli' | 'sinyalsiz'

export function TezgahlarClient({ canEdit }: { canEdit: boolean }) {
  const [tezgahlar, setTezgahlar] = useState<Tezgah[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [arama, setArama] = useState('')
  const [filtre, setFiltre] = useState<Filtre>('hepsi')
  const [duzenlenen, setDuzenlenen] = useState<Tezgah | null>(null)

  async function yukle() {
    setYukleniyor(true)
    const { ok, data } = await iproFetch<{ tezgahlar: Tezgah[] }>('/api/ipro/yonetim/tezgahlar')
    if (ok) setTezgahlar(data.tezgahlar)
    setYukleniyor(false)
  }

  useEffect(() => {
    void yukle()
  }, [])

  const gosterilen = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase('tr')
    return tezgahlar.filter((t) => {
      if (filtre === 'aktif' && !t.aktif) return false
      if (filtre === 'pasif' && t.aktif) return false
      if (filtre === 'sinyalli' && !t.sinyalli) return false
      if (filtre === 'sinyalsiz' && t.sinyalli) return false
      if (!q) return true
      return (
        t.kod.toLocaleLowerCase('tr').includes(q) ||
        t.ad.toLocaleLowerCase('tr').includes(q) ||
        (t.masGrupAdi ?? '').toLocaleLowerCase('tr').includes(q)
      )
    })
  }, [tezgahlar, arama, filtre])

  const kolonlar: ResponsiveColumn<Tezgah>[] = [
    { key: 'kod', label: 'Kod', primary: true },
    { key: 'ad', label: 'Ad' },
    { key: 'masGrupAdi', label: 'MAS Grubu', hideOnMobile: true, render: (t) => t.masGrupAdi ?? '—' },
    {
      key: 'sinyalli',
      label: 'Sinyal',
      badge: true,
      render: (t) =>
        t.sinyalli ? (
          <span className="inline-flex items-center gap-1 text-emerald-700">
            <Signal className="h-4 w-4" /> Sinyalli
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-slate-400">
            <SignalZero className="h-4 w-4" /> Sinyalsiz
          </span>
        ),
    },
    { key: 'operatorSayisi', label: 'Operatör', hideOnMobile: true, render: (t) => String(t.operatorSayisi) },
    { key: 'ifsWorkCenterNo', label: 'IFS WC', hideOnMobile: true, render: (t) => t.ifsWorkCenterNo ?? '—' },
    { key: 'ifsResourceId', label: 'IFS Resource', hideOnMobile: true, render: (t) => t.ifsResourceId ?? '—' },
    { key: 'aktif', label: 'Durum', render: (t) => <AktifRozet aktif={t.aktif} /> },
    ...(canEdit
      ? [
          {
            key: 'islem',
            label: '',
            actions: true,
            render: (t: Tezgah) => (
              <Button variant="ghost" size="sm" onClick={() => setDuzenlenen(t)}>
                <Pencil className="mr-1 h-4 w-4" /> Düzenle
              </Button>
            ),
          } as ResponsiveColumn<Tezgah>,
        ]
      : []),
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            value={arama}
            onChange={(e) => setArama(e.target.value)}
            placeholder="Kod, ad veya MAS grubu ara…"
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {(['hepsi', 'aktif', 'pasif', 'sinyalli', 'sinyalsiz'] as Filtre[]).map((f) => (
            <Button key={f} variant={filtre === f ? 'default' : 'outline'} size="sm" onClick={() => setFiltre(f)}>
              {f === 'hepsi' ? 'Hepsi' : f[0].toLocaleUpperCase('tr') + f.slice(1)}
            </Button>
          ))}
        </div>
        <Badge variant="outline">{gosterilen.length} / {tezgahlar.length}</Badge>
      </div>

      {yukleniyor ? (
        <p className="py-8 text-center text-sm text-slate-500">Yükleniyor…</p>
      ) : (
        <ResponsiveTable columns={kolonlar} data={gosterilen} emptyMessage="Tezgah bulunamadı" />
      )}

      <DuzenleDialog
        tezgah={duzenlenen}
        onKapat={() => setDuzenlenen(null)}
        onKaydedildi={() => {
          setDuzenlenen(null)
          void yukle()
        }}
      />
    </div>
  )
}

function DuzenleDialog({
  tezgah,
  onKapat,
  onKaydedildi,
}: {
  tezgah: Tezgah | null
  onKapat: () => void
  onKaydedildi: () => void
}) {
  const [ad, setAd] = useState('')
  const [wc, setWc] = useState('')
  const [resourceId, setResourceId] = useState('')
  const [aktif, setAktif] = useState(true)
  const [kaydediliyor, setKaydediliyor] = useState(false)

  useEffect(() => {
    if (!tezgah) return
    setAd(tezgah.ad)
    setWc(tezgah.ifsWorkCenterNo ?? '')
    setResourceId(tezgah.ifsResourceId ?? '')
    setAktif(tezgah.aktif)
  }, [tezgah])

  async function kaydet() {
    if (!tezgah) return
    setKaydediliyor(true)
    const ok = await iproYaz(
      `/api/ipro/yonetim/tezgahlar/${tezgah.id}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ ad, ifsWorkCenterNo: wc || null, ifsResourceId: resourceId || null, aktif }),
      },
      `${tezgah.kod} güncellendi`,
    )
    setKaydediliyor(false)
    if (ok) onKaydedildi()
  }

  return (
    <Dialog open={!!tezgah} onOpenChange={(a) => !a && onKapat()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tezgah düzenle — {tezgah?.kod}</DialogTitle>
          <DialogDescription>
            Tezgah kodu MAS kimliğidir, değiştirilemez. Tezgah ekleme/silme MAS import’u ile yapılır.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tz-ad">Ad</Label>
            <Input id="tz-ad" value={ad} onChange={(e) => setAd(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tz-wc">IFS Work Center No</Label>
              <Input id="tz-wc" value={wc} onChange={(e) => setWc(e.target.value)} placeholder="ör. 705" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tz-res">IFS Resource ID</Label>
              <Input
                id="tz-res"
                value={resourceId}
                onChange={(e) => setResourceId(e.target.value)}
                placeholder="ör. 70505"
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border px-4 py-3">
            <Label htmlFor="tz-aktif" className="font-normal">
              Aktif
            </Label>
            <Switch id="tz-aktif" checked={aktif} onCheckedChange={setAktif} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onKapat}>
            Vazgeç
          </Button>
          <Button onClick={kaydet} disabled={kaydediliyor || !ad.trim()}>
            {kaydediliyor ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
