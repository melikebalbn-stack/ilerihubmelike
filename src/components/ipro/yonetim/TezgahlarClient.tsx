'use client'

import { useEffect, useMemo, useState } from 'react'
import { Pencil, Signal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { iproFetch, iproYaz, AktifRozet, ListeAracCubugu, SiralanabilirTablo, type SiralanabilirKolon } from './ortak'

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

type Durum = 'hepsi' | 'aktif' | 'pasif'
type Sinyal = 'hepsi' | 'sinyalli' | 'sinyalsiz'

export function TezgahlarClient({ canEdit }: { canEdit: boolean }) {
  const [tezgahlar, setTezgahlar] = useState<Tezgah[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [arama, setArama] = useState('')
  const [durum, setDurum] = useState<Durum>('hepsi')
  const [sinyal, setSinyal] = useState<Sinyal>('hepsi')
  const [duzenlenen, setDuzenlenen] = useState<Tezgah | null>(null)

  async function yukle() {
    setYukleniyor(true)
    try {
      const { ok, data } = await iproFetch<{ tezgahlar: Tezgah[] }>('/api/ipro/yonetim/tezgahlar')
      if (ok) setTezgahlar(data.tezgahlar)
    } finally {
      setYukleniyor(false)
    }
  }

  useEffect(() => {
    void yukle()
  }, [])

  const gosterilen = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase('tr')
    return tezgahlar.filter((t) => {
      if (durum === 'aktif' && !t.aktif) return false
      if (durum === 'pasif' && t.aktif) return false
      if (sinyal === 'sinyalli' && !t.sinyalli) return false
      if (sinyal === 'sinyalsiz' && t.sinyalli) return false
      if (!q) return true
      return (
        t.kod.toLocaleLowerCase('tr').includes(q) ||
        t.ad.toLocaleLowerCase('tr').includes(q) ||
        (t.masGrupAdi ?? '').toLocaleLowerCase('tr').includes(q)
      )
    })
  }, [tezgahlar, arama, durum, sinyal])

  const kolonlar: SiralanabilirKolon<Tezgah>[] = [
    { key: 'kod', label: 'Kod', primary: true, siralanabilir: true },
    { key: 'ad', label: 'Ad', siralanabilir: true },
    { key: 'masGrupAdi', label: 'MAS Grubu', hideOnMobile: true, siralanabilir: true, render: (t) => t.masGrupAdi ?? '—' },
    {
      key: 'sinyalli',
      label: 'Sinyal',
      badge: true,
      siralanabilir: true,
      siraTipi: 'bool',
      // Sinyalsizde ikon YOK: lucide SignalZero "sıfır çubuklu sinyal" çiziyor,
      // görüntüsü tek bir noktaya iniyor ve tabloda artefakt gibi duruyordu.
      render: (t) =>
        t.sinyalli ? (
          <span className="inline-flex items-center gap-1.5 text-emerald-700">
            <Signal className="h-4 w-4 shrink-0" />
            Sinyalli
          </span>
        ) : (
          <span className="text-slate-400">Sinyalsiz</span>
        ),
    },
    { key: 'operatorSayisi', label: 'Operatör', hideOnMobile: true, siralanabilir: true, siraTipi: 'sayi', render: (t) => String(t.operatorSayisi) },
    { key: 'ifsWorkCenterNo', label: 'IFS WC', hideOnMobile: true, siralanabilir: true, siraTipi: 'sayi', render: (t) => t.ifsWorkCenterNo ?? '—' },
    { key: 'ifsResourceId', label: 'IFS Resource', hideOnMobile: true, siralanabilir: true, siraTipi: 'sayi', render: (t) => t.ifsResourceId ?? '—' },
    { key: 'aktif', label: 'Durum', siralanabilir: true, siraTipi: 'bool', render: (t) => <AktifRozet aktif={t.aktif} /> },
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
          } as SiralanabilirKolon<Tezgah>,
        ]
      : []),
  ]

  return (
    <div className="space-y-4">
      <ListeAracCubugu
        arama={arama}
        onArama={setArama}
        placeholder="Kod, ad veya MAS grubu ara…"
        gosterilen={gosterilen.length}
        toplam={tezgahlar.length}
        gruplar={[
          {
            ad: 'Durum',
            secili: durum,
            sec: (v) => setDurum(v as Durum),
            secenekler: [
              { deger: 'hepsi', etiket: 'Hepsi' },
              { deger: 'aktif', etiket: 'Aktif' },
              { deger: 'pasif', etiket: 'Pasif' },
            ],
          },
          {
            ad: 'Sinyal',
            secili: sinyal,
            sec: (v) => setSinyal(v as Sinyal),
            secenekler: [
              { deger: 'hepsi', etiket: 'Hepsi' },
              { deger: 'sinyalli', etiket: 'Sinyalli' },
              { deger: 'sinyalsiz', etiket: 'Sinyalsiz' },
            ],
          },
        ]}
      />

      {yukleniyor ? (
        <p className="py-8 text-center text-sm text-slate-500">Yükleniyor…</p>
      ) : (
        <SiralanabilirTablo kolonlar={kolonlar} veri={gosterilen} emptyMessage="Tezgah bulunamadı" />
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
