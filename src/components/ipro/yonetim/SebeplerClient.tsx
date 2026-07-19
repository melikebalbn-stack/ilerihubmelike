'use client'

import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { HURDA_BAYRAKLARI, DURUS_BAYRAKLARI, BITIS_TIPI_SECENEKLERI } from '@/lib/ipro/yonetim-etiketler'
import { iproFetch, iproYaz, AktifRozet, GelismisBolum, ListeAracCubugu, SiralanabilirTablo, type SiralanabilirKolon } from './ortak'

// Bayraklar AÇIKÇA yazılır; `& Record<string, boolean>` kesişimi string alanlarla
// çakışıyor (index signature 'kod: string'i boolean'a zorluyor).
type HurdaSebebi = {
  id: string
  kod: string
  ad: string
  erpKodu: string | null
  grubu: string | null
  uretimHurdaRework: boolean
  rework: boolean
  hurda: boolean
  bilesenHurdaRework: boolean
  oeeEtkiler: boolean
  yorumZorunlu: boolean
  sinyalsizGiris: boolean
  aktif: boolean
}
type DurusTipi = { id: string; kod: string; ad: string; teepOrder: number | null; aktif: boolean; _count: { sebepler: number } }
type DurusSebebi = {
  id: string
  kod: string
  ad: string
  erpKodu: string | null
  tipId: string | null
  tip: { id: string; kod: string; ad: string } | null
  bitisTipi: string
  renkKodu: string | null
  temelSebep: string | null
  planli: boolean
  uretimDisi: boolean
  setupDurusu: boolean
  plcKilitle: boolean
  askiyaAl: boolean
  makineKaynakli: boolean
  operatorKaynakli: boolean
  yetkiliOnayGerekli: boolean
  durusAktifkenIsBitirilemez: boolean
  uretimdeGosterilsin: boolean
  aktif: boolean
}

/** GelismisBolum bayrakları ada göre okur — tipli nesneyi o şekle indirger. */
function bayrakDegerleri(d: object): Record<string, boolean> {
  return d as Record<string, boolean>
}

export function SebeplerClient({ canEdit }: { canEdit: boolean }) {
  return (
    <Tabs defaultValue="hurda">
      <TabsList>
        <TabsTrigger value="hurda">Hurda Sebepleri</TabsTrigger>
        <TabsTrigger value="durus">Duruş Sebepleri</TabsTrigger>
        <TabsTrigger value="tip">Duruş Tipleri</TabsTrigger>
      </TabsList>
      <TabsContent value="hurda" className="mt-4">
        <HurdaSekmesi canEdit={canEdit} />
      </TabsContent>
      <TabsContent value="durus" className="mt-4">
        <DurusSekmesi canEdit={canEdit} />
      </TabsContent>
      <TabsContent value="tip" className="mt-4">
        <TipSekmesi canEdit={canEdit} />
      </TabsContent>
    </Tabs>
  )
}

// ── Hurda ────────────────────────────────────────────────────────────────

