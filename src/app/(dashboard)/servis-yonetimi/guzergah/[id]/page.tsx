'use client'

import { useCallback, useEffect, useState } from 'react'
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
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
          Güzergâhın durak sırası ve dilim bazlı saatleri.
        </p>
      </div>

      {hata && <p className="text-sm text-red-600">{hata}</p>}

      {yukleniyor ? (
        <p className="text-sm text-muted-foreground">Yükleniyor...</p>
      ) : (
        <>
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
        </>
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
