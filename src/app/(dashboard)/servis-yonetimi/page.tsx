'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Plus } from 'lucide-react'
import { ServisGecmisDialog, GecmisButonu } from './_components/ServisGecmisDialog'

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

type ServisDurak = {
  id: string
  kod: string
  ad: string
  adresEtiketi: string | null
  il: string | null
  ilce: string | null
  mahalle: string | null
  enlem: string | null
  boylam: string | null
  aktif: boolean
  createdAt: string
  updatedAt: string
}

type ServisArac = {
  id: string
  plaka: string
  kapasite: number
  firmaId: string
  firma: { id: string; ad: string; aktif: boolean }
  aracTipi: string | null
  aktif: boolean
  gecerlilikBaslangici: string | null
  gecerlilikBitisi: string | null
  createdAt: string
  updatedAt: string
}

type SoforPersonel = { id: string; adSoyad: string; sicilNo: string | null; aktif: boolean }

type ServisSofor = {
  id: string
  adSoyad: string
  telefon: string | null
  firmaId: string | null
  firma: { id: string; ad: string; aktif: boolean } | null
  personnelId: string | null
  personnel: SoforPersonel | null
  aktif: boolean
  createdAt: string
  updatedAt: string
}

type ServisSeferDilimiYon = 'GIDIS' | 'DONUS'

type ServisSeferDilimi = {
  id: string
  kod: string
  ad: string
  yon: ServisSeferDilimiYon
  grupKodu: string | null
  sira: number
  aktif: boolean
  createdAt: string
  updatedAt: string
}

// SIRKET_ARACI: 20260830112851_servis_sirket_araci_enum migration'ıyla
// (Melih) DB enum'una eklendi — burası yalnız o gerçek değeri yansıtıyor.
type ServisKullanimDurumu = 'SERVIS_KULLANIYOR' | 'KENDI_GELIYOR' | 'KULLANMIYOR' | 'SIRKET_ARACI'

type ServisPersonelDurumKaydi = {
  id: string
  personnelId: string
  personnel: { id: string; adSoyad: string; sicilNo: string | null; bolum: string | null; aktif: boolean }
  durum: ServisKullanimDurumu
  baslangicTarihi: string
  bitisTarihi: string | null
  aktif: boolean
  neden: string | null
}

function AktifBadge({ aktif }: { aktif: boolean }) {
  return (
    <Badge variant={aktif ? 'default' : 'secondary'}>
      {aktif ? 'Aktif' : 'Pasif'}
    </Badge>
  )
}