function HurdaSekmesi({ canEdit }: { canEdit: boolean }) {
  const [liste, setListe] = useState<HurdaSebebi[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [form, setForm] = useState<Partial<HurdaSebebi> | null>(null)
  const [arama, setArama] = useState('')
  const [durum, setDurum] = useState<'hepsi' | 'aktif' | 'pasif'>('hepsi')

  async function yukle() {
    setYukleniyor(true)
    try {
      const { ok, data } = await iproFetch<{ sebepler: HurdaSebebi[] }>('/api/ipro/yonetim/hurda-sebepleri')
      if (ok) setListe(data.sebepler)
    } finally {
      setYukleniyor(false)
    }
  }
  useEffect(() => {
    void yukle()
  }, [])

  const gosterilen = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase('tr')
    return liste.filter((x) => {
      if (durum === 'aktif' && !x.aktif) return false
      if (durum === 'pasif' && x.aktif) return false
      if (!q) return true
      return (
        x.kod.toLocaleLowerCase('tr').includes(q) ||
        x.ad.toLocaleLowerCase('tr').includes(q) ||
        (x.grubu ?? '').toLocaleLowerCase('tr').includes(q)
      )
    })
  }, [liste, arama, durum])

  const kolonlar: SiralanabilirKolon<HurdaSebebi>[] = [
    { key: 'kod', label: 'Kod', primary: true, siralanabilir: true },
    { key: 'ad', label: 'Ad', siralanabilir: true },
    { key: 'grubu', label: 'Grup', hideOnMobile: true, siralanabilir: true, render: (s) => s.grubu ?? '—' },
    { key: 'erpKodu', label: 'ERP', hideOnMobile: true, siralanabilir: true, render: (s) => s.erpKodu ?? '—' },
    { key: 'aktif', label: 'Durum', siralanabilir: true, siraTipi: 'bool', render: (s) => <AktifRozet aktif={s.aktif} /> },
    ...(canEdit
      ? [
          {
            key: 'islem', label: '', actions: true,
            render: (s: HurdaSebebi) => (
              <Button variant="ghost" size="sm" onClick={() => setForm({ ...s })}>
                <Pencil className="h-4 w-4" />
              </Button>
            ),
          } as SiralanabilirKolon<HurdaSebebi>,
        ]
      : []),
  ]

  return (
    <div className="space-y-4">
      <ListeAracCubugu
        arama={arama}
        onArama={setArama}
        placeholder="Kod, ad veya grup ara…"
        gosterilen={gosterilen.length}
        toplam={liste.length}
        gruplar={[
              {
                ad: 'Durum',
                secili: durum,
                sec: (v) => setDurum(v as typeof durum),
                secenekler: [
                  { deger: 'hepsi', etiket: 'Hepsi' },
                  { deger: 'aktif', etiket: 'Aktif' },
                  { deger: 'pasif', etiket: 'Pasif' },
                ],
              },
        ]}
      >
        {canEdit && (
          <Button onClick={() => setForm({ kod: '', ad: '', hurda: true, oeeEtkiler: true, aktif: true })}>
            <Plus className="mr-1 h-4 w-4" /> Yeni
          </Button>
        )}
      </ListeAracCubugu>
      {yukleniyor ? (
        <p className="py-8 text-center text-sm text-slate-500">Yükleniyor…</p>
      ) : (
        <SiralanabilirTablo kolonlar={kolonlar} veri={gosterilen} emptyMessage="Hurda sebebi yok" />
      )}
      <HurdaForm form={form} onKapat={() => setForm(null)} onKaydedildi={() => { setForm(null); void yukle() }} />
    </div>
  )
}

