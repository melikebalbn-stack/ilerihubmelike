'use client'

// MASTER Madde 29 — Operasyonel Servis Listeleri (ayda bir servis
// firmalarına verilen güncel personel listesi).
//
// MASTER'da sayılan "vardiya" ve "şirket" filtreleri BİLEREK render
// EDİLMİYOR: ikisinin de şemada veri kaynağı yok (vardiya üç ayrı
// araştırmada doğrulandı — Personnel'de vardiya alanı yok; şirket için
// Personnel'de/DepartmentDefinition'da karşılık yok, Elif'e soruldu).
// Sessiz daraltma değil, kayıtlı karar — kaynak oluşunca eklenecek.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertTriangle, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'

type Satir = {
  personnelId: string
  sicilNo: string | null
  adSoyad: string
  bolum: string | null
  guzergahKod: string
  guzergahAd: string
  durakKod: string | null
  durakAd: string | null
  sabahSaati: string | null
  telefon: string | null
}

type Secenek = { id: string; kod?: string | null; ad: string }

const SECIM_UCLARI = [
  { anahtar: 'guzergah', url: '/api/servis-yonetimi/guzergah?durum=aktif' },
  { anahtar: 'firma', url: '/api/servis-yonetimi/firma?durum=aktif' },
  { anahtar: 'durak', url: '/api/servis-yonetimi/durak?durum=aktif' },
  { anahtar: 'yerleske', url: '/api/servis-yonetimi/yerleske?durum=aktif' },
] as const

function bugunIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function tarihTR(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('tr-TR', { timeZone: 'UTC' })
}

function etiket(s: Secenek): string {
  return s.kod ? `${s.kod} — ${s.ad}` : s.ad
}

