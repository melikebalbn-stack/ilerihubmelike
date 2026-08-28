'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Plus } from 'lucide-react'

type ServisFirma = {
  id: string
  ad: string
  yetkiliAdi: string | null
  telefon: string | null
  eposta: string | null
  adres: string | null
  aktif: boolean
}

type ServisYerleske = {
  id: string
  kod: string
  ad: string
  adres: string | null
  enlem: string | null
  boylam: string | null
  aktif: boolean
}

function AktifBadge({ aktif }: { aktif: boolean }) {
  return (
    <Badge variant={aktif ? 'default' : 'secondary'}>
      {aktif ? 'Aktif' : 'Pasif'}
    </Badge>
  )
}

function ServisFirmaPanel({ canManage }: { canManage: boolean }) {
  const [firmalar, setFirmalar] = useState<ServisFirma[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)
  const [dialogAcik, setDialogAcik] = useState(false)
  const [duzenlenen, setDuzenlenen] = useState<ServisFirma | null>(null)
  const [form, setForm] = useState({ ad: '', yetkiliAdi: '', telefon: '', eposta: '', adres: '' })

  const yukle = useCallback(async () => {
    setYukleniyor(true)
    setHata(null)
    try {
      const res = await fetch('/api/servis-yonetimi/firma')
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setHata(json.message || 'Firma listesi alınamadı.')
        return
      }
      setFirmalar(json.data)
    } catch {
      setHata('Firma listesi alınırken beklenmeyen bir hata oluştu.')
    } finally {
      setYukleniyor(false)
    }
  }, [])

  useEffect(() => {
    yukle()
  }, [yukle])

  function yeniAc() {
    setDuzenlenen(null)
    setForm({ ad: '', yetkiliAdi: '', telefon: '', eposta: '', adres: '' })
    setDialogAcik(true)
  }

  function duzenleAc(firma: ServisFirma) {
    setDuzenlenen(firma)
    setForm({
      ad: firma.ad,
      yetkiliAdi: firma.yetkiliAdi ?? '',
      telefon: firma.telefon ?? '',
      eposta: firma.eposta ?? '',
      adres: firma.adres ?? '',
    })
    setDialogAcik(true)
  }

  async function kaydet() {
    setHata(null)
    const url = duzenlenen ? `/api/servis-yonetimi/firma/${duzenlenen.id}` : '/api/servis-yonetimi/firma'
    const method = duzenlenen ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
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

  async function pasiflestir(id: string) {
    await fetch(`/api/servis-yonetimi/firma/${id}/pasiflestir`, { method: 'POST' })
    yukle()
  }

  async function geriAl(id: string) {
    await fetch(`/api/servis-yonetimi/firma/${id}/geri-al`, { method: 'POST' })
    yukle()
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={yeniAc}>
            <Plus className="mr-2 h-4 w-4" /> Yeni Firma
          </Button>
        </div>
      )}
      {hata && <p className="text-sm text-red-600">{hata}</p>}
      {yukleniyor ? (
        <p className="text-sm text-muted-foreground">Yükleniyor...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ad</TableHead>
              <TableHead>Yetkili</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>Durum</TableHead>
              {canManage && <TableHead className="text-right">İşlem</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {firmalar.length === 0 && (
              <TableRow>
                <TableCell colSpan={canManage ? 5 : 4} className="text-center text-muted-foreground">
                  Kayıt yok.
                </TableCell>
              </TableRow>
            )}
            {firmalar.map((firma) => (
              <TableRow key={firma.id}>
                <TableCell>{firma.ad}</TableCell>
                <TableCell>{firma.yetkiliAdi || '-'}</TableCell>
                <TableCell>{firma.telefon || '-'}</TableCell>
                <TableCell><AktifBadge aktif={firma.aktif} /></TableCell>
                {canManage && (
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="outline" onClick={() => duzenleAc(firma)}>
                      Düzenle
                    </Button>
                    {firma.aktif ? (
                      <Button size="sm" variant="destructive" onClick={() => pasiflestir(firma.id)}>
                        Pasifleştir
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => geriAl(firma.id)}>
                        Geri Al
                      </Button>
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
          <DialogHeader>
            <DialogTitle>{duzenlenen ? 'Firmayı Düzenle' : 'Yeni Firma'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="firma-ad">Ad *</Label>
              <Input id="firma-ad" value={form.ad} onChange={(e) => setForm({ ...form, ad: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="firma-yetkili">Yetkili Adı</Label>
              <Input id="firma-yetkili" value={form.yetkiliAdi} onChange={(e) => setForm({ ...form, yetkiliAdi: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="firma-telefon">Telefon</Label>
              <Input id="firma-telefon" value={form.telefon} onChange={(e) => setForm({ ...form, telefon: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="firma-eposta">E-posta</Label>
              <Input id="firma-eposta" value={form.eposta} onChange={(e) => setForm({ ...form, eposta: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="firma-adres">Adres</Label>
              <Textarea id="firma-adres" value={form.adres} onChange={(e) => setForm({ ...form, adres: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={kaydet}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ServisYerleskePanel({ canManage }: { canManage: boolean }) {
  const [yerleskeler, setYerleskeler] = useState<ServisYerleske[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)
  const [dialogAcik, setDialogAcik] = useState(false)
  const [duzenlenen, setDuzenlenen] = useState<ServisYerleske | null>(null)
  const [form, setForm] = useState({ kod: '', ad: '', adres: '', enlem: '', boylam: '' })

  const yukle = useCallback(async () => {
    setYukleniyor(true)
    setHata(null)
    try {
      const res = await fetch('/api/servis-yonetimi/yerleske')
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setHata(json.message || 'Yerleşke listesi alınamadı.')
        return
      }
      setYerleskeler(json.data)
    } catch {
      setHata('Yerleşke listesi alınırken beklenmeyen bir hata oluştu.')
    } finally {
      setYukleniyor(false)
    }
  }, [])

  useEffect(() => {
    yukle()
  }, [yukle])

  function yeniAc() {
    setDuzenlenen(null)
    setForm({ kod: '', ad: '', adres: '', enlem: '', boylam: '' })
    setDialogAcik(true)
  }

  function duzenleAc(yerleske: ServisYerleske) {
    setDuzenlenen(yerleske)
    setForm({
      kod: yerleske.kod,
      ad: yerleske.ad,
      adres: yerleske.adres ?? '',
      enlem: yerleske.enlem ?? '',
      boylam: yerleske.boylam ?? '',
    })
    setDialogAcik(true)
  }

  async function kaydet() {
    setHata(null)
    const url = duzenlenen ? `/api/servis-yonetimi/yerleske/${duzenlenen.id}` : '/api/servis-yonetimi/yerleske'
    const method = duzenlenen ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kod: form.kod,
        ad: form.ad,
        adres: form.adres,
        enlem: form.enlem ? Number(form.enlem) : null,
        boylam: form.boylam ? Number(form.boylam) : null,
      }),
    })
    const json = await res.json()
    if (!res.ok || !json.ok) {
      setHata(json.message || 'Kaydedilemedi.')
      return
    }
    setDialogAcik(false)
    yukle()
  }

  async function pasiflestir(id: string) {
    await fetch(`/api/servis-yonetimi/yerleske/${id}/pasiflestir`, { method: 'POST' })
    yukle()
  }

  async function geriAl(id: string) {
    await fetch(`/api/servis-yonetimi/yerleske/${id}/geri-al`, { method: 'POST' })
    yukle()
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={yeniAc}>
            <Plus className="mr-2 h-4 w-4" /> Yeni Yerleşke
          </Button>
        </div>
      )}
      {hata && <p className="text-sm text-red-600">{hata}</p>}
      {yukleniyor ? (
        <p className="text-sm text-muted-foreground">Yükleniyor...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kod</TableHead>
              <TableHead>Ad</TableHead>
              <TableHead>Adres</TableHead>
              <TableHead>Durum</TableHead>
              {canManage && <TableHead className="text-right">İşlem</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {yerleskeler.length === 0 && (
              <TableRow>
                <TableCell colSpan={canManage ? 5 : 4} className="text-center text-muted-foreground">
                  Kayıt yok.
                </TableCell>
              </TableRow>
            )}
            {yerleskeler.map((yerleske) => (
              <TableRow key={yerleske.id}>
                <TableCell className="font-mono">{yerleske.kod}</TableCell>
                <TableCell>{yerleske.ad}</TableCell>
                <TableCell>{yerleske.adres || '-'}</TableCell>
                <TableCell><AktifBadge aktif={yerleske.aktif} /></TableCell>
                {canManage && (
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="outline" onClick={() => duzenleAc(yerleske)}>
                      Düzenle
                    </Button>
                    {yerleske.aktif ? (
                      <Button size="sm" variant="destructive" onClick={() => pasiflestir(yerleske.id)}>
                        Pasifleştir
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => geriAl(yerleske.id)}>
                        Geri Al
                      </Button>
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
          <DialogHeader>
            <DialogTitle>{duzenlenen ? 'Yerleşkeyi Düzenle' : 'Yeni Yerleşke'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="yerleske-kod">Kod *</Label>
              <Input id="yerleske-kod" value={form.kod} onChange={(e) => setForm({ ...form, kod: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="yerleske-ad">Ad *</Label>
              <Input id="yerleske-ad" value={form.ad} onChange={(e) => setForm({ ...form, ad: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="yerleske-adres">Adres</Label>
              <Textarea id="yerleske-adres" value={form.adres} onChange={(e) => setForm({ ...form, adres: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="yerleske-enlem">Enlem</Label>
                <Input id="yerleske-enlem" value={form.enlem} onChange={(e) => setForm({ ...form, enlem: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="yerleske-boylam">Boylam</Label>
                <Input id="yerleske-boylam" value={form.boylam} onChange={(e) => setForm({ ...form, boylam: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={kaydet}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function ServisYonetimiPage() {
  const { data: session } = useSession()
  const permissions = session?.user?.permissions || []
  const canView = permissions.includes('servis.view')
  const canManage = permissions.includes('servis.tanim.manage')

  if (!canView) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Bu sayfayı görüntüleme yetkiniz yok.</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Servis Yönetimi</h1>
        <p className="text-sm text-muted-foreground">
          FAZ 1/A — tanım verisi (firma, yerleşke). Lokal gösterim amaçlı.
        </p>
      </div>
      <Tabs defaultValue="firma">
        <TabsList>
          <TabsTrigger value="firma">Firmalar</TabsTrigger>
          <TabsTrigger value="yerleske">Yerleşkeler</TabsTrigger>
        </TabsList>
        <TabsContent value="firma">
          <ServisFirmaPanel canManage={canManage} />
        </TabsContent>
        <TabsContent value="yerleske">
          <ServisYerleskePanel canManage={canManage} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
