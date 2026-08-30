'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowLeft, ChevronDown, ChevronUp, Clock, GripVertical, Plus, Trash2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Guzergah = { id: string; kod: string; ad: string; aktif: boolean }
type SecilebilirDurak = { id: string; kod: string; ad: string }
type SeferDilimi = { id: string; kod: string; ad: string; yon: 'GIDIS' | 'DONUS' }
type GuzergahDurakSaat = { id: string; dilimId: string; saat: string; dilim: SeferDilimi }
type GuzergahDurak = {
  id: string
  durakId: string
  durak: { id: string; kod: string; ad: string; aktif: boolean }
  sira: number
  aktif: boolean
  saatler: GuzergahDurakSaat[]
}

type ServisRol = 'ANA' | 'YEDEK'
type SecilebilirArac = { id: string; plaka: string }
type SecilebilirSofor = { id: string; adSoyad: string }

type AracVarsayilan = {
  id: string
  dilimId: string
  dilim: SeferDilimi
  aracId: string
  arac: { id: string; plaka: string; aktif: boolean }
  rol: ServisRol
  baslangicTarihi: string
  bitisTarihi: string | null
  aktif: boolean
  neden: string | null
  aciklama: string | null
}

type SoforVarsayilan = {
  id: string
  dilimId: string
  dilim: SeferDilimi
  soforId: string
  sofor: { id: string; adSoyad: string; aktif: boolean }
  rol: ServisRol
  baslangicTarihi: string
  bitisTarihi: string | null
  aktif: boolean
  neden: string | null
  aciklama: string | null
}

type SorumluPickedPersonel = { id: string; sicilNo: string | null; adSoyad: string }

type Sorumlu = {
  id: string
  personnelId: string
  personnel: { id: string; adSoyad: string; sicilNo: string | null; aktif: boolean }
  rol: ServisRol
  baslangicTarihi: string
  bitisTarihi: string | null
  aktif: boolean
  neden: string | null
  aciklama: string | null
}

type PersonelAtamaDilim = { id: string; dilimId: string; dilim: SeferDilimi }

type PersonelAtama = {
  id: string
  personnelId: string
  personnel: { id: string; adSoyad: string; sicilNo: string | null; bolum: string; aktif: boolean }
  durakId: string | null
  durak: { id: string; kod: string; ad: string } | null
  baslangicTarihi: string
  bitisTarihi: string | null
  aktif: boolean
  dilimler: PersonelAtamaDilim[]
}

function AktifRozet({ aktif }: { aktif: boolean }) {
  return <Badge variant={aktif ? 'default' : 'secondary'}>{aktif ? 'Aktif' : 'Pasif'}</Badge>
}

