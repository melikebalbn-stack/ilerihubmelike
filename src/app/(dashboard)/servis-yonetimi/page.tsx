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

type ServisGuzergah = {
  id: string
  kod: string
  ad: string
  aciklama: string | null
  bolge: string | null
  yerleskeId: string
  yerleske: { id: string; kod: string; ad: string }
  aktif: boolean
  gecerlilikBaslangici: string | null
  gecerlilikBitisi: string | null
  createdAt: string
  updatedAt: string
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

const bosGuzergahForm = {
  kod: '',
  ad: '',
  aciklama: '',
  bolge: '',
  yerleskeId: '',
  gecerlilikBaslangici: '',
  gecerlilikBitisi: '',
}

function tarihInputDegeri(value: string | null): string {
  return value ? value.slice(0, 10) : ''
}

function ServisGuzergahPanel({ canManage }: { canManage: boolean }) {
  const [guzergahlar, setGuzergahlar] = useState<ServisGuzergah[]>([])
  const [yerleskeler, setYerleskeler] = useState<ServisYerleske[]>([])
  const [arama, setArama] = useState('')
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)
  const [dialogAcik, setDialogAcik] = useState(false)
  const [duzenlenen, setDuzenlenen] = useState<ServisGuzergah | null>(null)
  const [form, setForm] = useState(bosGuzergahForm)

  const yukle = useCallback(async () => {
    setYukleniyor(true)
    setHata(null)
    try {
      const [guzergahRes, yerleskeRes] = await Promise.all([
        fetch('/api/servis-yonetimi/guzergah'),
        fetch('/api/servis-yonetimi/yerleske?durum=aktif'),
      ])
      const [guzergahJson, yerleskeJson] = await Promise.all([guzergahRes.json(), yerleskeRes.json()])
      if (!guzergahRes.ok || !guzergahJson.ok) {
        setHata(guzergahJson.message || 'Güzergâh listesi alınamadı.')
        return
      }
      if (!yerleskeRes.ok || !yerleskeJson.ok) {
        setHata(yerleskeJson.message || 'Yerleşke listesi alınamadı.')
        return
      }
      setGuzergahlar(guzergahJson.data)
      setYerleskeler(yerleskeJson.data)
    } catch {
      setHata('Güzergâh listesi alınırken beklenmeyen bir hata oluştu.')
    } finally {
      setYukleniyor(false)
    }
  }, [])

  useEffect(() => {
    yukle()
  }, [yukle])

  const normalize = (value: string) => value.toLocaleLowerCase('tr-TR')
  const filtreliGuzergahlar = guzergahlar.filter((guzergah) => {
    const query = normalize(arama.trim())
    return !query || normalize(guzergah.kod).includes(query) || normalize(guzergah.ad).includes(query)
  })

  function yeniAc() {
    setDuzenlenen(null)
    setForm({ ...bosGuzergahForm, yerleskeId: yerleskeler[0]?.id || '' })
    setDialogAcik(true)
  }

  function duzenleAc(guzergah: ServisGuzergah) {
    setDuzenlenen(guzergah)
    setForm({
      kod: guzergah.kod,
      ad: guzergah.ad,
      aciklama: guzergah.aciklama ?? '',
      bolge: guzergah.bolge ?? '',
      yerleskeId: guzergah.yerleskeId,
      gecerlilikBaslangici: tarihInputDegeri(guzergah.gecerlilikBaslangici),
      gecerlilikBitisi: tarihInputDegeri(guzergah.gecerlilikBitisi),
    })
    setDialogAcik(true)
  }

  async function kaydet() {
    setHata(null)
    const url = duzenlenen ? `/api/servis-yonetimi/guzergah/${duzenlenen.id}` : '/api/servis-yonetimi/guzergah'
    const method = duzenlenen ? 'PUT' : 'POST'
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
    await fetch(`/api/servis-yonetimi/guzergah/${id}/pasiflestir`, { method: 'POST' })
    yukle()
  }

  async function geriAl(id: string) {
    await fetch(`/api/servis-yonetimi/guzergah/${id}/geri-al`, { method: 'POST' })
    yukle()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          placeholder="Kod veya ada göre ara"
          aria-label="Güzergâh ara"
          className="sm:max-w-sm"
        />
        {canManage && (
          <Button onClick={yeniAc} disabled={yerleskeler.length === 0}>
            <Plus className="mr-2 h-4 w-4" /> Yeni Güzergâh
          </Button>
        )}
      </div>
      {canManage && yerleskeler.length === 0 && !yukleniyor && (
        <p className="text-sm text-amber-600">Güzergâh eklemek için önce aktif bir yerleşke oluşturun.</p>
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
              <TableHead>Bölge</TableHead>
              <TableHead>Yerleşke</TableHead>
              <TableHead>Geçerlilik</TableHead>
              <TableHead>Durum</TableHead>
              {canManage && <TableHead className="text-right">İşlem</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtreliGuzergahlar.length === 0 && (
              <TableRow>
                <TableCell colSpan={canManage ? 7 : 6} className="text-center text-muted-foreground">
                  {arama.trim() ? 'Aramayla eşleşen güzergâh yok.' : 'Kayıt yok.'}
                </TableCell>
              </TableRow>
            )}
            {filtreliGuzergahlar.map((guzergah) => (
              <TableRow key={guzergah.id}>
                <TableCell className="font-mono">{guzergah.kod}</TableCell>
                <TableCell>{guzergah.ad}</TableCell>
                <TableCell>{guzergah.bolge || '-'}</TableCell>
                <TableCell>{guzergah.yerleske.kod} — {guzergah.yerleske.ad}</TableCell>
                <TableCell>
                  {tarihInputDegeri(guzergah.gecerlilikBaslangici) || '-'} / {tarihInputDegeri(guzergah.gecerlilikBitisi) || '-'}
                </TableCell>
                <TableCell><AktifBadge aktif={guzergah.aktif} /></TableCell>
                {canManage && (
                  <TableCell className="space-x-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => duzenleAc(guzergah)}>Düzenle</Button>
                    {guzergah.aktif ? (
                      <Button size="sm" variant="destructive" onClick={() => pasiflestir(guzergah.id)}>Pasifleştir</Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => geriAl(guzergah.id)}>Geri Al</Button>
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
            <DialogTitle>{duzenlenen ? 'Güzergâhı Düzenle' : 'Yeni Güzergâh'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="guzergah-kod">Kod *</Label>
                <Input id="guzergah-kod" value={form.kod} onChange={(e) => setForm({ ...form, kod: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="guzergah-ad">Ad *</Label>
                <Input id="guzergah-ad" value={form.ad} onChange={(e) => setForm({ ...form, ad: e.target.value })} />
              </div>
            </div>
            <div>
              <Label htmlFor="guzergah-yerleske">Yerleşke *</Label>
              <select
                id="guzergah-yerleske"
                value={form.yerleskeId}
                onChange={(e) => setForm({ ...form, yerleskeId: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Yerleşke seçin</option>
                {yerleskeler.map((yerleske) => (
                  <option key={yerleske.id} value={yerleske.id}>{yerleske.kod} — {yerleske.ad}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="guzergah-bolge">Bölge</Label>
              <Input id="guzergah-bolge" value={form.bolge} onChange={(e) => setForm({ ...form, bolge: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="guzergah-aciklama">Açıklama</Label>
              <Textarea id="guzergah-aciklama" value={form.aciklama} onChange={(e) => setForm({ ...form, aciklama: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="guzergah-baslangic">Geçerlilik Başlangıcı</Label>
                <Input id="guzergah-baslangic" type="date" value={form.gecerlilikBaslangici} onChange={(e) => setForm({ ...form, gecerlilikBaslangici: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="guzergah-bitis">Geçerlilik Bitişi</Label>
                <Input id="guzergah-bitis" type="date" value={form.gecerlilikBitisi} onChange={(e) => setForm({ ...form, gecerlilikBitisi: e.target.value })} />
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
          <TabsTrigger value="guzergah">Güzergâhlar</TabsTrigger>
        </TabsList>
        <TabsContent value="firma">
          <ServisFirmaPanel canManage={canManage} />
        </TabsContent>
        <TabsContent value="yerleske">
          <ServisYerleskePanel canManage={canManage} />
        </TabsContent>
        <TabsContent value="guzergah">
          <ServisGuzergahPanel canManage={canManage} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