export default function OperasyonelServisListesiPage() {
  const { data: session } = useSession()
  const permissions = session?.user?.permissions || []
  const canView = permissions.includes('servis.view')
  // İndirme görüntülemeden ayrı yetki: idari-isler listeyi görür ama
  // dosya indiremez (yetki matrisi). Butonlar bu yüzden koşullu.
  const canExport = permissions.includes('servis.export')

  const [tarih, setTarih] = useState(bugunIso)
  const [guzergahId, setGuzergahId] = useState('')
  const [firmaId, setFirmaId] = useState('')
  const [durakId, setDurakId] = useState('')
  const [bolum, setBolum] = useState('')
  const [yerleskeId, setYerleskeId] = useState('')

  const [satirlar, setSatirlar] = useState<Satir[]>([])
  const [gecmisTarihSecildi, setGecmisTarihSecildi] = useState(false)
  const [sonucTarihi, setSonucTarihi] = useState(bugunIso)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)

  const [guzergahlar, setGuzergahlar] = useState<Secenek[]>([])
  const [firmalar, setFirmalar] = useState<Secenek[]>([])
  const [duraklar, setDuraklar] = useState<Secenek[]>([])
  const [yerleskeler, setYerleskeler] = useState<Secenek[]>([])

  // Liste ve iki export bağlantısı AYNI sorgu dizesini kullanır — ekranda
  // görülen ile indirilen dosya sapamaz.
  const sorguDizesi = useMemo(() => {
    const p = new URLSearchParams()
    if (tarih) p.set('tarih', tarih)
    if (guzergahId) p.set('guzergahId', guzergahId)
    if (firmaId) p.set('firmaId', firmaId)
    if (durakId) p.set('durakId', durakId)
    if (bolum.trim()) p.set('bolum', bolum.trim())
    if (yerleskeId) p.set('yerleskeId', yerleskeId)
    return p.toString()
  }, [tarih, guzergahId, firmaId, durakId, bolum, yerleskeId])

  const yukle = useCallback(async () => {
    setYukleniyor(true)
    setHata(null)
    try {
      const res = await fetch(`/api/servis-yonetimi/operasyonel-servis-listesi?${sorguDizesi}`)
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setHata(json.message || 'Liste alınamadı.')
        return
      }
      setSatirlar(json.data.satirlar)
      setGecmisTarihSecildi(json.data.gecmisTarihSecildi)
      setSonucTarihi(json.data.tarih)
    } catch {
      setHata('Liste alınırken beklenmeyen bir hata oluştu.')
    } finally {
      setYukleniyor(false)
    }
  }, [sorguDizesi])

  useEffect(() => {
    if (!canView) return
    yukle()
  }, [canView, yukle])

  useEffect(() => {
    if (!canView) return
    let iptal = false
    ;(async () => {
      const kurucular: Record<string, (v: Secenek[]) => void> = {
        guzergah: setGuzergahlar,
        firma: setFirmalar,
        durak: setDuraklar,
        yerleske: setYerleskeler,
      }
      for (const { anahtar, url } of SECIM_UCLARI) {
        try {
          const res = await fetch(url)
          const json = await res.json()
          if (!iptal && res.ok && json.ok) kurucular[anahtar](json.data ?? [])
        } catch {
          // Seçenek listesi alınamazsa filtre boş kalır; liste yine çalışır.
        }
      }
    })()
    return () => {
      iptal = true
    }
  }, [canView])

  if (!canView) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Bu sayfayı görüntüleme yetkiniz yok.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Operasyonel Servis Listesi</h1>
          <p className="text-sm text-muted-foreground">
            Servis firmalarına verilen güncel personel listesi. Filtreler hem ekrana hem indirilen dosyaya uygulanır.
          </p>
        </div>
        {/* İndirme bağlantıları düz <a> — bu repodaki Button `asChild`'ı
            tipte var ama UYGULANMAMIŞ (Slot yok, prop DOM'a sızıyor);
            buttonVariants ile stil verip geçerli markup üretiyoruz. */}
        {canExport && (
          <div className="flex gap-2">
            <a
              href={`/api/servis-yonetimi/operasyonel-servis-listesi/export?${sorguDizesi}`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
            </a>
            <a
              href={`/api/servis-yonetimi/operasyonel-servis-listesi/export-pdf?${sorguDizesi}`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <FileText className="mr-2 h-4 w-4" /> PDF
            </a>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <Label htmlFor="filtre-tarih">Tarih</Label>
          <Input id="filtre-tarih" type="date" value={tarih} onChange={e => setTarih(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="filtre-guzergah">Servis / Güzergâh</Label>
          <select
            id="filtre-guzergah"
            value={guzergahId}
            onChange={e => setGuzergahId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Tümü</option>
            {guzergahlar.map(g => (
              <option key={g.id} value={g.id}>{etiket(g)}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="filtre-firma">Firma</Label>
          <select
            id="filtre-firma"
            value={firmaId}
            onChange={e => setFirmaId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Tümü</option>
            {firmalar.map(f => (
              <option key={f.id} value={f.id}>{etiket(f)}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="filtre-durak">Durak</Label>
          <select
            id="filtre-durak"
            value={durakId}
            onChange={e => setDurakId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Tümü</option>
            {duraklar.map(d => (
              <option key={d.id} value={d.id}>{etiket(d)}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="filtre-yerleske">Lokasyon (Yerleşke)</Label>
          <select
            id="filtre-yerleske"
            value={yerleskeId}
            onChange={e => setYerleskeId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Tümü</option>
            {yerleskeler.map(y => (
              <option key={y.id} value={y.id}>{etiket(y)}</option>
            ))}
          </select>
        </div>
        <div>
          {/* Personnel.bolum serbest metin — ayrı bir bölüm master'ına
              bağlanmıyor (yeni bağımlılık/yetki eklememek için). */}
          <Label htmlFor="filtre-bolum">Bölüm</Label>
          <Input
            id="filtre-bolum"
            value={bolum}
            onChange={e => setBolum(e.target.value)}
            placeholder="Bölüm adı (tam eşleşme)"
          />
        </div>
      </div>

      {gecmisTarihSecildi && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <p className="text-sm text-amber-800">
            Personel listesi {tarihTR(sonucTarihi)} itibarıyla; saat ve durak bilgileri güncel tanımlara göredir.
          </p>
        </div>
      )}

      {hata && <p className="text-sm text-red-600">{hata}</p>}

      {yukleniyor ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sicil</TableHead>
              <TableHead>Ad Soyad</TableHead>
              <TableHead>Bölüm</TableHead>
              <TableHead>Servis</TableHead>
              <TableHead>Durak</TableHead>
              <TableHead>Sabah Saati</TableHead>
              <TableHead>Telefon</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {satirlar.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Seçilen filtrelerle servis kullanan personel bulunamadı.
                </TableCell>
              </TableRow>
            )}
            {satirlar.map(s => (
              <TableRow key={s.personnelId}>
                <TableCell className="font-mono">{s.sicilNo || '-'}</TableCell>
                <TableCell>{s.adSoyad}</TableCell>
                <TableCell>{s.bolum || '-'}</TableCell>
                <TableCell>{s.guzergahKod} — {s.guzergahAd}</TableCell>
                <TableCell>{s.durakKod ? `${s.durakKod} — ${s.durakAd}` : '-'}</TableCell>
                <TableCell>{s.sabahSaati || '-'}</TableCell>
                <TableCell>{s.telefon || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