function HurdaForm({
  form, onKapat, onKaydedildi,
}: { form: Partial<HurdaSebebi> | null; onKapat: () => void; onKaydedildi: () => void }) {
  const [d, setD] = useState<Partial<HurdaSebebi>>({})
  const [kaydediliyor, setKaydediliyor] = useState(false)
  useEffect(() => { if (form) setD({ ...form }) }, [form])

  async function kaydet() {
    setKaydediliyor(true)
    const govde: Record<string, unknown> = { kod: d.kod, ad: d.ad, erpKodu: d.erpKodu || null, grubu: d.grubu || null, aktif: d.aktif }
    for (const b of HURDA_BAYRAKLARI) govde[b.alan] = Boolean(bayrakDegerleri(d)[b.alan])
    const ok = d.id
      ? await iproYaz(`/api/ipro/yonetim/hurda-sebepleri/${d.id}`, { method: 'PATCH', body: JSON.stringify(govde) }, 'Sebep güncellendi')
      : await iproYaz('/api/ipro/yonetim/hurda-sebepleri', { method: 'POST', body: JSON.stringify(govde) }, 'Sebep eklendi')
    setKaydediliyor(false)
    if (ok) onKaydedildi()
  }

  return (
    <Dialog open={!!form} onOpenChange={(a) => !a && onKapat()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{d.id ? `Hurda sebebi — ${d.kod}` : 'Yeni hurda sebebi'}</DialogTitle>
          <DialogDescription>Bayrak adları MAS kolon başlıklarıdır.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="h-kod">Kod</Label>
              <Input id="h-kod" value={d.kod ?? ''} onChange={(e) => setD({ ...d, kod: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="h-erp">ERP kodu</Label>
              <Input id="h-erp" value={d.erpKodu ?? ''} onChange={(e) => setD({ ...d, erpKodu: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="h-ad">Ad</Label>
            <Input id="h-ad" value={d.ad ?? ''} onChange={(e) => setD({ ...d, ad: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="h-grup">Grup</Label>
            <Input id="h-grup" value={d.grubu ?? ''} onChange={(e) => setD({ ...d, grubu: e.target.value })} />
          </div>
          <GelismisBolum
            bayraklar={HURDA_BAYRAKLARI}
            degerler={bayrakDegerleri(d)}
            onDegis={(alan, v) => setD({ ...d, [alan]: v })}
          />
          <div className="flex items-center justify-between rounded-lg border px-4 py-3">
            <Label htmlFor="h-aktif" className="font-normal">Aktif</Label>
            <Switch id="h-aktif" checked={Boolean(d.aktif)} onCheckedChange={(v) => setD({ ...d, aktif: v })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onKapat}>Vazgeç</Button>
          <Button onClick={kaydet} disabled={kaydediliyor || !d.kod?.trim() || !d.ad?.trim()}>
            {kaydediliyor ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Duruş sebepleri ──────────────────────────────────────────────────────

function DurusSekmesi({ canEdit }: { canEdit: boolean }) {
  const [liste, setListe] = useState<DurusSebebi[]>([])
  const [tipler, setTipler] = useState<DurusTipi[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [form, setForm] = useState<Partial<DurusSebebi> | null>(null)
  const [arama, setArama] = useState('')
  const [durum, setDurum] = useState<'hepsi' | 'aktif' | 'pasif'>('hepsi')
  const [bayrak, setBayrak] = useState<'hepsi' | 'planli' | 'uretimDisi' | 'setupDurusu'>('hepsi')

  async function yukle() {
    setYukleniyor(true)
    try {
      const [s, t] = await Promise.all([
        iproFetch<{ sebepler: DurusSebebi[] }>('/api/ipro/yonetim/durus-sebepleri'),
        iproFetch<{ tipler: DurusTipi[] }>('/api/ipro/yonetim/durus-tipleri'),
      ])
      if (s.ok) setListe(s.data.sebepler)
      if (t.ok) setTipler(t.data.tipler)
    } finally {
      setYukleniyor(false)
    }
  }
  useEffect(() => {
    void yukle()
  }, [])

  const gosterilen = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase('tr')
    return liste.filter((x) => {
      if (durum === 'aktif' && !x.aktif) return false
      if (durum === 'pasif' && x.aktif) return false
      if (bayrak !== 'hepsi' && !x[bayrak]) return false
      if (!q) return true
      return (
        x.kod.toLocaleLowerCase('tr').includes(q) ||
        x.ad.toLocaleLowerCase('tr').includes(q) ||
        (x.tip?.ad ?? '').toLocaleLowerCase('tr').includes(q)
      )
    })
  }, [liste, arama, durum, bayrak])

  const kolonlar: SiralanabilirKolon<DurusSebebi>[] = [
    { key: 'kod', label: 'Kod', primary: true, siralanabilir: true },
    { key: 'ad', label: 'Ad', siralanabilir: true },
    { key: 'tip', label: 'Tip', hideOnMobile: true, siralanabilir: true, siraDeger: (s) => s.tip?.ad ?? '', render: (s) => s.tip?.ad ?? '—' },
    { key: 'bitisTipi', label: 'Bitiş', badge: true, siralanabilir: true, render: (s) => <Badge variant="outline">{s.bitisTipi}</Badge> },
    { key: 'aktif', label: 'Durum', siralanabilir: true, siraTipi: 'bool', render: (s) => <AktifRozet aktif={s.aktif} /> },
    ...(canEdit
      ? [
          {
            key: 'islem', label: '', actions: true,
            render: (s: DurusSebebi) => (
              <Button variant="ghost" size="sm" onClick={() => setForm({ ...s })}>
                <Pencil className="h-4 w-4" />
              </Button>
            ),
          } as SiralanabilirKolon<DurusSebebi>,
        ]
      : []),
  ]

  return (
    <div className="space-y-4">
      <ListeAracCubugu
        arama={arama}
        onArama={setArama}
        placeholder="Kod, ad veya tip ara…"
        gosterilen={gosterilen.length}
        toplam={liste.length}
        gruplar={[
              {
                ad: 'Durum',
                secili: durum,
                sec: (v) => setDurum(v as typeof durum),
                secenekler: [
                  { deger: 'hepsi', etiket: 'Hepsi' },
                  { deger: 'aktif', etiket: 'Aktif' },
                  { deger: 'pasif', etiket: 'Pasif' },
                ],
              },
          {
            ad: 'Tür',
            secili: bayrak,
            sec: (v) => setBayrak(v as typeof bayrak),
            secenekler: [
              { deger: 'hepsi', etiket: 'Hepsi' },
              { deger: 'planli', etiket: 'Planlı' },
              { deger: 'uretimDisi', etiket: 'Üretim Dışı' },
              { deger: 'setupDurusu', etiket: 'Setup' },
            ],
          },
        ]}
      >
        {canEdit && (
          <Button onClick={() => setForm({ kod: '', ad: '', bitisTipi: 'Both', uretimdeGosterilsin: true, aktif: true })}>
            <Plus className="mr-1 h-4 w-4" /> Yeni
          </Button>
        )}
      </ListeAracCubugu>
      {yukleniyor ? (
        <p className="py-8 text-center text-sm text-slate-500">Yükleniyor…</p>
      ) : (
        <SiralanabilirTablo kolonlar={kolonlar} veri={gosterilen} emptyMessage="Duruş sebebi yok" />
      )}
      <DurusForm
        form={form}
        tipler={tipler}
        onKapat={() => setForm(null)}
        onKaydedildi={() => { setForm(null); void yukle() }}
      />
    </div>
  )
}

const TIP_YOK = '__yok__'

function DurusForm({
  form, tipler, onKapat, onKaydedildi,
}: { form: Partial<DurusSebebi> | null; tipler: DurusTipi[]; onKapat: () => void; onKaydedildi: () => void }) {
  const [d, setD] = useState<Partial<DurusSebebi>>({})
  const [kaydediliyor, setKaydediliyor] = useState(false)
  useEffect(() => { if (form) setD({ ...form }) }, [form])

  async function kaydet() {
    setKaydediliyor(true)
    const govde: Record<string, unknown> = {
      kod: d.kod, ad: d.ad, bitisTipi: d.bitisTipi, erpKodu: d.erpKodu || null,
      tipId: d.tipId || null, renkKodu: d.renkKodu || null, temelSebep: d.temelSebep || null, aktif: d.aktif,
    }
    for (const b of DURUS_BAYRAKLARI) govde[b.alan] = Boolean(bayrakDegerleri(d)[b.alan])
    const ok = d.id
      ? await iproYaz(`/api/ipro/yonetim/durus-sebepleri/${d.id}`, { method: 'PATCH', body: JSON.stringify(govde) }, 'Sebep güncellendi')
      : await iproYaz('/api/ipro/yonetim/durus-sebepleri', { method: 'POST', body: JSON.stringify(govde) }, 'Sebep eklendi')
    setKaydediliyor(false)
    if (ok) onKaydedildi()
  }

  return (
    <Dialog open={!!form} onOpenChange={(a) => !a && onKapat()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{d.id ? `Duruş sebebi — ${d.kod}` : 'Yeni duruş sebebi'}</DialogTitle>
          <DialogDescription>Bayrak adları MAS kolon başlıklarıdır.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="d-kod">Kod</Label>
              <Input id="d-kod" value={d.kod ?? ''} onChange={(e) => setD({ ...d, kod: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-erp">ERP kodu</Label>
              <Input id="d-erp" value={d.erpKodu ?? ''} onChange={(e) => setD({ ...d, erpKodu: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-ad">Ad</Label>
            <Input id="d-ad" value={d.ad ?? ''} onChange={(e) => setD({ ...d, ad: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Duruş tipi</Label>
              <Select
                value={d.tipId ?? TIP_YOK}
                onValueChange={(v) => setD({ ...d, tipId: v === TIP_YOK ? null : v })}
              >
                <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TIP_YOK}>— yok —</SelectItem>
                  {tipler.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.kod} — {t.ad}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Bitiş tipi</Label>
              <Select value={d.bitisTipi ?? 'Both'} onValueChange={(v) => setD({ ...d, bitisTipi: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BITIS_TIPI_SECENEKLERI.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="d-renk">Renk kodu</Label>
              <Input id="d-renk" value={d.renkKodu ?? ''} onChange={(e) => setD({ ...d, renkKodu: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-temel">Temel sebep kodu</Label>
              <Input id="d-temel" value={d.temelSebep ?? ''} onChange={(e) => setD({ ...d, temelSebep: e.target.value })} />
            </div>
          </div>
          <GelismisBolum
            bayraklar={DURUS_BAYRAKLARI}
            degerler={bayrakDegerleri(d)}
            onDegis={(alan, v) => setD({ ...d, [alan]: v })}
          />
          <div className="flex items-center justify-between rounded-lg border px-4 py-3">
            <Label htmlFor="d-aktif" className="font-normal">Aktif</Label>
            <Switch id="d-aktif" checked={Boolean(d.aktif)} onCheckedChange={(v) => setD({ ...d, aktif: v })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onKapat}>Vazgeç</Button>
          <Button onClick={kaydet} disabled={kaydediliyor || !d.kod?.trim() || !d.ad?.trim()}>
            {kaydediliyor ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Duruş tipleri ────────────────────────────────────────────────────────

function TipSekmesi({ canEdit }: { canEdit: boolean }) {
  const [liste, setListe] = useState<DurusTipi[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [form, setForm] = useState<Partial<DurusTipi> | null>(null)
  const [arama, setArama] = useState('')
  const [durum, setDurum] = useState<'hepsi' | 'aktif' | 'pasif'>('hepsi')

  async function yukle() {
    setYukleniyor(true)
    try {
      const { ok, data } = await iproFetch<{ tipler: DurusTipi[] }>('/api/ipro/yonetim/durus-tipleri')
      if (ok) setListe(data.tipler)
    } finally {
      setYukleniyor(false)
    }
  }
  useEffect(() => {
    void yukle()
  }, [])

  const gosterilen = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase('tr')
    return liste.filter((x) => {
      if (durum === 'aktif' && !x.aktif) return false
      if (durum === 'pasif' && x.aktif) return false
      if (!q) return true
      return x.kod.toLocaleLowerCase('tr').includes(q) || x.ad.toLocaleLowerCase('tr').includes(q)
    })
  }, [liste, arama, durum])

  const kolonlar: SiralanabilirKolon<DurusTipi>[] = [
    { key: 'kod', label: 'Kod', primary: true, siralanabilir: true },
    { key: 'ad', label: 'Ad', siralanabilir: true },
    { key: 'teepOrder', label: 'TEEP sırası', hideOnMobile: true, siralanabilir: true, siraTipi: 'sayi', render: (t) => (t.teepOrder ?? '—').toString() },
    { key: 'sebepSayisi', label: 'Sebep', hideOnMobile: true, siralanabilir: true, siraTipi: 'sayi', siraDeger: (t) => t._count.sebepler, render: (t) => String(t._count.sebepler) },
    { key: 'aktif', label: 'Durum', siralanabilir: true, siraTipi: 'bool', render: (t) => <AktifRozet aktif={t.aktif} /> },
    ...(canEdit
      ? [
          {
            key: 'islem', label: '', actions: true,
            render: (t: DurusTipi) => (
              <Button variant="ghost" size="sm" onClick={() => setForm({ ...t })}>
                <Pencil className="h-4 w-4" />
              </Button>
            ),
          } as SiralanabilirKolon<DurusTipi>,
        ]
      : []),
  ]

  async function kaydet(d: Partial<DurusTipi>) {
    const govde = JSON.stringify({ kod: d.kod, ad: d.ad, teepOrder: d.teepOrder ?? null, aktif: d.aktif })
    const ok = d.id
      ? await iproYaz(`/api/ipro/yonetim/durus-tipleri/${d.id}`, { method: 'PATCH', body: govde }, 'Tip güncellendi')
      : await iproYaz('/api/ipro/yonetim/durus-tipleri', { method: 'POST', body: govde }, 'Tip eklendi')
    if (ok) { setForm(null); void yukle() }
  }

  return (
    <div className="space-y-4">
      <ListeAracCubugu
        arama={arama}
        onArama={setArama}
        placeholder="Kod veya ad ara…"
        gosterilen={gosterilen.length}
        toplam={liste.length}
        gruplar={[
              {
                ad: 'Durum',
                secili: durum,
                sec: (v) => setDurum(v as typeof durum),
                secenekler: [
                  { deger: 'hepsi', etiket: 'Hepsi' },
                  { deger: 'aktif', etiket: 'Aktif' },
                  { deger: 'pasif', etiket: 'Pasif' },
                ],
              },
        ]}
      >
        {canEdit && (
          <Button onClick={() => setForm({ kod: '', ad: '', aktif: true })}>
            <Plus className="mr-1 h-4 w-4" /> Yeni
          </Button>
        )}
      </ListeAracCubugu>
      {yukleniyor ? (
        <p className="py-8 text-center text-sm text-slate-500">Yükleniyor…</p>
      ) : (
        <SiralanabilirTablo kolonlar={kolonlar} veri={gosterilen} emptyMessage="Duruş tipi yok" />
      )}
      <TipForm form={form} onKapat={() => setForm(null)} onKaydet={kaydet} />
    </div>
  )
}

function TipForm({
  form, onKapat, onKaydet,
}: { form: Partial<DurusTipi> | null; onKapat: () => void; onKaydet: (d: Partial<DurusTipi>) => Promise<void> }) {
  const [d, setD] = useState<Partial<DurusTipi>>({})
  const [kaydediliyor, setKaydediliyor] = useState(false)
  useEffect(() => { if (form) setD({ ...form }) }, [form])

  return (
    <Dialog open={!!form} onOpenChange={(a) => !a && onKapat()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{d.id ? `Duruş tipi — ${d.kod}` : 'Yeni duruş tipi'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="t-kod">Kod</Label>
              <Input id="t-kod" value={d.kod ?? ''} onChange={(e) => setD({ ...d, kod: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-teep">TEEP sırası</Label>
              <Input
                id="t-teep"
                type="number"
                value={d.teepOrder ?? ''}
                onChange={(e) => setD({ ...d, teepOrder: e.target.value === '' ? null : Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-ad">Ad</Label>
            <Input id="t-ad" value={d.ad ?? ''} onChange={(e) => setD({ ...d, ad: e.target.value })} />
          </div>
          <div className="flex items-center justify-between rounded-lg border px-4 py-3">
            <Label htmlFor="t-aktif" className="font-normal">Aktif</Label>
            <Switch id="t-aktif" checked={Boolean(d.aktif)} onCheckedChange={(v) => setD({ ...d, aktif: v })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onKapat}>Vazgeç</Button>
          <Button
            onClick={async () => { setKaydediliyor(true); await onKaydet(d); setKaydediliyor(false) }}
            disabled={kaydediliyor || !d.kod?.trim() || !d.ad?.trim()}
          >
            {kaydediliyor ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