export default function GuzergahDetayPage() {
  const params = useParams()
  const guzergahId = (params?.id as string) || ''
  const { data: session } = useSession()
  const permissions = session?.user?.permissions || []
  const canView = permissions.includes('servis.view')
  const canManage = permissions.includes('servis.tanim.manage')
  const canSorumluManage = permissions.includes('servis.sorumlu.manage')
  const canPersonelAtamaManage = permissions.includes('servis.create')
  const canPassive = permissions.includes('servis.passive')
  const canRestore = permissions.includes('servis.restore')

  const [guzergah, setGuzergah] = useState<Guzergah | null>(null)
  const [duraklar, setDuraklar] = useState<GuzergahDurak[]>([])
  const [dilimler, setDilimler] = useState<SeferDilimi[]>([])
  const [secilebilirDuraklar, setSecilebilirDuraklar] = useState<SecilebilirDurak[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)
  const [siralamaDegisiyor, setSiralamaDegisiyor] = useState<string | null>(null)

  const [durakEkleAcik, setDurakEkleAcik] = useState(false)
  const [eklenecekDurakId, setEklenecekDurakId] = useState('')

  const [saatDuzenlenen, setSaatDuzenlenen] = useState<GuzergahDurak | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const yukle = useCallback(async () => {
    if (!guzergahId) return
    setYukleniyor(true)
    setHata(null)
    try {
      const [guzergahRes, durakRes, dilimRes, tumDurakRes] = await Promise.all([
        fetch(`/api/servis-yonetimi/guzergah/${guzergahId}`),
        fetch(`/api/servis-yonetimi/guzergah/${guzergahId}/durak`),
        fetch('/api/servis-yonetimi/sefer-dilimi?durum=aktif'),
        fetch('/api/servis-yonetimi/durak?durum=aktif'),
      ])
      const [guzergahJson, durakJson, dilimJson, tumDurakJson] = await Promise.all([
        guzergahRes.json(),
        durakRes.json(),
        dilimRes.json(),
        tumDurakRes.json(),
      ])
      if (!guzergahRes.ok || !guzergahJson.ok) {
        setHata(guzergahJson.message || 'Güzergâh bulunamadı.')
        return
      }
      if (!durakRes.ok || !durakJson.ok) {
        setHata(durakJson.message || 'Durak listesi alınamadı.')
        return
      }
      setGuzergah(guzergahJson.data)
      setDuraklar(durakJson.data)
      setDilimler(dilimRes.ok && dilimJson.ok ? dilimJson.data : [])
      setSecilebilirDuraklar(tumDurakRes.ok && tumDurakJson.ok ? tumDurakJson.data : [])
    } catch {
      setHata('Veriler alınırken beklenmeyen bir hata oluştu.')
    } finally {
      setYukleniyor(false)
    }
  }, [guzergahId])

  useEffect(() => {
    yukle()
  }, [yukle])

  if (!canView) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Bu sayfayı görüntüleme yetkiniz yok.</p>
      </div>
    )
  }

  const aktifDuraklar = duraklar.filter((d) => d.aktif)
  const pasifDuraklar = duraklar.filter((d) => !d.aktif)
  const eklenebilirDuraklar = secilebilirDuraklar.filter(
    (d) => !duraklar.some((gd) => gd.durakId === d.id && gd.aktif),
  )

  function durakEkleAc() {
    setEklenecekDurakId(eklenebilirDuraklar[0]?.id || '')
    setDurakEkleAcik(true)
  }

  async function durakEkle() {
    setHata(null)
    const res = await fetch(`/api/servis-yonetimi/guzergah/${guzergahId}/durak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durakId: eklenecekDurakId }),
    })
    const json = await res.json()
    if (!res.ok || !json.ok) {
      setHata(json.message || 'Durak eklenemedi.')
      return
    }
    setDurakEkleAcik(false)
    yukle()
  }

  async function siraDegistir(guzergahDurakId: string, yon: 'YUKARI' | 'ASAGI') {
    setSiralamaDegisiyor(guzergahDurakId)
    try {
      const res = await fetch(`/api/servis-yonetimi/guzergah/${guzergahId}/durak/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guzergahDurakId, yon }),
      })
      if (!res.ok) {
        setHata('Sıralama değiştirilemedi.')
        return
      }
      await yukle()
    } finally {
      setSiralamaDegisiyor(null)
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const eskiIndex = aktifDuraklar.findIndex((d) => d.id === active.id)
    const yeniIndex = aktifDuraklar.findIndex((d) => d.id === over.id)
    if (eskiIndex < 0 || yeniIndex < 0) return

    const yeniSirali = arrayMove(aktifDuraklar, eskiIndex, yeniIndex)
    setDuraklar([...yeniSirali, ...pasifDuraklar])

    const res = await fetch(`/api/servis-yonetimi/guzergah/${guzergahId}/durak/reorder-bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guzergahDurakIdleri: yeniSirali.map((d) => d.id) }),
    })
    if (!res.ok) {
      setHata('Sıralama kaydedilemedi.')
    }
    await yukle()
  }

  async function pasiflestir(id: string) {
    await fetch(`/api/servis-yonetimi/guzergah-durak/${id}/pasiflestir`, { method: 'POST' })
    yukle()
  }

  async function geriAl(id: string) {
    await fetch(`/api/servis-yonetimi/guzergah-durak/${id}/geri-al`, { method: 'POST' })
    yukle()
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <Link href="/servis-yonetimi" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ArrowLeft className="h-4 w-4" /> Servis Yönetimi'ne dön
        </Link>
        {guzergah && (
          <div className="mt-2 flex items-center gap-3">
            <h1 className="text-2xl font-semibold">
              {guzergah.kod} — {guzergah.ad}
            </h1>
            <AktifRozet aktif={guzergah.aktif} />
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          Güzergâhın durak sırası, dilim bazlı saatleri ve varsayılan araç/şoför atamaları.
        </p>
      </div>

      {hata && <p className="text-sm text-red-600">{hata}</p>}

      {yukleniyor ? (
        <p className="text-sm text-muted-foreground">Yükleniyor...</p>
      ) : (
        <Tabs defaultValue="duraklar">
          <TabsList>
            <TabsTrigger value="duraklar">Duraklar</TabsTrigger>
            <TabsTrigger value="arac-varsayilan">Varsayılan Araçlar</TabsTrigger>
            <TabsTrigger value="sofor-varsayilan">Varsayılan Şoförler</TabsTrigger>
            <TabsTrigger value="sorumlu">Servis Sorumluları</TabsTrigger>
            <TabsTrigger value="personel-atama">Personel Atamaları</TabsTrigger>
          </TabsList>

          <TabsContent value="duraklar" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">Duraklar ({aktifDuraklar.length})</h2>
              {canManage && (
                <Button onClick={durakEkleAc} disabled={eklenebilirDuraklar.length === 0} size="sm">
                  <Plus className="mr-2 h-4 w-4" /> Durak Ekle
                </Button>
              )}
            </div>

            {aktifDuraklar.length === 0 && (
              <p className="text-sm text-muted-foreground border border-dashed rounded-md p-6 text-center">
                Henüz durak eklenmemiş.
              </p>
            )}

            {aktifDuraklar.length > 0 && (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={aktifDuraklar.map((d) => d.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {aktifDuraklar.map((d, index) => (
                      <SiraliDurakSatiri
                        key={d.id}
                        durak={d}
                        index={index}
                        total={aktifDuraklar.length}
                        canManage={canManage}
                        canPassive={canPassive}
                        siralamaDegisiyor={siralamaDegisiyor === d.id}
                        onUp={() => siraDegistir(d.id, 'YUKARI')}
                        onDown={() => siraDegistir(d.id, 'ASAGI')}
                        onSaatler={() => setSaatDuzenlenen(d)}
                        onPasiflestir={() => pasiflestir(d.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            {pasifDuraklar.length > 0 && (
              <div className="pt-4 space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Pasif Duraklar</h3>
                {pasifDuraklar.map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    <span>{d.durak.kod} — {d.durak.ad}</span>
                    {canRestore && (
                      <Button size="sm" variant="outline" onClick={() => geriAl(d.id)}>
                        Geri Al
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="arac-varsayilan">
            <VarsayilanAraclarPanel
              guzergahId={guzergahId}
              dilimler={dilimler}
              canManage={canManage}
              canPassive={canPassive}
              canRestore={canRestore}
            />
          </TabsContent>

          <TabsContent value="sofor-varsayilan">
            <VarsayilanSoforlerPanel
              guzergahId={guzergahId}
              dilimler={dilimler}
              canManage={canManage}
              canPassive={canPassive}
              canRestore={canRestore}
            />
          </TabsContent>

          <TabsContent value="sorumlu">
            <SorumlularPanel
              guzergahId={guzergahId}
              canSorumluManage={canSorumluManage}
              canPassive={canPassive}
              canRestore={canRestore}
            />
          </TabsContent>

          <TabsContent value="personel-atama">
            <PersonelAtamalarPanel
              guzergahId={guzergahId}
              aktifDuraklar={aktifDuraklar}
              dilimler={dilimler}
              canManage={canPersonelAtamaManage}
              canPassive={canPassive}
              canRestore={canRestore}
            />
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={durakEkleAcik} onOpenChange={setDurakEkleAcik}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Güzergaha Durak Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="durak-ekle-secim">Durak *</Label>
              <select
                id="durak-ekle-secim"
                value={eklenecekDurakId}
                onChange={(e) => setEklenecekDurakId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Durak seçin</option>
                {eklenebilirDuraklar.map((durak) => (
                  <option key={durak.id} value={durak.id}>{durak.kod} — {durak.ad}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={durakEkle} disabled={!eklenecekDurakId}>Ekle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SaatlerDialog
        guzergahDurak={saatDuzenlenen}
        dilimler={dilimler}
        canManage={canManage}
        onOpenChange={(open) => !open && setSaatDuzenlenen(null)}
        onSaved={yukle}
      />
    </div>
  )
}

function SiraliDurakSatiri({
  durak: d,
  index,
  total,
  canManage,
  canPassive,
  siralamaDegisiyor,
  onUp,
  onDown,
  onSaatler,
  onPasiflestir,
}: {
  durak: GuzergahDurak
  index: number
  total: number
  canManage: boolean
  canPassive: boolean
  siralamaDegisiyor: boolean
  onUp: () => void
  onDown: () => void
  onSaatler: () => void
  onPasiflestir: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: d.id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-3 rounded-md border p-3 bg-background ${isDragging ? 'shadow-lg' : ''}`}
    >
      {canManage && (
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab rounded p-1 hover:bg-accent active:cursor-grabbing"
          title="Sürükle"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
      {canManage && (
        <div className="flex flex-col gap-0.5 pt-0.5">
          <button
            onClick={onUp}
            disabled={index === 0 || siralamaDegisiyor}
            className="rounded p-0.5 hover:bg-accent disabled:opacity-30"
            title="Yukarı taşı"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            onClick={onDown}
            disabled={index === total - 1 || siralamaDegisiyor}
            className="rounded p-0.5 hover:bg-accent disabled:opacity-30"
            title="Aşağı taşı"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground">#{index + 1}</span>
          <span className="font-medium">{d.durak.kod} — {d.durak.ad}</span>
        </div>
        {d.saatler.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-2">
            {d.saatler.map((s) => (
              <span key={s.id} className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                {s.dilim.kod} ({s.dilim.yon === 'GIDIS' ? 'Gidiş' : 'Dönüş'}): {s.saat}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1">
        {canManage && (
          <Button size="sm" variant="outline" onClick={onSaatler}>
            <Clock className="mr-1.5 h-3.5 w-3.5" /> Saatleri Düzenle
          </Button>
        )}
        {canPassive && (
          <Button size="sm" variant="destructive" onClick={onPasiflestir}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}

function SaatlerDialog({
  guzergahDurak,
  dilimler,
  canManage,
  onOpenChange,
  onSaved,
}: {
  guzergahDurak: GuzergahDurak | null
  dilimler: SeferDilimi[]
  canManage: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [saatler, setSaatler] = useState<Record<string, string>>({})
  const [hata, setHata] = useState<string | null>(null)

  useEffect(() => {
    if (!guzergahDurak) {
      setSaatler({})
      return
    }
    const baslangic: Record<string, string> = {}
    for (const s of guzergahDurak.saatler) baslangic[s.dilimId] = s.saat
    setSaatler(baslangic)
  }, [guzergahDurak])

  if (!guzergahDurak) {
    return <Dialog open={false} onOpenChange={onOpenChange}><DialogContent /></Dialog>
  }

  async function kaydet(dilimId: string) {
    setHata(null)
    const saat = saatler[dilimId]?.trim()
    if (!saat) return
    const res = await fetch(`/api/servis-yonetimi/guzergah-durak/${guzergahDurak!.id}/saat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dilimId, saat }),
    })
    const json = await res.json()
    if (!res.ok || !json.ok) {
      setHata(json.message || 'Saat kaydedilemedi.')
      return
    }
    onSaved()
  }

  async function sil(saatId: string, dilimId: string) {
    setHata(null)
    const res = await fetch(`/api/servis-yonetimi/guzergah-durak-saat/${saatId}`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok || !json.ok) {
      setHata(json.message || 'Saat silinemedi.')
      return
    }
    setSaatler((s) => ({ ...s, [dilimId]: '' }))
    onSaved()
  }

  return (
    <Dialog open={!!guzergahDurak} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{guzergahDurak.durak.kod} — Dilim Saatleri</DialogTitle>
        </DialogHeader>
        {hata && <p className="text-sm text-red-600">{hata}</p>}
        <div className="space-y-3">
          {dilimler.length === 0 && (
            <p className="text-sm text-muted-foreground">Aktif sefer dilimi yok — önce Sefer Dilimleri sekmesinden ekleyin.</p>
          )}
          {dilimler.map((dilim) => {
            const mevcutSaat = guzergahDurak.saatler.find((s) => s.dilimId === dilim.id)
            return (
              <div key={dilim.id} className="flex items-center gap-2">
                <Label className="w-40 shrink-0 text-sm font-normal">
                  {dilim.kod} ({dilim.yon === 'GIDIS' ? 'Gidiş' : 'Dönüş'})
                </Label>
                <Input
                  type="time"
                  disabled={!canManage}
                  value={saatler[dilim.id] || ''}
                  onChange={(e) => setSaatler((s) => ({ ...s, [dilim.id]: e.target.value }))}
                />
                {canManage && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => kaydet(dilim.id)}>Kaydet</Button>
                    {mevcutSaat && (
                      <Button size="sm" variant="ghost" onClick={() => sil(mevcutSaat.id, dilim.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function RolRozet({ rol }: { rol: ServisRol }) {
  return <Badge variant={rol === 'ANA' ? 'default' : 'secondary'}>{rol}</Badge>
}

function tarihGoster(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '-'
}

const bugun = () => new Date().toISOString().slice(0, 10)

function VarsayilanAraclarPanel({
  guzergahId,
  dilimler,
  canManage,
  canPassive,
  canRestore,
}: {
  guzergahId: string
  dilimler: SeferDilimi[]
  canManage: boolean
  canPassive: boolean
  canRestore: boolean
}) {
  const [liste, setListe] = useState<AracVarsayilan[]>([])
  const [araclar, setAraclar] = useState<SecilebilirArac[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)
  const [dialogAcik, setDialogAcik] = useState(false)
  const [form, setForm] = useState({
    dilimId: '', aracId: '', rol: 'ANA' as ServisRol, baslangicTarihi: bugun(), bitisTarihi: '', neden: '',
  })
  const [kapatilan, setKapatilan] = useState<AracVarsayilan | null>(null)
  const [kapatmaTarihi, setKapatmaTarihi] = useState('')

  const yukle = useCallback(async () => {
    setYukleniyor(true)
    setHata(null)
    try {
      const [listeRes, aracRes] = await Promise.all([
        fetch(`/api/servis-yonetimi/guzergah/${guzergahId}/arac-varsayilan`),
        fetch('/api/servis-yonetimi/arac?durum=aktif'),
      ])
      const [listeJson, aracJson] = await Promise.all([listeRes.json(), aracRes.json()])
      if (!listeRes.ok || !listeJson.ok) {
        setHata(listeJson.message || 'Varsayılan araç listesi alınamadı.')
        return
      }
      setListe(listeJson.data)
      setAraclar(aracRes.ok && aracJson.ok ? aracJson.data : [])
    } catch {
      setHata('Veriler alınırken beklenmeyen bir hata oluştu.')
    } finally {
      setYukleniyor(false)
    }
  }, [guzergahId])

  useEffect(() => {
    yukle()
  }, [yukle])

  function yeniAc() {
    setForm({ dilimId: dilimler[0]?.id || '', aracId: araclar[0]?.id || '', rol: 'ANA', baslangicTarihi: bugun(), bitisTarihi: '', neden: '' })
    setHata(null)
    setDialogAcik(true)
  }

  async function kaydet() {
    setHata(null)
    const res = await fetch(`/api/servis-yonetimi/guzergah/${guzergahId}/arac-varsayilan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    if (!res.ok || !json.ok) {
      setHata(json.message || 'Kaydedilemedi.')
      return
    }
    setDialogAcik(false)
    yukle()
  }

  function kapatmaAc(v: AracVarsayilan) {
    setKapatilan(v)
    setKapatmaTarihi(bugun())
    setHata(null)
  }

  async function kapat() {
    if (!kapatilan) return
    setHata(null)
    const res = await fetch(`/api/servis-yonetimi/guzergah-arac-varsayilan/${kapatilan.id}/pasiflestir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bitisTarihi: kapatmaTarihi }),
    })
    const json = await res.json()
    if (!res.ok || !json.ok) {
      setHata(json.message || 'Atama kapatılamadı.')
      return
    }
    setKapatilan(null)
    yukle()
  }

  async function geriAl(id: string) {
    setHata(null)
    const res = await fetch(`/api/servis-yonetimi/guzergah-arac-varsayilan/${id}/geri-al`, { method: 'POST' })
    const json = await res.json()
    if (!res.ok || !json.ok) {
      setHata(json.message || 'Geri alınamadı.')
      return
    }
    yukle()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Varsayılan Araçlar</h2>
        {canManage && (
          <Button size="sm" onClick={yeniAc} disabled={dilimler.length === 0 || araclar.length === 0}>
            <Plus className="mr-2 h-4 w-4" /> Yeni Atama
          </Button>
        )}
      </div>
      {canManage && (dilimler.length === 0 || araclar.length === 0) && (
        <p className="text-sm text-amber-600">Atama yapmak için önce aktif bir sefer dilimi ve aktif bir araç gerekir.</p>
      )}
      {hata && <p className="text-sm text-red-600">{hata}</p>}
      {yukleniyor ? (
        <p className="text-sm text-muted-foreground">Yükleniyor...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dilim</TableHead>
              <TableHead>Araç</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Başlangıç</TableHead>
              <TableHead>Bitiş</TableHead>
              <TableHead>Durum</TableHead>
              {(canPassive || canRestore) && <TableHead className="text-right">İşlem</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {liste.length === 0 && (
              <TableRow>
                <TableCell colSpan={canPassive || canRestore ? 7 : 6} className="text-center text-muted-foreground">
                  Kayıt yok.
                </TableCell>
              </TableRow>
            )}
            {liste.map((v) => (
              <TableRow key={v.id}>
                <TableCell>{v.dilim.kod}</TableCell>
                <TableCell>{v.arac.plaka}{!v.arac.aktif ? ' (Pasif)' : ''}</TableCell>
                <TableCell><RolRozet rol={v.rol} /></TableCell>
                <TableCell>{tarihGoster(v.baslangicTarihi)}</TableCell>
                <TableCell>{tarihGoster(v.bitisTarihi)}</TableCell>
                <TableCell><Badge variant={v.aktif ? 'default' : 'secondary'}>{v.aktif ? 'Aktif' : 'Pasif'}</Badge></TableCell>
                {(canPassive || canRestore) && (
                  <TableCell className="text-right space-x-2">
                    {v.aktif && canPassive && (
                      <Button size="sm" variant="destructive" onClick={() => kapatmaAc(v)}>Kapat</Button>
                    )}
                    {!v.aktif && canRestore && (
                      <Button size="sm" variant="outline" onClick={() => geriAl(v.id)}>Geri Al</Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogAcik} onOpenChange={setDialogAcik}>
        <DialogContent>
          <DialogHeader><DialogTitle>Yeni Varsayılan Araç Ataması</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="av-dilim">Sefer Dilimi *</Label>
              <select id="av-dilim" value={form.dilimId} onChange={(e) => setForm({ ...form, dilimId: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {dilimler.map((d) => <option key={d.id} value={d.id}>{d.kod} ({d.yon === 'GIDIS' ? 'Gidiş' : 'Dönüş'})</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="av-arac">Araç *</Label>
              <select id="av-arac" value={form.aracId} onChange={(e) => setForm({ ...form, aracId: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {araclar.map((a) => <option key={a.id} value={a.id}>{a.plaka}</option>)}
              </select>
            </div>
            <div>
              <Label>Rol *</Label>
              <RadioGroup value={form.rol} onValueChange={(v) => setForm({ ...form, rol: v as ServisRol })} className="flex gap-4 pt-1">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="ANA" id="av-rol-ana" />
                  <Label htmlFor="av-rol-ana" className="font-normal cursor-pointer">ANA</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="YEDEK" id="av-rol-yedek" />
                  <Label htmlFor="av-rol-yedek" className="font-normal cursor-pointer">YEDEK</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="av-baslangic">Başlangıç *</Label>
                <Input id="av-baslangic" type="date" value={form.baslangicTarihi} onChange={(e) => setForm({ ...form, baslangicTarihi: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="av-bitis">Bitiş</Label>
                <Input id="av-bitis" type="date" value={form.bitisTarihi} onChange={(e) => setForm({ ...form, bitisTarihi: e.target.value })} />
              </div>
            </div>
            <div>
              <Label htmlFor="av-neden">Neden</Label>
              <Input id="av-neden" value={form.neden} onChange={(e) => setForm({ ...form, neden: e.target.value })} />
            </div>
          </div>
          <DialogFooter><Button onClick={kaydet}>Kaydet</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!kapatilan} onOpenChange={(o) => !o && setKapatilan(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Atamayı Kapat</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Bu atamayı kapatmak geçmişi silmez — yalnızca bitiş tarihini kaydedip pasife alır. Aynı araç/dilim için hâlâ çakışan başka bir ANA atama varsa geri almak reddedilir.
            </p>
            <div>
              <Label htmlFor="av-kapatma-tarihi">Kapatma (Bitiş) Tarihi *</Label>
              <Input id="av-kapatma-tarihi" type="date" value={kapatmaTarihi} onChange={(e) => setKapatmaTarihi(e.target.value)} />
            </div>
          </div>
          <DialogFooter><Button variant="destructive" onClick={kapat}>Kapat</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function VarsayilanSoforlerPanel({
  guzergahId,
  dilimler,
  canManage,
  canPassive,
  canRestore,
}: {
  guzergahId: string
  dilimler: SeferDilimi[]
  canManage: boolean
  canPassive: boolean
  canRestore: boolean
}) {
  const [liste, setListe] = useState<SoforVarsayilan[]>([])
  const [soforler, setSoforler] = useState<SecilebilirSofor[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)
  const [dialogAcik, setDialogAcik] = useState(false)
  const [form, setForm] = useState({
    dilimId: '', soforId: '', rol: 'ANA' as ServisRol, baslangicTarihi: bugun(), bitisTarihi: '', neden: '',
  })
  const [kapatilan, setKapatilan] = useState<SoforVarsayilan | null>(null)
  const [kapatmaTarihi, setKapatmaTarihi] = useState('')

  const yukle = useCallback(async () => {
    setYukleniyor(true)
    setHata(null)
    try {
      const [listeRes, soforRes] = await Promise.all([
        fetch(`/api/servis-yonetimi/guzergah/${guzergahId}/sofor-varsayilan`),
        fetch('/api/servis-yonetimi/sofor?durum=aktif'),
      ])
      const [listeJson, soforJson] = await Promise.all([listeRes.json(), soforRes.json()])
      if (!listeRes.ok || !listeJson.ok) {
        setHata(listeJson.message || 'Varsayılan şoför listesi alınamadı.')
        return
      }
      setListe(listeJson.data)
      setSoforler(soforRes.ok && soforJson.ok ? soforJson.data : [])
    } catch {
      setHata('Veriler alınırken beklenmeyen bir hata oluştu.')
    } finally {
      setYukleniyor(false)
    }
  }, [guzergahId])

  useEffect(() => {
    yukle()
  }, [yukle])

  function yeniAc() {
    setForm({ dilimId: dilimler[0]?.id || '', soforId: soforler[0]?.id || '', rol: 'ANA', baslangicTarihi: bugun(), bitisTarihi: '', neden: '' })
    setHata(null)
    setDialogAcik(true)
  }

  async function kaydet() {
    setHata(null)
    const res = await fetch(`/api/servis-yonetimi/guzergah/${guzergahId}/sofor-varsayilan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    if (!res.ok || !json.ok) {
      setHata(json.message || 'Kaydedilemedi.')
      return
    }
    setDialogAcik(false)
    yukle()
  }

  function kapatmaAc(v: SoforVarsayilan) {
    setKapatilan(v)
    setKapatmaTarihi(bugun())
    setHata(null)
  }

  async function kapat() {
    if (!kapatilan) return
    setHata(null)
    const res = await fetch(`/api/servis-yonetimi/guzergah-sofor-varsayilan/${kapatilan.id}/pasiflestir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bitisTarihi: kapatmaTarihi }),
    })
    const json = await res.json()
    if (!res.ok || !json.ok) {
      setHata(json.message || 'Atama kapatılamadı.')
      return
    }
    setKapatilan(null)
    yukle()
  }

  async function geriAl(id: string) {
    setHata(null)
    const res = await fetch(`/api/servis-yonetimi/guzergah-sofor-varsayilan/${id}/geri-al`, { method: 'POST' })
    const json = await res.json()
    if (!res.ok || !json.ok) {
      setHata(json.message || 'Geri alınamadı.')
      return
    }
    yukle()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Varsayılan Şoförler</h2>
        {canManage && (
          <Button size="sm" onClick={yeniAc} disabled={dilimler.length === 0 || soforler.length === 0}>
            <Plus className="mr-2 h-4 w-4" /> Yeni Atama
          </Button>
        )}
      </div>
      {canManage && (dilimler.length === 0 || soforler.length === 0) && (
        <p className="text-sm text-amber-600">Atama yapmak için önce aktif bir sefer dilimi ve aktif bir şoför gerekir.</p>
      )}
      {hata && <p className="text-sm text-red-600">{hata}</p>}
      {yukleniyor ? (
        <p className="text-sm text-muted-foreground">Yükleniyor...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dilim</TableHead>
              <TableHead>Şoför</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Başlangıç</TableHead>
              <TableHead>Bitiş</TableHead>
              <TableHead>Durum</TableHead>
              {(canPassive || canRestore) && <TableHead className="text-right">İşlem</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {liste.length === 0 && (
              <TableRow>
                <TableCell colSpan={canPassive || canRestore ? 7 : 6} className="text-center text-muted-foreground">
                  Kayıt yok.
                </TableCell>
              </TableRow>
            )}
            {liste.map((v) => (
              <TableRow key={v.id}>
                <TableCell>{v.dilim.kod}</TableCell>
                <TableCell>{v.sofor.adSoyad}{!v.sofor.aktif ? ' (Pasif)' : ''}</TableCell>
                <TableCell><RolRozet rol={v.rol} /></TableCell>
                <TableCell>{tarihGoster(v.baslangicTarihi)}</TableCell>
                <TableCell>{tarihGoster(v.bitisTarihi)}</TableCell>
                <TableCell><Badge variant={v.aktif ? 'default' : 'secondary'}>{v.aktif ? 'Aktif' : 'Pasif'}</Badge></TableCell>
                {(canPassive || canRestore) && (
                  <TableCell className="text-right space-x-2">
                    {v.aktif && canPassive && (
                      <Button size="sm" variant="destructive" onClick={() => kapatmaAc(v)}>Kapat</Button>
                    )}
                    {!v.aktif && canRestore && (
                      <Button size="sm" variant="outline" onClick={() => geriAl(v.id)}>Geri Al</Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogAcik} onOpenChange={setDialogAcik}>
        <DialogContent>
          <DialogHeader><DialogTitle>Yeni Varsayılan Şoför Ataması</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="sv-dilim">Sefer Dilimi *</Label>
              <select id="sv-dilim" value={form.dilimId} onChange={(e) => setForm({ ...form, dilimId: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {dilimler.map((d) => <option key={d.id} value={d.id}>{d.kod} ({d.yon === 'GIDIS' ? 'Gidiş' : 'Dönüş'})</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="sv-sofor">Şoför *</Label>
              <select id="sv-sofor" value={form.soforId} onChange={(e) => setForm({ ...form, soforId: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {soforler.map((s) => <option key={s.id} value={s.id}>{s.adSoyad}</option>)}
              </select>
            </div>
            <div>
              <Label>Rol *</Label>
              <RadioGroup value={form.rol} onValueChange={(v) => setForm({ ...form, rol: v as ServisRol })} className="flex gap-4 pt-1">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="ANA" id="sv-rol-ana" />
                  <Label htmlFor="sv-rol-ana" className="font-normal cursor-pointer">ANA</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="YEDEK" id="sv-rol-yedek" />
                  <Label htmlFor="sv-rol-yedek" className="font-normal cursor-pointer">YEDEK</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="sv-baslangic">Başlangıç *</Label>
                <Input id="sv-baslangic" type="date" value={form.baslangicTarihi} onChange={(e) => setForm({ ...form, baslangicTarihi: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="sv-bitis">Bitiş</Label>
                <Input id="sv-bitis" type="date" value={form.bitisTarihi} onChange={(e) => setForm({ ...form, bitisTarihi: e.target.value })} />
              </div>
            </div>
            <div>
              <Label htmlFor="sv-neden">Neden</Label>
              <Input id="sv-neden" value={form.neden} onChange={(e) => setForm({ ...form, neden: e.target.value })} />
            </div>
          </div>
          <DialogFooter><Button onClick={kaydet}>Kaydet</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!kapatilan} onOpenChange={(o) => !o && setKapatilan(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Atamayı Kapat</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Bu atamayı kapatmak geçmişi silmez — yalnızca bitiş tarihini kaydedip pasife alır. Aynı şoför/dilim için hâlâ çakışan başka bir ANA atama varsa geri almak reddedilir.
            </p>
            <div>
              <Label htmlFor="sv-kapatma-tarihi">Kapatma (Bitiş) Tarihi *</Label>
              <Input id="sv-kapatma-tarihi" type="date" value={kapatmaTarihi} onChange={(e) => setKapatmaTarihi(e.target.value)} />
            </div>
          </div>
          <DialogFooter><Button variant="destructive" onClick={kapat}>Kapat</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Servis sorumlusu personel seçimi — servis-yonetimi/page.tsx'teki
// SoforPersonelPicker ile aynı desen (arama-üzerine-seç, elle serbest metin
// yok), aynı dar kapsamlı /api/servis-yonetimi/personel-ara uç noktası.
function SorumluPersonelPicker({
  value,
  onSelect,
}: {
  value: SorumluPickedPersonel | null
  onSelect: (personel: SorumluPickedPersonel) => void
}) {
  const [query, setQuery] = useState('')
  const [sonuclar, setSonuclar] = useState<SorumluPickedPersonel[]>([])
  const [acik, setAcik] = useState(false)
  const [yukleniyor, setYukleniyor] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function tikla(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAcik(false)
    }
    document.addEventListener('mousedown', tikla)
    return () => document.removeEventListener('mousedown', tikla)
  }, [])

  useEffect(() => {
    if (query.trim().length < 2) {
      setSonuclar([])
      return
    }
    const zamanlayici = setTimeout(async () => {
      setYukleniyor(true)
      try {
        const res = await fetch(`/api/servis-yonetimi/personel-ara?search=${encodeURIComponent(query)}`)
        const json = await res.json()
        setSonuclar(res.ok && json.ok ? json.data : [])
      } finally {
        setYukleniyor(false)
      }
    }, 300)
    return () => clearTimeout(zamanlayici)
  }, [query])

  return (
    <div ref={ref} className="relative">
      <Input
        value={value ? `${value.sicilNo ? value.sicilNo + ' - ' : ''}${value.adSoyad}` : query}
        placeholder="Sicil No veya Ad Soyad ile ara..."
        onChange={(e) => { setQuery(e.target.value); setAcik(true) }}
        onFocus={() => { setQuery(''); setAcik(true) }}
      />
      {acik && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-56 overflow-y-auto">
          {yukleniyor && <div className="px-3 py-2 text-sm text-muted-foreground">Aranıyor...</div>}
          {!yukleniyor && query.trim().length >= 2 && sonuclar.length === 0 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">Sonuç bulunamadı</div>
          )}
          {!yukleniyor && query.trim().length < 2 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">En az 2 karakter yazın</div>
          )}
          {sonuclar.map((p) => (
            <button
              key={p.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
              onMouseDown={(e) => { e.preventDefault(); onSelect(p); setQuery(''); setAcik(false) }}
            >
              <span className="font-medium">{p.sicilNo || '-'}</span> — {p.adSoyad}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SorumlularPanel({
  guzergahId,
  canSorumluManage,
  canPassive,
  canRestore,
}: {
  guzergahId: string
  canSorumluManage: boolean
  canPassive: boolean
  canRestore: boolean
}) {
  const [liste, setListe] = useState<Sorumlu[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)
  const [dialogAcik, setDialogAcik] = useState(false)
  const [secilenPersonel, setSecilenPersonel] = useState<SorumluPickedPersonel | null>(null)
  const [form, setForm] = useState({ personnelId: '', rol: 'ANA' as ServisRol, baslangicTarihi: bugun(), bitisTarihi: '', neden: '' })
  const [kapatilan, setKapatilan] = useState<Sorumlu | null>(null)
  const [kapatmaTarihi, setKapatmaTarihi] = useState('')

  const yukle = useCallback(async () => {
    setYukleniyor(true)
    setHata(null)
    try {
      const res = await fetch(`/api/servis-yonetimi/guzergah/${guzergahId}/sorumlu`)
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setHata(json.message || 'Servis sorumluları alınamadı.')
        return
      }
      setListe(json.data)
    } catch {
      setHata('Veriler alınırken beklenmeyen bir hata oluştu.')
    } finally {
      setYukleniyor(false)
    }
  }, [guzergahId])

  useEffect(() => {
    yukle()
  }, [yukle])

  function yeniAc() {
    setSecilenPersonel(null)
    setForm({ personnelId: '', rol: 'ANA', baslangicTarihi: bugun(), bitisTarihi: '', neden: '' })
    setHata(null)
    setDialogAcik(true)
  }

  async function kaydet() {
    setHata(null)
    const res = await fetch(`/api/servis-yonetimi/guzergah/${guzergahId}/sorumlu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    if (!res.ok || !json.ok) {
      setHata(json.message || 'Kaydedilemedi.')
      return
    }
    setDialogAcik(false)
    yukle()
  }

  function kapatmaAc(v: Sorumlu) {
    setKapatilan(v)
    setKapatmaTarihi(bugun())
    setHata(null)
  }

  async function kapat() {
    if (!kapatilan) return
    setHata(null)
    const res = await fetch(`/api/servis-yonetimi/guzergah-sorumlu/${kapatilan.id}/pasiflestir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bitisTarihi: kapatmaTarihi }),
    })
    const json = await res.json()
    if (!res.ok || !json.ok) {
      setHata(json.message || 'Atama kapatılamadı.')
      return
    }
    setKapatilan(null)
    yukle()
  }

  async function geriAl(id: string) {
    setHata(null)
    const res = await fetch(`/api/servis-yonetimi/guzergah-sorumlu/${id}/geri-al`, { method: 'POST' })
    const json = await res.json()
    if (!res.ok || !json.ok) {
      setHata(json.message || 'Geri alınamadı.')
      return
    }
    yukle()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Servis Sorumluları</h2>
        {canSorumluManage && (
          <Button size="sm" onClick={yeniAc}>
            <Plus className="mr-2 h-4 w-4" /> Yeni Atama
          </Button>
        )}
      </div>
      {hata && <p className="text-sm text-red-600">{hata}</p>}
      {yukleniyor ? (
        <p className="text-sm text-muted-foreground">Yükleniyor...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Personel</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Başlangıç</TableHead>
              <TableHead>Bitiş</TableHead>
              <TableHead>Durum</TableHead>
              {(canPassive || canRestore) && <TableHead className="text-right">İşlem</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {liste.length === 0 && (
              <TableRow>
                <TableCell colSpan={canPassive || canRestore ? 6 : 5} className="text-center text-muted-foreground">
                  Kayıt yok.
                </TableCell>
              </TableRow>
            )}
            {liste.map((v) => (
              <TableRow key={v.id}>
                <TableCell>{v.personnel.adSoyad}{!v.personnel.aktif ? ' (Pasif)' : ''}</TableCell>
                <TableCell><RolRozet rol={v.rol} /></TableCell>
                <TableCell>{tarihGoster(v.baslangicTarihi)}</TableCell>
                <TableCell>{tarihGoster(v.bitisTarihi)}</TableCell>
                <TableCell><Badge variant={v.aktif ? 'default' : 'secondary'}>{v.aktif ? 'Aktif' : 'Pasif'}</Badge></TableCell>
                {(canPassive || canRestore) && (
                  <TableCell className="text-right space-x-2">
                    {v.aktif && canPassive && (
                      <Button size="sm" variant="destructive" onClick={() => kapatmaAc(v)}>Kapat</Button>
                    )}
                    {!v.aktif && canRestore && (
                      <Button size="sm" variant="outline" onClick={() => geriAl(v.id)}>Geri Al</Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogAcik} onOpenChange={setDialogAcik}>
        <DialogContent>
          <DialogHeader><DialogTitle>Yeni Servis Sorumlusu Ataması</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="sr-personel">Personel *</Label>
              <SorumluPersonelPicker
                value={secilenPersonel}
                onSelect={(p) => { setSecilenPersonel(p); setForm({ ...form, personnelId: p.id }) }}
              />
            </div>
            <div>
              <Label>Rol *</Label>
              <RadioGroup value={form.rol} onValueChange={(v) => setForm({ ...form, rol: v as ServisRol })} className="flex gap-4 pt-1">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="ANA" id="sr-rol-ana" />
                  <Label htmlFor="sr-rol-ana" className="font-normal cursor-pointer">ANA</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="YEDEK" id="sr-rol-yedek" />
                  <Label htmlFor="sr-rol-yedek" className="font-normal cursor-pointer">YEDEK</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="sr-baslangic">Başlangıç *</Label>
                <Input id="sr-baslangic" type="date" value={form.baslangicTarihi} onChange={(e) => setForm({ ...form, baslangicTarihi: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="sr-bitis">Bitiş</Label>
                <Input id="sr-bitis" type="date" value={form.bitisTarihi} onChange={(e) => setForm({ ...form, bitisTarihi: e.target.value })} />
              </div>
            </div>
            <div>
              <Label htmlFor="sr-neden">Neden</Label>
              <Input id="sr-neden" value={form.neden} onChange={(e) => setForm({ ...form, neden: e.target.value })} />
            </div>
          </div>
          <DialogFooter><Button onClick={kaydet} disabled={!form.personnelId}>Kaydet</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!kapatilan} onOpenChange={(o) => !o && setKapatilan(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Atamayı Kapat</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Bu atamayı kapatmak geçmişi silmez — yalnızca bitiş tarihini kaydedip pasife alır.
            </p>
            <div>
              <Label htmlFor="sr-kapatma-tarihi">Kapatma (Bitiş) Tarihi *</Label>
              <Input id="sr-kapatma-tarihi" type="date" value={kapatmaTarihi} onChange={(e) => setKapatmaTarihi(e.target.value)} />
            </div>
          </div>
          <DialogFooter><Button variant="destructive" onClick={kapat}>Kapat</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Personel Atamaları — bir personelin bu güzergaha (opsiyonel: belirli bir
// durağa), N sefer diliminde geçerli ataması. Dilim seçimi İMMUTABLE: bir
// atama oluştuktan sonra dilimler değiştirilemez (yalnız kapat + yeni atama
// aç). Durak seçimi, güzergahın MEVCUT (aktif) duraklarıyla sınırlı — bu,
// backend'deki (guzergahId, durakId) bileşik FK ön-kontrolüyle birebir
// örtüşüyor, çiğ FK hatası yerine burada zaten geçerli seçenekler sunuluyor.
function PersonelAtamalarPanel({
  guzergahId,
  aktifDuraklar,
  dilimler,
  canManage,
  canPassive,
  canRestore,
}: {
  guzergahId: string
  aktifDuraklar: GuzergahDurak[]
  dilimler: SeferDilimi[]
  canManage: boolean
  canPassive: boolean
  canRestore: boolean
}) {
  const [liste, setListe] = useState<PersonelAtama[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)
  const [dialogAcik, setDialogAcik] = useState(false)
  const [secilenPersonel, setSecilenPersonel] = useState<SorumluPickedPersonel | null>(null)
  const [form, setForm] = useState({
    personnelId: '', durakId: '', baslangicTarihi: bugun(), bitisTarihi: '', dilimIdleri: [] as string[],
  })
  const [kapatilan, setKapatilan] = useState<PersonelAtama | null>(null)
  const [kapatmaTarihi, setKapatmaTarihi] = useState('')

  const yukle = useCallback(async () => {
    setYukleniyor(true)
    setHata(null)
    try {
      const res = await fetch(`/api/servis-yonetimi/guzergah/${guzergahId}/personel-atama`)
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setHata(json.message || 'Personel atamaları alınamadı.')
        return
      }
      setListe(json.data)
    } catch {
      setHata('Veriler alınırken beklenmeyen bir hata oluştu.')
    } finally {
      setYukleniyor(false)
    }
  }, [guzergahId])

  useEffect(() => {
    yukle()
  }, [yukle])

  function yeniAc() {
    setSecilenPersonel(null)
    setForm({ personnelId: '', durakId: '', baslangicTarihi: bugun(), bitisTarihi: '', dilimIdleri: [] })
    setHata(null)
    setDialogAcik(true)
  }

  function dilimSecimDegistir(dilimId: string, secili: boolean) {
    setForm((f) => ({
      ...f,
      dilimIdleri: secili ? [...f.dilimIdleri, dilimId] : f.dilimIdleri.filter((id) => id !== dilimId),
    }))
  }

  async function kaydet() {
    setHata(null)
    const res = await fetch(`/api/servis-yonetimi/guzergah/${guzergahId}/personel-atama`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    if (!res.ok || !json.ok) {
      setHata(json.message || 'Kaydedilemedi.')
      return
    }
    setDialogAcik(false)
    yukle()
  }

  function kapatmaAc(v: PersonelAtama) {
    setKapatilan(v)
    setKapatmaTarihi(bugun())
    setHata(null)
  }

  async function kapat() {
    if (!kapatilan) return
    setHata(null)
    const res = await fetch(`/api/servis-yonetimi/guzergah-personel-atama/${kapatilan.id}/pasiflestir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bitisTarihi: kapatmaTarihi }),
    })
    const json = await res.json()
    if (!res.ok || !json.ok) {
      setHata(json.message || 'Atama kapatılamadı.')
      return
    }
    setKapatilan(null)
    yukle()
  }

  async function geriAl(id: string) {
    setHata(null)
    const res = await fetch(`/api/servis-yonetimi/guzergah-personel-atama/${id}/geri-al`, { method: 'POST' })
    const json = await res.json()
    if (!res.ok || !json.ok) {
      setHata(json.message || 'Geri alınamadı.')
      return
    }
    yukle()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Personel Atamaları</h2>
        {canManage && (
          <Button size="sm" onClick={yeniAc} disabled={dilimler.length === 0}>
            <Plus className="mr-2 h-4 w-4" /> Yeni Atama
          </Button>
        )}
      </div>
      {canManage && dilimler.length === 0 && (
        <p className="text-sm text-amber-600">Atama yapmak için önce en az bir aktif sefer dilimi gerekir.</p>
      )}
      {hata && <p className="text-sm text-red-600">{hata}</p>}
      {yukleniyor ? (
        <p className="text-sm text-muted-foreground">Yükleniyor...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Personel</TableHead>
              <TableHead>Durak</TableHead>
              <TableHead>Sefer Dilimleri</TableHead>
              <TableHead>Başlangıç</TableHead>
              <TableHead>Bitiş</TableHead>
              <TableHead>Durum</TableHead>
              {(canPassive || canRestore) && <TableHead className="text-right">İşlem</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {liste.length === 0 && (
              <TableRow>
                <TableCell colSpan={canPassive || canRestore ? 7 : 6} className="text-center text-muted-foreground">
                  Kayıt yok.
                </TableCell>
              </TableRow>
            )}
            {liste.map((v) => (
              <TableRow key={v.id}>
                <TableCell>{v.personnel.adSoyad}{!v.personnel.aktif ? ' (Pasif)' : ''}</TableCell>
                <TableCell>{v.durak ? `${v.durak.kod} — ${v.durak.ad}` : '-'}</TableCell>
                <TableCell>{v.dilimler.map((d) => d.dilim.kod).join(', ')}</TableCell>
                <TableCell>{tarihGoster(v.baslangicTarihi)}</TableCell>
                <TableCell>{tarihGoster(v.bitisTarihi)}</TableCell>
                <TableCell><Badge variant={v.aktif ? 'default' : 'secondary'}>{v.aktif ? 'Aktif' : 'Pasif'}</Badge></TableCell>
                {(canPassive || canRestore) && (
                  <TableCell className="text-right space-x-2">
                    {v.aktif && canPassive && (
                      <Button size="sm" variant="destructive" onClick={() => kapatmaAc(v)}>Kapat</Button>
                    )}
                    {!v.aktif && canRestore && (
                      <Button size="sm" variant="outline" onClick={() => geriAl(v.id)}>Geri Al</Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogAcik} onOpenChange={setDialogAcik}>
        <DialogContent>
          <DialogHeader><DialogTitle>Yeni Personel Ataması</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="pa-personel">Personel *</Label>
              <SorumluPersonelPicker
                value={secilenPersonel}
                onSelect={(p) => { setSecilenPersonel(p); setForm({ ...form, personnelId: p.id }) }}
              />
            </div>
            <div>
              <Label htmlFor="pa-durak">Durak (opsiyonel)</Label>
              <select
                id="pa-durak"
                value={form.durakId}
                onChange={(e) => setForm({ ...form, durakId: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Belirli durak seçilmedi</option>
                {aktifDuraklar.map((d) => (
                  <option key={d.durakId} value={d.durakId}>{d.durak.kod} — {d.durak.ad}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Sefer Dilimleri * (en az bir tane, sonradan değiştirilemez)</Label>
              <div className="space-y-1 pt-1">
                {dilimler.map((d) => (
                  <label key={d.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.dilimIdleri.includes(d.id)}
                      onChange={(e) => dilimSecimDegistir(d.id, e.target.checked)}
                    />
                    {d.kod} ({d.yon === 'GIDIS' ? 'Gidiş' : 'Dönüş'})
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pa-baslangic">Başlangıç *</Label>
                <Input id="pa-baslangic" type="date" value={form.baslangicTarihi} onChange={(e) => setForm({ ...form, baslangicTarihi: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="pa-bitis">Bitiş</Label>
                <Input id="pa-bitis" type="date" value={form.bitisTarihi} onChange={(e) => setForm({ ...form, bitisTarihi: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={kaydet} disabled={!form.personnelId || form.dilimIdleri.length === 0 || !form.baslangicTarihi}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!kapatilan} onOpenChange={(o) => !o && setKapatilan(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Atamayı Kapat</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Bu atamayı kapatmak geçmişi silmez — yalnızca bitiş tarihini kaydedip pasife alır.
            </p>
            <div>
              <Label htmlFor="pa-kapatma-tarihi">Kapatma (Bitiş) Tarihi *</Label>
              <Input id="pa-kapatma-tarihi" type="date" value={kapatmaTarihi} onChange={(e) => setKapatmaTarihi(e.target.value)} />
            </div>
          </div>
          <DialogFooter><Button variant="destructive" onClick={kapat}>Kapat</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