function ServisFirmaPanel({ canManage, canHistory }: { canManage: boolean; canHistory: boolean }) {
  const [firmalar, setFirmalar] = useState<ServisFirma[]>([])
  const [arama, setArama] = useState('')
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)
  const [dialogAcik, setDialogAcik] = useState(false)
  const [duzenlenen, setDuzenlenen] = useState<ServisFirma | null>(null)
  const [form, setForm] = useState({ ad: '', yetkiliAdi: '', telefon: '', eposta: '', adres: '' })
  const [gecmisFirma, setGecmisFirma] = useState<ServisFirma | null>(null)

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

  const normalize = (value: string) => value.toLocaleLowerCase('tr-TR')
  const filtreliFirmalar = firmalar.filter((firma) => {
    const query = normalize(arama.trim())
    return !query || normalize(firma.ad).includes(query) || (firma.yetkiliAdi && normalize(firma.yetkiliAdi).includes(query))
  })

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          placeholder="Ad veya yetkiliye göre ara"
          aria-label="Firma ara"
          className="sm:max-w-sm"
        />
        {canManage && (
          <Button onClick={yeniAc}>
            <Plus className="mr-2 h-4 w-4" /> Yeni Firma
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
              <TableHead>Ad</TableHead>
              <TableHead>Yetkili</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>Durum</TableHead>
              {(canManage || canHistory) && <TableHead className="text-right">İşlem</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtreliFirmalar.length === 0 && (
              <TableRow>
                <TableCell colSpan={canManage || canHistory ? 5 : 4} className="text-center text-muted-foreground">
                  {arama.trim() ? 'Aramayla eşleşen firma yok.' : 'Kayıt yok.'}
                </TableCell>
              </TableRow>
            )}
            {filtreliFirmalar.map((firma) => (
              <TableRow key={firma.id}>
                <TableCell>{firma.ad}</TableCell>
                <TableCell>{firma.yetkiliAdi || '-'}</TableCell>
                <TableCell>{firma.telefon || '-'}</TableCell>
                <TableCell><AktifBadge aktif={firma.aktif} /></TableCell>
                {(canManage || canHistory) && (
                  <TableCell className="text-right space-x-2">
                    {canHistory && <GecmisButonu onClick={() => setGecmisFirma(firma)} />}
                    {canManage && (
                      <>
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
                      </>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {gecmisFirma && (
        <ServisGecmisDialog
          hedefTipi="FIRMA"
          hedefId={gecmisFirma.id}
          baslik={gecmisFirma.ad}
          open={!!gecmisFirma}
          onOpenChange={(o) => !o && setGecmisFirma(null)}
        />
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

function ServisYerleskePanel({ canManage, canHistory }: { canManage: boolean; canHistory: boolean }) {
  const [yerleskeler, setYerleskeler] = useState<ServisYerleske[]>([])
  const [arama, setArama] = useState('')
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)
  const [dialogAcik, setDialogAcik] = useState(false)
  const [duzenlenen, setDuzenlenen] = useState<ServisYerleske | null>(null)
  const [form, setForm] = useState({ kod: '', ad: '', adres: '', enlem: '', boylam: '' })
  const [gecmisYerleske, setGecmisYerleske] = useState<ServisYerleske | null>(null)

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

  const normalize = (value: string) => value.toLocaleLowerCase('tr-TR')
  const filtreliYerleskeler = yerleskeler.filter((yerleske) => {
    const query = normalize(arama.trim())
    const alanlar = [yerleske.kod, yerleske.ad, yerleske.adres]
    return !query || alanlar.some((alan) => alan && normalize(alan).includes(query))
  })

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          placeholder="Kod, ad veya adrese göre ara"
          aria-label="Yerleşke ara"
          className="sm:max-w-sm"
        />
        {canManage && (
          <Button onClick={yeniAc}>
            <Plus className="mr-2 h-4 w-4" /> Yeni Yerleşke
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
              <TableHead>Kod</TableHead>
              <TableHead>Ad</TableHead>
              <TableHead>Adres</TableHead>
              <TableHead>Durum</TableHead>
              {(canManage || canHistory) && <TableHead className="text-right">İşlem</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtreliYerleskeler.length === 0 && (
              <TableRow>
                <TableCell colSpan={canManage || canHistory ? 5 : 4} className="text-center text-muted-foreground">
                  {arama.trim() ? 'Aramayla eşleşen yerleşke yok.' : 'Kayıt yok.'}
                </TableCell>
              </TableRow>
            )}
            {filtreliYerleskeler.map((yerleske) => (
              <TableRow key={yerleske.id}>
                <TableCell className="font-mono">{yerleske.kod}</TableCell>
                <TableCell>{yerleske.ad}</TableCell>
                <TableCell>{yerleske.adres || '-'}</TableCell>
                <TableCell><AktifBadge aktif={yerleske.aktif} /></TableCell>
                {(canManage || canHistory) && (
                  <TableCell className="text-right space-x-2">
                    {canHistory && <GecmisButonu onClick={() => setGecmisYerleske(yerleske)} />}
                    {canManage && (
                      <>
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
                      </>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {gecmisYerleske && (
        <ServisGecmisDialog
          hedefTipi="YERLESKE"
          hedefId={gecmisYerleske.id}
          baslik={gecmisYerleske.ad}
          open={!!gecmisYerleske}
          onOpenChange={(o) => !o && setGecmisYerleske(null)}
        />
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

function ServisGuzergahPanel({ canManage, canHistory }: { canManage: boolean; canHistory: boolean }) {
  const [guzergahlar, setGuzergahlar] = useState<ServisGuzergah[]>([])
  const [yerleskeler, setYerleskeler] = useState<ServisYerleske[]>([])
  const [arama, setArama] = useState('')
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)
  const [dialogAcik, setDialogAcik] = useState(false)
  const [duzenlenen, setDuzenlenen] = useState<ServisGuzergah | null>(null)
  const [form, setForm] = useState(bosGuzergahForm)
  const [gecmisGuzergah, setGecmisGuzergah] = useState<ServisGuzergah | null>(null)

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
              {(canManage || canHistory) && <TableHead className="text-right">İşlem</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtreliGuzergahlar.length === 0 && (
              <TableRow>
                <TableCell colSpan={canManage || canHistory ? 7 : 6} className="text-center text-muted-foreground">
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
                {(canManage || canHistory) && (
                  <TableCell className="space-x-2 text-right">
                    {canHistory && <GecmisButonu onClick={() => setGecmisGuzergah(guzergah)} />}
                    {canManage && (
                      <>
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/servis-yonetimi/guzergah/${guzergah.id}`}>Duraklar</Link>
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => duzenleAc(guzergah)}>Düzenle</Button>
                        {guzergah.aktif ? (
                          <Button size="sm" variant="destructive" onClick={() => pasiflestir(guzergah.id)}>Pasifleştir</Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => geriAl(guzergah.id)}>Geri Al</Button>
                        )}
                      </>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {gecmisGuzergah && (
        <ServisGecmisDialog
          hedefTipi="GUZERGAH"
          hedefId={gecmisGuzergah.id}
          baslik={gecmisGuzergah.ad}
          open={!!gecmisGuzergah}
          onOpenChange={(o) => !o && setGecmisGuzergah(null)}
        />
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

const bosDurakForm = {
  kod: '',
  ad: '',
  adresEtiketi: '',
  il: '',
  ilce: '',
  mahalle: '',
  enlem: '',
  boylam: '',
}

function ServisDurakPanel({ canManage, canHistory }: { canManage: boolean; canHistory: boolean }) {
  const [duraklar, setDuraklar] = useState<ServisDurak[]>([])
  const [arama, setArama] = useState('')
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)
  const [dialogAcik, setDialogAcik] = useState(false)
  const [duzenlenen, setDuzenlenen] = useState<ServisDurak | null>(null)
  const [form, setForm] = useState(bosDurakForm)
  const [gecmisDurak, setGecmisDurak] = useState<ServisDurak | null>(null)

  const yukle = useCallback(async () => {
    setYukleniyor(true)
    setHata(null)
    try {
      const res = await fetch('/api/servis-yonetimi/durak')
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setHata(json.message || 'Durak listesi alınamadı.')
        return
      }
      setDuraklar(json.data)
    } catch {
      setHata('Durak listesi alınırken beklenmeyen bir hata oluştu.')
    } finally {
      setYukleniyor(false)
    }
  }, [])

  useEffect(() => {
    yukle()
  }, [yukle])

  const normalize = (value: string) => value.toLocaleLowerCase('tr-TR')
  const filtreliDuraklar = duraklar.filter((durak) => {
    const query = normalize(arama.trim())
    const alanlar = [durak.kod, durak.ad, durak.il, durak.ilce, durak.mahalle]
    return !query || alanlar.some((alan) => alan && normalize(alan).includes(query))
  })

  function yeniAc() {
    setDuzenlenen(null)
    setForm(bosDurakForm)
    setDialogAcik(true)
  }

  function duzenleAc(durak: ServisDurak) {
    setDuzenlenen(durak)
    setForm({
      kod: durak.kod,
      ad: durak.ad,
      adresEtiketi: durak.adresEtiketi ?? '',
      il: durak.il ?? '',
      ilce: durak.ilce ?? '',
      mahalle: durak.mahalle ?? '',
      enlem: durak.enlem ?? '',
      boylam: durak.boylam ?? '',
    })
    setDialogAcik(true)
  }

  async function kaydet() {
    setHata(null)
    const url = duzenlenen ? `/api/servis-yonetimi/durak/${duzenlenen.id}` : '/api/servis-yonetimi/durak'
    const method = duzenlenen ? 'PATCH' : 'POST'
    const body = {
      ...form,
      enlem: form.enlem.trim() ? Number(form.enlem) : null,
      boylam: form.boylam.trim() ? Number(form.boylam) : null,
    }
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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
    await fetch(`/api/servis-yonetimi/durak/${id}/pasiflestir`, { method: 'POST' })
    yukle()
  }

  async function geriAl(id: string) {
    await fetch(`/api/servis-yonetimi/durak/${id}/geri-al`, { method: 'POST' })
    yukle()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          placeholder="Kod, ad, il, ilçe veya mahalleye göre ara"
          aria-label="Durak ara"
          className="sm:max-w-md"
        />
        {canManage && (
          <Button onClick={yeniAc}>
            <Plus className="mr-2 h-4 w-4" /> Yeni Durak
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
              <TableHead>Kod</TableHead>
              <TableHead>Ad</TableHead>
              <TableHead>Konum</TableHead>
              <TableHead>Adres Etiketi</TableHead>
              <TableHead>Koordinat</TableHead>
              <TableHead>Durum</TableHead>
              {(canManage || canHistory) && <TableHead className="text-right">İşlem</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtreliDuraklar.length === 0 && (
              <TableRow>
                <TableCell colSpan={canManage || canHistory ? 7 : 6} className="text-center text-muted-foreground">
                  {arama.trim() ? 'Aramayla eşleşen durak yok.' : 'Kayıt yok.'}
                </TableCell>
              </TableRow>
            )}
            {filtreliDuraklar.map((durak) => (
              <TableRow key={durak.id}>
                <TableCell className="font-mono">{durak.kod}</TableCell>
                <TableCell>{durak.ad}</TableCell>
                <TableCell>{[durak.il, durak.ilce, durak.mahalle].filter(Boolean).join(' / ') || '-'}</TableCell>
                <TableCell>{durak.adresEtiketi || '-'}</TableCell>
                <TableCell>{durak.enlem && durak.boylam ? `${durak.enlem}, ${durak.boylam}` : '-'}</TableCell>
                <TableCell><AktifBadge aktif={durak.aktif} /></TableCell>
                {(canManage || canHistory) && (
                  <TableCell className="space-x-2 text-right">
                    {canHistory && <GecmisButonu onClick={() => setGecmisDurak(durak)} />}
                    {canManage && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => duzenleAc(durak)}>Düzenle</Button>
                        {durak.aktif ? (
                          <Button size="sm" variant="destructive" onClick={() => pasiflestir(durak.id)}>Pasifleştir</Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => geriAl(durak.id)}>Geri Al</Button>
                        )}
                      </>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {gecmisDurak && (
        <ServisGecmisDialog
          hedefTipi="DURAK"
          hedefId={gecmisDurak.id}
          baslik={gecmisDurak.ad}
          open={!!gecmisDurak}
          onOpenChange={(o) => !o && setGecmisDurak(null)}
        />
      )}

      <Dialog open={dialogAcik} onOpenChange={setDialogAcik}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{duzenlenen ? 'Durağı Düzenle' : 'Yeni Durak'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="durak-kod">Kod *</Label>
                <Input id="durak-kod" value={form.kod} onChange={(e) => setForm({ ...form, kod: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="durak-ad">Ad *</Label>
                <Input id="durak-ad" value={form.ad} onChange={(e) => setForm({ ...form, ad: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="durak-il">İl</Label>
                <Input id="durak-il" value={form.il} onChange={(e) => setForm({ ...form, il: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="durak-ilce">İlçe</Label>
                <Input id="durak-ilce" value={form.ilce} onChange={(e) => setForm({ ...form, ilce: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="durak-mahalle">Mahalle</Label>
                <Input id="durak-mahalle" value={form.mahalle} onChange={(e) => setForm({ ...form, mahalle: e.target.value })} />
              </div>
            </div>
            <div>
              <Label htmlFor="durak-adres">Adres Etiketi</Label>
              <Textarea id="durak-adres" value={form.adresEtiketi} onChange={(e) => setForm({ ...form, adresEtiketi: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="durak-enlem">Enlem</Label>
                <Input id="durak-enlem" type="number" step="0.000001" min="-90" max="90" value={form.enlem} onChange={(e) => setForm({ ...form, enlem: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="durak-boylam">Boylam</Label>
                <Input id="durak-boylam" type="number" step="0.000001" min="-180" max="180" value={form.boylam} onChange={(e) => setForm({ ...form, boylam: e.target.value })} />
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

const bosAracForm = {
  plaka: '',
  kapasite: '',
  firmaId: '',
  aracTipi: '',
  gecerlilikBaslangici: '',
  gecerlilikBitisi: '',
}

function ServisAracPanel({ canManage, canHistory }: { canManage: boolean; canHistory: boolean }) {
  const [araclar, setAraclar] = useState<ServisArac[]>([])
  const [firmalar, setFirmalar] = useState<ServisFirma[]>([])
  const [arama, setArama] = useState('')
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)
  const [dialogAcik, setDialogAcik] = useState(false)
  const [duzenlenen, setDuzenlenen] = useState<ServisArac | null>(null)
  const [form, setForm] = useState(bosAracForm)
  const [gecmisArac, setGecmisArac] = useState<ServisArac | null>(null)

  const yukle = useCallback(async () => {
    setYukleniyor(true)
    setHata(null)
    try {
      const [aracRes, firmaRes] = await Promise.all([
        fetch('/api/servis-yonetimi/arac'),
        fetch('/api/servis-yonetimi/firma?durum=aktif'),
      ])
      const [aracJson, firmaJson] = await Promise.all([aracRes.json(), firmaRes.json()])
      if (!aracRes.ok || !aracJson.ok) {
        setHata(aracJson.message || 'Araç listesi alınamadı.')
        return
      }
      if (!firmaRes.ok || !firmaJson.ok) {
        setHata(firmaJson.message || 'Firma listesi alınamadı.')
        return
      }
      setAraclar(aracJson.data)
      setFirmalar(firmaJson.data)
    } catch {
      setHata('Araç listesi alınırken beklenmeyen bir hata oluştu.')
    } finally {
      setYukleniyor(false)
    }
  }, [])

  useEffect(() => {
    yukle()
  }, [yukle])

  const normalize = (value: string) => value.toLocaleLowerCase('tr-TR')
  const filtreliAraclar = araclar.filter((arac) => {
    const query = normalize(arama.trim())
    return !query || normalize(arac.plaka).includes(query) || (arac.aracTipi && normalize(arac.aracTipi).includes(query))
  })

  function yeniAc() {
    setDuzenlenen(null)
    setForm({ ...bosAracForm, firmaId: firmalar[0]?.id || '' })
    setDialogAcik(true)
  }

  function duzenleAc(arac: ServisArac) {
    setDuzenlenen(arac)
    setForm({
      plaka: arac.plaka,
      kapasite: String(arac.kapasite),
      firmaId: arac.firmaId,
      aracTipi: arac.aracTipi ?? '',
      gecerlilikBaslangici: tarihInputDegeri(arac.gecerlilikBaslangici),
      gecerlilikBitisi: tarihInputDegeri(arac.gecerlilikBitisi),
    })
    setDialogAcik(true)
  }

  async function kaydet() {
    setHata(null)
    const url = duzenlenen ? `/api/servis-yonetimi/arac/${duzenlenen.id}` : '/api/servis-yonetimi/arac'
    const method = duzenlenen ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, kapasite: Number(form.kapasite) }),
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
    await fetch(`/api/servis-yonetimi/arac/${id}/pasiflestir`, { method: 'POST' })
    yukle()
  }

  async function geriAl(id: string) {
    await fetch(`/api/servis-yonetimi/arac/${id}/geri-al`, { method: 'POST' })
    yukle()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          placeholder="Plaka veya araç tipine göre ara"
          aria-label="Araç ara"
          className="sm:max-w-sm"
        />
        {canManage && (
          <Button onClick={yeniAc} disabled={firmalar.length === 0}>
            <Plus className="mr-2 h-4 w-4" /> Yeni Araç
          </Button>
        )}
      </div>
      {canManage && firmalar.length === 0 && !yukleniyor && (
        <p className="text-sm text-amber-600">Araç eklemek için önce aktif bir taşeron firma oluşturun.</p>
      )}
      {hata && <p className="text-sm text-red-600">{hata}</p>}
      {yukleniyor ? (
        <p className="text-sm text-muted-foreground">Yükleniyor...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plaka</TableHead>
              <TableHead>Kapasite</TableHead>
              <TableHead>Firma</TableHead>
              <TableHead>Araç Tipi</TableHead>
              <TableHead>Geçerlilik</TableHead>
              <TableHead>Durum</TableHead>
              {(canManage || canHistory) && <TableHead className="text-right">İşlem</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtreliAraclar.length === 0 && (
              <TableRow>
                <TableCell colSpan={canManage || canHistory ? 7 : 6} className="text-center text-muted-foreground">
                  {arama.trim() ? 'Aramayla eşleşen araç yok.' : 'Kayıt yok.'}
                </TableCell>
              </TableRow>
            )}
            {filtreliAraclar.map((arac) => (
              <TableRow key={arac.id}>
                <TableCell className="font-mono">{arac.plaka}</TableCell>
                <TableCell>{arac.kapasite}</TableCell>
                <TableCell>{arac.firma.ad}{arac.firma.aktif ? '' : ' (Pasif)'}</TableCell>
                <TableCell>{arac.aracTipi || '-'}</TableCell>
                <TableCell>
                  {tarihInputDegeri(arac.gecerlilikBaslangici) || '-'} / {tarihInputDegeri(arac.gecerlilikBitisi) || '-'}
                </TableCell>
                <TableCell><AktifBadge aktif={arac.aktif} /></TableCell>
                {(canManage || canHistory) && (
                  <TableCell className="space-x-2 text-right">
                    {canHistory && <GecmisButonu onClick={() => setGecmisArac(arac)} />}
                    {canManage && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => duzenleAc(arac)}>Düzenle</Button>
                        {arac.aktif ? (
                          <Button size="sm" variant="destructive" onClick={() => pasiflestir(arac.id)}>Pasifleştir</Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => geriAl(arac.id)}>Geri Al</Button>
                        )}
                      </>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {gecmisArac && (
        <ServisGecmisDialog
          hedefTipi="ARAC"
          hedefId={gecmisArac.id}
          baslik={gecmisArac.plaka}
          open={!!gecmisArac}
          onOpenChange={(o) => !o && setGecmisArac(null)}
        />
      )}

      <Dialog open={dialogAcik} onOpenChange={setDialogAcik}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{duzenlenen ? 'Aracı Düzenle' : 'Yeni Araç'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="arac-plaka">Plaka *</Label>
                <Input id="arac-plaka" value={form.plaka} onChange={(e) => setForm({ ...form, plaka: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="arac-kapasite">Kapasite *</Label>
                <Input id="arac-kapasite" type="number" min="1" step="1" value={form.kapasite} onChange={(e) => setForm({ ...form, kapasite: e.target.value })} />
              </div>
            </div>
            <div>
              <Label htmlFor="arac-firma">Taşeron Firma *</Label>
              <select
                id="arac-firma"
                value={form.firmaId}
                onChange={(e) => setForm({ ...form, firmaId: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Firma seçin</option>
                {firmalar.map((firma) => <option key={firma.id} value={firma.id}>{firma.ad}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="arac-tipi">Araç Tipi</Label>
              <Input id="arac-tipi" value={form.aracTipi} onChange={(e) => setForm({ ...form, aracTipi: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="arac-baslangic">Geçerlilik Başlangıcı</Label>
                <Input id="arac-baslangic" type="date" value={form.gecerlilikBaslangici} onChange={(e) => setForm({ ...form, gecerlilikBaslangici: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="arac-bitis">Geçerlilik Bitişi</Label>
                <Input id="arac-bitis" type="date" value={form.gecerlilikBitisi} onChange={(e) => setForm({ ...form, gecerlilikBitisi: e.target.value })} />
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

type SoforPickedPersonel = { id: string; sicilNo: string | null; adSoyad: string }

// Dahili personel şoförü seçimi — toplu-kart-okutamama/_components/personnel-picker.tsx
// ile aynı desen (arama-üzerine-seç, elle serbest metin girişi yok), servis-yonetimi'nin
// kendi dar kapsamlı arama uç noktasına (/api/servis-yonetimi/personel-ara) bağlanır.
function SoforPersonelPicker({
  id,
  value,
  onSelect,
}: {
  id?: string
  value: SoforPickedPersonel | null
  onSelect: (personel: SoforPickedPersonel) => void
}) {
  const [query, setQuery] = useState('')
  const [sonuclar, setSonuclar] = useState<SoforPickedPersonel[]>([])
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
        id={id}
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

type SoforKimlikTuru = 'FIRMA' | 'PERSONEL'

const bosSoforForm = { adSoyad: '', telefon: '', kimlikTuru: 'FIRMA' as SoforKimlikTuru, firmaId: '', personnelId: '' }

function ServisSoforPanel({ canManage, canHistory }: { canManage: boolean; canHistory: boolean }) {
  const [soforler, setSoforler] = useState<ServisSofor[]>([])
  const [firmalar, setFirmalar] = useState<ServisFirma[]>([])
  const [arama, setArama] = useState('')
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)
  const [dialogAcik, setDialogAcik] = useState(false)
  const [duzenlenen, setDuzenlenen] = useState<ServisSofor | null>(null)
  const [form, setForm] = useState(bosSoforForm)
  const [secilenPersonel, setSecilenPersonel] = useState<SoforPickedPersonel | null>(null)
  const [gecmisSofor, setGecmisSofor] = useState<ServisSofor | null>(null)

  const yukle = useCallback(async () => {
    setYukleniyor(true)
    setHata(null)
    try {
      const [soforRes, firmaRes] = await Promise.all([
        fetch('/api/servis-yonetimi/sofor'),
        fetch('/api/servis-yonetimi/firma?durum=aktif'),
      ])
      const [soforJson, firmaJson] = await Promise.all([soforRes.json(), firmaRes.json()])
      if (!soforRes.ok || !soforJson.ok) {
        setHata(soforJson.message || 'Şoför listesi alınamadı.')
        return
      }
      if (!firmaRes.ok || !firmaJson.ok) {
        setHata(firmaJson.message || 'Firma listesi alınamadı.')
        return
      }
      setSoforler(soforJson.data)
      setFirmalar(firmaJson.data)
    } catch {
      setHata('Şoför listesi alınırken beklenmeyen bir hata oluştu.')
    } finally {
      setYukleniyor(false)
    }
  }, [])

  useEffect(() => { yukle() }, [yukle])

  const query = arama.trim().toLocaleLowerCase('tr-TR')
  const filtreliSoforler = soforler.filter((sofor) =>
    !query || sofor.adSoyad.toLocaleLowerCase('tr-TR').includes(query)
  )

  function yeniAc() {
    setDuzenlenen(null)
    setSecilenPersonel(null)
    setForm({ ...bosSoforForm, firmaId: firmalar[0]?.id || '' })
    setDialogAcik(true)
  }

  function duzenleAc(sofor: ServisSofor) {
    setDuzenlenen(sofor)
    setForm({
      adSoyad: sofor.adSoyad,
      telefon: sofor.telefon || '',
      kimlikTuru: sofor.personnelId ? 'PERSONEL' : 'FIRMA',
      firmaId: sofor.firmaId || '',
      personnelId: sofor.personnelId || '',
    })
    setSecilenPersonel(
      sofor.personnel ? { id: sofor.personnel.id, sicilNo: sofor.personnel.sicilNo, adSoyad: sofor.personnel.adSoyad } : null
    )
    setDialogAcik(true)
  }

  async function kaydet() {
    setHata(null)
    const govde = {
      adSoyad: form.adSoyad,
      telefon: form.telefon,
      firmaId: form.kimlikTuru === 'FIRMA' ? form.firmaId : '',
      personnelId: form.kimlikTuru === 'PERSONEL' ? form.personnelId : '',
    }
    const url = duzenlenen ? `/api/servis-yonetimi/sofor/${duzenlenen.id}` : '/api/servis-yonetimi/sofor'
    const res = await fetch(url, {
      method: duzenlenen ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(govde),
    })
    const json = await res.json()
    if (!res.ok || !json.ok) {
      setHata(json.message || 'Kaydedilemedi.')
      return
    }
    setDialogAcik(false)
    yukle()
  }

  async function durumDegistir(id: string, aktif: boolean) {
    await fetch(`/api/servis-yonetimi/sofor/${id}/${aktif ? 'pasiflestir' : 'geri-al'}`, { method: 'POST' })
    yukle()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input value={arama} onChange={(e) => setArama(e.target.value)} placeholder="Ad soyada göre ara" aria-label="Şoför ara" className="sm:max-w-sm" />
        {canManage && <Button onClick={yeniAc}><Plus className="mr-2 h-4 w-4" /> Yeni Şoför</Button>}
      </div>
      {hata && <p className="text-sm text-red-600">{hata}</p>}
      {yukleniyor ? <p className="text-sm text-muted-foreground">Yükleniyor...</p> : (
        <Table>
          <TableHeader><TableRow><TableHead>Ad Soyad</TableHead><TableHead>Telefon</TableHead><TableHead>Tür</TableHead><TableHead>Bağlı Olduğu</TableHead><TableHead>Durum</TableHead>{(canManage || canHistory) && <TableHead className="text-right">İşlem</TableHead>}</TableRow></TableHeader>
          <TableBody>
            {filtreliSoforler.length === 0 && <TableRow><TableCell colSpan={canManage || canHistory ? 6 : 5} className="text-center text-muted-foreground">{query ? 'Aramayla eşleşen şoför yok.' : 'Kayıt yok.'}</TableCell></TableRow>}
            {filtreliSoforler.map((sofor) => (
              <TableRow key={sofor.id}>
                <TableCell>{sofor.adSoyad}</TableCell><TableCell>{sofor.telefon || '-'}</TableCell>
                <TableCell>{sofor.personnelId ? 'İç Personel' : 'Taşeron Firma'}</TableCell>
                <TableCell>
                  {sofor.personnelId
                    ? `${sofor.personnel?.adSoyad || '-'}${sofor.personnel && !sofor.personnel.aktif ? ' (Pasif)' : ''}`
                    : `${sofor.firma?.ad || '-'}${sofor.firma && !sofor.firma.aktif ? ' (Pasif)' : ''}`}
                </TableCell>
                <TableCell><AktifBadge aktif={sofor.aktif} /></TableCell>
                {(canManage || canHistory) && (
                  <TableCell className="space-x-2 text-right">
                    {canHistory && <GecmisButonu onClick={() => setGecmisSofor(sofor)} />}
                    {canManage && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => duzenleAc(sofor)}>Düzenle</Button>
                        {sofor.aktif ? <Button size="sm" variant="destructive" onClick={() => durumDegistir(sofor.id, true)}>Pasifleştir</Button> : <Button size="sm" variant="outline" onClick={() => durumDegistir(sofor.id, false)}>Geri Al</Button>}
                      </>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {gecmisSofor && (
        <ServisGecmisDialog
          hedefTipi="SOFOR"
          hedefId={gecmisSofor.id}
          baslik={gecmisSofor.adSoyad}
          open={!!gecmisSofor}
          onOpenChange={(o) => !o && setGecmisSofor(null)}
        />
      )}
      <Dialog open={dialogAcik} onOpenChange={setDialogAcik}>
        <DialogContent><DialogHeader><DialogTitle>{duzenlenen ? 'Şoförü Düzenle' : 'Yeni Şoför'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label htmlFor="sofor-ad-soyad">Ad Soyad *</Label><Input id="sofor-ad-soyad" value={form.adSoyad} onChange={(e) => setForm({ ...form, adSoyad: e.target.value })} /></div>
            <div><Label htmlFor="sofor-telefon">Telefon</Label><Input id="sofor-telefon" type="tel" placeholder="0532 123 45 67" value={form.telefon} onChange={(e) => setForm({ ...form, telefon: e.target.value })} /></div>
            <div>
              <Label>Şoför Türü *</Label>
              <RadioGroup
                value={form.kimlikTuru}
                onValueChange={(v) => setForm({ ...form, kimlikTuru: v as SoforKimlikTuru })}
                className="flex flex-col gap-2 pt-1 sm:flex-row sm:gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="FIRMA" id="sofor-tur-firma" />
                  <Label htmlFor="sofor-tur-firma" className="cursor-pointer font-normal">Taşeron Firma Şoförü</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="PERSONEL" id="sofor-tur-personel" />
                  <Label htmlFor="sofor-tur-personel" className="cursor-pointer font-normal">İç Personel Şoförü</Label>
                </div>
              </RadioGroup>
            </div>
            {form.kimlikTuru === 'FIRMA' ? (
              <div>
                <Label htmlFor="sofor-firma">Taşeron Firma *</Label>
                {firmalar.length === 0 ? (
                  <p className="text-sm text-amber-600">Seçilecek aktif taşeron firma yok — önce Firmalar sekmesinden bir firma oluşturun.</p>
                ) : (
                  <select id="sofor-firma" value={form.firmaId} onChange={(e) => setForm({ ...form, firmaId: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">Firma seçin</option>
                    {firmalar.map((firma) => <option key={firma.id} value={firma.id}>{firma.ad}</option>)}
                  </select>
                )}
              </div>
            ) : (
              <div>
                <Label htmlFor="sofor-personel">Personel *</Label>
                <SoforPersonelPicker
                  id="sofor-personel"
                  value={secilenPersonel}
                  onSelect={(p) => { setSecilenPersonel(p); setForm({ ...form, personnelId: p.id }) }}
                />
              </div>
            )}
          </div>
          <DialogFooter><Button onClick={kaydet}>Kaydet</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

const bosSeferDilimiForm = { kod: '', ad: '', yon: 'GIDIS' as ServisSeferDilimiYon, grupKodu: '', sira: '1' }

function ServisSeferDilimiPanel({ canManage, canHistory }: { canManage: boolean; canHistory: boolean }) {
  const [dilimler, setDilimler] = useState<ServisSeferDilimi[]>([])
  const [arama, setArama] = useState('')
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)
  const [dialogAcik, setDialogAcik] = useState(false)
  const [duzenlenen, setDuzenlenen] = useState<ServisSeferDilimi | null>(null)
  const [form, setForm] = useState(bosSeferDilimiForm)
  const [gecmisDilim, setGecmisDilim] = useState<ServisSeferDilimi | null>(null)

  const yukle = useCallback(async () => {
    setYukleniyor(true)
    setHata(null)
    try {
      const res = await fetch('/api/servis-yonetimi/sefer-dilimi')
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setHata(json.message || 'Sefer dilimi listesi alınamadı.')
        return
      }
      setDilimler(json.data)
    } catch {
      setHata('Sefer dilimi listesi alınırken beklenmeyen bir hata oluştu.')
    } finally {
      setYukleniyor(false)
    }
  }, [])

  useEffect(() => {
    yukle()
  }, [yukle])

  const normalize = (value: string) => value.toLocaleLowerCase('tr-TR')
  const filtreliDilimler = dilimler.filter((dilim) => {
    const query = normalize(arama.trim())
    const alanlar = [dilim.kod, dilim.ad, dilim.grupKodu]
    return !query || alanlar.some((alan) => alan && normalize(alan).includes(query))
  })

  function yeniAc() {
    setDuzenlenen(null)
    setForm(bosSeferDilimiForm)
    setDialogAcik(true)
  }

  function duzenleAc(dilim: ServisSeferDilimi) {
    setDuzenlenen(dilim)
    setForm({
      kod: dilim.kod,
      ad: dilim.ad,
      yon: dilim.yon,
      grupKodu: dilim.grupKodu ?? '',
      sira: String(dilim.sira),
    })
    setDialogAcik(true)
  }

  async function kaydet() {
    setHata(null)
    const url = duzenlenen ? `/api/servis-yonetimi/sefer-dilimi/${duzenlenen.id}` : '/api/servis-yonetimi/sefer-dilimi'
    const res = await fetch(url, {
      method: duzenlenen ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kod: form.kod,
        ad: form.ad,
        yon: form.yon,
        grupKodu: form.grupKodu,
        sira: form.sira ? Number(form.sira) : form.sira,
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
    await fetch(`/api/servis-yonetimi/sefer-dilimi/${id}/pasiflestir`, { method: 'POST' })
    yukle()
  }

  async function geriAl(id: string) {
    await fetch(`/api/servis-yonetimi/sefer-dilimi/${id}/geri-al`, { method: 'POST' })
    yukle()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          placeholder="Kod, ad veya vardiya etiketine göre ara"
          aria-label="Sefer dilimi ara"
          className="sm:max-w-sm"
        />
        {canManage && (
          <Button onClick={yeniAc}>
            <Plus className="mr-2 h-4 w-4" /> Yeni Sefer Dilimi
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
              <TableHead>Kod</TableHead>
              <TableHead>Ad</TableHead>
              <TableHead>Yön</TableHead>
              <TableHead>Vardiya Etiketi</TableHead>
              <TableHead>Sıra</TableHead>
              <TableHead>Durum</TableHead>
              {(canManage || canHistory) && <TableHead className="text-right">İşlem</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtreliDilimler.length === 0 && (
              <TableRow>
                <TableCell colSpan={canManage || canHistory ? 7 : 6} className="text-center text-muted-foreground">
                  {arama.trim() ? 'Aramayla eşleşen sefer dilimi yok.' : 'Kayıt yok.'}
                </TableCell>
              </TableRow>
            )}
            {filtreliDilimler.map((dilim) => (
              <TableRow key={dilim.id}>
                <TableCell className="font-mono">{dilim.kod}</TableCell>
                <TableCell>{dilim.ad}</TableCell>
                <TableCell>{dilim.yon === 'GIDIS' ? 'Gidiş' : 'Dönüş'}</TableCell>
                <TableCell>{dilim.grupKodu || '-'}</TableCell>
                <TableCell>{dilim.sira}</TableCell>
                <TableCell><AktifBadge aktif={dilim.aktif} /></TableCell>
                {(canManage || canHistory) && (
                  <TableCell className="text-right space-x-2">
                    {canHistory && <GecmisButonu onClick={() => setGecmisDilim(dilim)} />}
                    {canManage && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => duzenleAc(dilim)}>
                          Düzenle
                        </Button>
                        {dilim.aktif ? (
                          <Button size="sm" variant="destructive" onClick={() => pasiflestir(dilim.id)}>
                            Pasifleştir
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => geriAl(dilim.id)}>
                            Geri Al
                          </Button>
                        )}
                      </>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {gecmisDilim && (
        <ServisGecmisDialog
          hedefTipi="SEFER_DILIMI"
          hedefId={gecmisDilim.id}
          baslik={gecmisDilim.kod}
          open={!!gecmisDilim}
          onOpenChange={(o) => !o && setGecmisDilim(null)}
        />
      )}

      <Dialog open={dialogAcik} onOpenChange={setDialogAcik}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{duzenlenen ? 'Sefer Dilimini Düzenle' : 'Yeni Sefer Dilimi'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="dilim-kod">Kod *</Label>
              <Input id="dilim-kod" value={form.kod} onChange={(e) => setForm({ ...form, kod: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="dilim-ad">Ad *</Label>
              <Input id="dilim-ad" value={form.ad} onChange={(e) => setForm({ ...form, ad: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="dilim-yon">Yön *</Label>
              <select
                id="dilim-yon"
                value={form.yon}
                onChange={(e) => setForm({ ...form, yon: e.target.value as ServisSeferDilimiYon })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="GIDIS">Gidiş</option>
                <option value="DONUS">Dönüş</option>
              </select>
            </div>
            <div>
              <Label htmlFor="dilim-grup-kodu">Vardiya Etiketi</Label>
              <Input
                id="dilim-grup-kodu"
                placeholder="Örn. VARDIYA-1"
                value={form.grupKodu}
                onChange={(e) => setForm({ ...form, grupKodu: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="dilim-sira">Sıra * (listeleme sırası)</Label>
              <Input
                id="dilim-sira"
                type="number"
                min={1}
                value={form.sira}
                onChange={(e) => setForm({ ...form, sira: e.target.value })}
              />
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

function durumEtiketiGoster(durum: ServisKullanimDurumu): string {
  switch (durum) {
    case 'SERVIS_KULLANIYOR': return 'Servis Kullanıyor'
    case 'KENDI_GELIYOR': return 'Kendi Geliyor'
    case 'KULLANMIYOR': return 'Kullanmıyor'
    case 'SIRKET_ARACI': return 'Şirket Aracı Kullanıyor'
  }
}

const bugunPersonelDurum = () => new Date().toISOString().slice(0, 10)
const bosPersonelDurumForm = { personnelId: '', durum: 'SERVIS_KULLANIYOR' as ServisKullanimDurumu, baslangicTarihi: bugunPersonelDurum(), bitisTarihi: '', neden: '' }

function ServisPersonelDurumPanel({
  canCreate,
  canEdit,
  canPassive,
  canRestore,
  canHistory,
}: {
  canCreate: boolean
  canEdit: boolean
  canPassive: boolean
  canRestore: boolean
  canHistory: boolean
}) {
  const [liste, setListe] = useState<ServisPersonelDurumKaydi[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)
  const [dialogAcik, setDialogAcik] = useState(false)
  // SoforPersonelPicker / SoforPickedPersonel yukarıda "İç Personel Şoförü"
  // için tanımlı — burada da aynen tekrar kullanılıyor (aynı dosyada,
  // Sofor'a özel bir mantığı yok, salt personel arama-seç bileşeni).
  const [secilenPersonel, setSecilenPersonel] = useState<SoforPickedPersonel | null>(null)
  const [form, setForm] = useState(bosPersonelDurumForm)
  const [kapatilan, setKapatilan] = useState<ServisPersonelDurumKaydi | null>(null)
  const [kapatmaTarihi, setKapatmaTarihi] = useState('')
  const [duzenlenen, setDuzenlenen] = useState<ServisPersonelDurumKaydi | null>(null)
  const [duzenlemeNeden, setDuzenlemeNeden] = useState('')
  const [gecmisKayit, setGecmisKayit] = useState<ServisPersonelDurumKaydi | null>(null)

  const yukle = useCallback(async () => {
    setYukleniyor(true)
    setHata(null)
    try {
      const res = await fetch('/api/servis-yonetimi/personel-durum')
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setHata(json.message || 'Servis kullanım durumu listesi alınamadı.')
        return
      }
      setListe(json.data)
    } catch {
      setHata('Veriler alınırken beklenmeyen bir hata oluştu.')
    } finally {
      setYukleniyor(false)
    }
  }, [])

  useEffect(() => { yukle() }, [yukle])

  function yeniAc() {
    setSecilenPersonel(null)
    setForm(bosPersonelDurumForm)
    setHata(null)
    setDialogAcik(true)
  }

  async function kaydet() {
    setHata(null)
    const res = await fetch('/api/servis-yonetimi/personel-durum', {
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

  function kapatmaAc(v: ServisPersonelDurumKaydi) {
    setKapatilan(v)
    setKapatmaTarihi(bugunPersonelDurum())
    setHata(null)
  }

  function duzenlemeAc(v: ServisPersonelDurumKaydi) {
    setDuzenlenen(v)
    setDuzenlemeNeden(v.neden || '')
    setHata(null)
  }

  async function duzenlemeKaydet() {
    if (!duzenlenen) return
    setHata(null)
    const res = await fetch(`/api/servis-yonetimi/personel-durum/${duzenlenen.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ neden: duzenlemeNeden }),
    })
    const json = await res.json()
    if (!res.ok || !json.ok) {
      setHata(json.message || 'Güncellenemedi.')
      return
    }
    setDuzenlenen(null)
    yukle()
  }

  async function kapat() {
    if (!kapatilan) return
    setHata(null)
    const res = await fetch(`/api/servis-yonetimi/personel-durum/${kapatilan.id}/pasiflestir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bitisTarihi: kapatmaTarihi }),
    })
    const json = await res.json()
    if (!res.ok || !json.ok) {
      setHata(json.message || 'Kayıt kapatılamadı.')
      return
    }
    setKapatilan(null)
    yukle()
  }

  async function geriAl(id: string) {
    setHata(null)
    const res = await fetch(`/api/servis-yonetimi/personel-durum/${id}/geri-al`, { method: 'POST' })
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
        <h2 className="text-lg font-medium">Personel Servis Kullanım Durumları</h2>
        {canCreate && (
          <Button size="sm" onClick={yeniAc}>
            <Plus className="mr-2 h-4 w-4" /> Yeni Kayıt
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
              <TableHead>Bölüm</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead>Başlangıç</TableHead>
              <TableHead>Bitiş</TableHead>
              <TableHead>Kayıt Durumu</TableHead>
              {(canEdit || canPassive || canRestore || canHistory) && <TableHead className="text-right">İşlem</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {liste.length === 0 && (
              <TableRow>
                <TableCell colSpan={canEdit || canPassive || canRestore || canHistory ? 7 : 6} className="text-center text-muted-foreground">
                  Kayıt yok.
                </TableCell>
              </TableRow>
            )}
            {liste.map((v) => (
              <TableRow key={v.id}>
                <TableCell>{v.personnel.adSoyad}{!v.personnel.aktif ? ' (Pasif)' : ''}</TableCell>
                <TableCell>{v.personnel.bolum || '-'}</TableCell>
                <TableCell>{durumEtiketiGoster(v.durum)}</TableCell>
                <TableCell>{v.baslangicTarihi.slice(0, 10)}</TableCell>
                <TableCell>{v.bitisTarihi ? v.bitisTarihi.slice(0, 10) : '-'}</TableCell>
                <TableCell><AktifBadge aktif={v.aktif} /></TableCell>
                {(canEdit || canPassive || canRestore || canHistory) && (
                  <TableCell className="text-right space-x-2">
                    {canHistory && <GecmisButonu onClick={() => setGecmisKayit(v)} />}
                    {canEdit && (
                      <Button size="sm" variant="outline" onClick={() => duzenlemeAc(v)}>Düzenle</Button>
                    )}
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

      {gecmisKayit && (
        <ServisGecmisDialog
          hedefTipi="PERSONEL_DURUM"
          hedefId={gecmisKayit.id}
          baslik={gecmisKayit.personnel.adSoyad}
          open={!!gecmisKayit}
          onOpenChange={(o) => !o && setGecmisKayit(null)}
        />
      )}

      <Dialog open={dialogAcik} onOpenChange={setDialogAcik}>
        <DialogContent>
          <DialogHeader><DialogTitle>Yeni Servis Kullanım Durumu Kaydı</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="pd-personel">Personel *</Label>
              <SoforPersonelPicker
                id="pd-personel"
                value={secilenPersonel}
                onSelect={(p) => { setSecilenPersonel(p); setForm({ ...form, personnelId: p.id }) }}
              />
            </div>
            <div>
              <Label htmlFor="pd-durum">Durum *</Label>
              <select
                id="pd-durum"
                value={form.durum}
                onChange={(e) => setForm({ ...form, durum: e.target.value as ServisKullanimDurumu })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="SERVIS_KULLANIYOR">Servis Kullanıyor</option>
                <option value="KENDI_GELIYOR">Kendi Geliyor</option>
                <option value="KULLANMIYOR">Kullanmıyor</option>
                <option value="SIRKET_ARACI">Şirket Aracı Kullanıyor</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pd-baslangic">Başlangıç *</Label>
                <Input id="pd-baslangic" type="date" value={form.baslangicTarihi} onChange={(e) => setForm({ ...form, baslangicTarihi: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="pd-bitis">Bitiş</Label>
                <Input id="pd-bitis" type="date" value={form.bitisTarihi} onChange={(e) => setForm({ ...form, bitisTarihi: e.target.value })} />
              </div>
            </div>
            <div>
              <Label htmlFor="pd-neden">Neden</Label>
              <Input id="pd-neden" value={form.neden} onChange={(e) => setForm({ ...form, neden: e.target.value })} />
            </div>
          </div>
          <DialogFooter><Button onClick={kaydet} disabled={!form.personnelId}>Kaydet</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!kapatilan} onOpenChange={(o) => !o && setKapatilan(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Kaydı Kapat</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Bu kaydı kapatmak geçmişi silmez — yalnızca bitiş tarihini kaydedip pasife alır.
            </p>
            <div>
              <Label htmlFor="pd-kapatma-tarihi">Kapatma (Bitiş) Tarihi *</Label>
              <Input id="pd-kapatma-tarihi" type="date" value={kapatmaTarihi} onChange={(e) => setKapatmaTarihi(e.target.value)} />
            </div>
          </div>
          <DialogFooter><Button variant="destructive" onClick={kapat}>Kapat</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!duzenlenen} onOpenChange={(o) => !o && setDuzenlenen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Kaydı Düzenle</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Yalnız "Neden" alanı düzenlenebilir — durum/tarih/personel değişikliği yeni bir kayıt gerektirir.
            </p>
            <div>
              <Label htmlFor="pd-duzenle-neden">Neden</Label>
              <Input id="pd-duzenle-neden" value={duzenlemeNeden} onChange={(e) => setDuzenlemeNeden(e.target.value)} />
            </div>
          </div>
          <DialogFooter><Button onClick={duzenlemeKaydet}>Kaydet</Button></DialogFooter>
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
  const canPersonelDurumCreate = permissions.includes('servis.create')
  const canPersonelDurumEdit = permissions.includes('servis.edit')
  const canPassive = permissions.includes('servis.passive')
  const canRestore = permissions.includes('servis.restore')
  const canHistory = permissions.includes('servis.history')

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
          FAZ 1/A — servis tanım verileri.
        </p>
      </div>
      <Tabs defaultValue="firma">
        <TabsList>
          <TabsTrigger value="firma">Firmalar</TabsTrigger>
          <TabsTrigger value="yerleske">Yerleşkeler</TabsTrigger>
          <TabsTrigger value="guzergah">Güzergâhlar</TabsTrigger>
          <TabsTrigger value="durak">Duraklar</TabsTrigger>
          <TabsTrigger value="arac">Araçlar</TabsTrigger>
          <TabsTrigger value="sofor">Şoförler</TabsTrigger>
          <TabsTrigger value="sefer-dilimi">Sefer Dilimleri</TabsTrigger>
          <TabsTrigger value="personel-durum">Personel Durumları</TabsTrigger>
        </TabsList>
        <TabsContent value="firma">
          <ServisFirmaPanel canManage={canManage} canHistory={canHistory} />
        </TabsContent>
        <TabsContent value="yerleske">
          <ServisYerleskePanel canManage={canManage} canHistory={canHistory} />
        </TabsContent>
        <TabsContent value="guzergah">
          <ServisGuzergahPanel canManage={canManage} canHistory={canHistory} />
        </TabsContent>
        <TabsContent value="durak">
          <ServisDurakPanel canManage={canManage} canHistory={canHistory} />
        </TabsContent>
        <TabsContent value="arac">
          <ServisAracPanel canManage={canManage} canHistory={canHistory} />
        </TabsContent>
        <TabsContent value="sofor">
          <ServisSoforPanel canManage={canManage} canHistory={canHistory} />
        </TabsContent>
        <TabsContent value="sefer-dilimi">
          <ServisSeferDilimiPanel canManage={canManage} canHistory={canHistory} />
        </TabsContent>
        <TabsContent value="personel-durum">
          <ServisPersonelDurumPanel
            canCreate={canPersonelDurumCreate}
            canEdit={canPersonelDurumEdit}
            canPassive={canPassive}
            canRestore={canRestore}
            canHistory={canHistory}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
