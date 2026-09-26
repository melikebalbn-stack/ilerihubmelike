'use client'

// MASTER Madde 46 — Şikâyet listesi (Adım 5A).
//
// SALT LİSTE: oluşturma butonu ve durum geçişi aksiyonları BU ADIMDA YOK
// (Adım 5B). Ekranda ikinci bir filtreleme YAPILMAZ — filtreler uca
// gönderilir, sorgu katmanı süzer (rule 6).
//
// 🔴 Durum RENKLE DEĞİL ETİKETLE ayrılır; renk yalnız destektir. Renk körü
// bir kullanıcı ya da gri basılmış bir çıktı da durumu okuyabilmeli.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2 } from 'lucide-react'

type Durum = 'ACIK' | 'AKSIYON_ALINDI' | 'KAPANDI' | 'REDDEDILDI'

type SikayetSatiri = {
  id: string
  no: number
  tarih: string
  bildirimTarihi: string
  kategori: string
  durum: Durum
  kaynak: string
  guzergahId: string
  durakId: string | null
  durak: { id: string; kod: string; ad: string } | null
  sikayetciPersonnelId?: string | null
  sikayetci?: { id: string; sicilNo: string | null; adSoyad: string; bolum: string | null } | null
  sorumlu?: { id: string; sicilNo: string | null; adSoyad: string; bolum: string | null } | null
}

type Secenek = { id: string; kod?: string | null; ad: string }

/** Durum etiketleri — okunabilir Türkçe. Renk YALNIZ destek. */
const DURUM_ETIKET: Record<Durum, string> = {
  ACIK: 'Açık',
  AKSIYON_ALINDI: 'Aksiyon alındı',
  KAPANDI: 'Kapandı',
  REDDEDILDI: 'Reddedildi',
}

const DURUM_RENK: Record<Durum, string> = {
  ACIK: 'bg-amber-100 text-amber-900',
  AKSIYON_ALINDI: 'bg-blue-100 text-blue-900',
  KAPANDI: 'bg-green-100 text-green-900',
  REDDEDILDI: 'bg-slate-200 text-slate-800',
}

const KATEGORI_ETIKET: Record<string, string> = {
  GEC_GELME: 'Geç gelme',
  DURAGA_UGRAMAMA: 'Durağa uğramama',
  SURUCU_DAVRANISI: 'Sürücü davranışı',
  TEHLIKELI_KULLANIM: 'Tehlikeli kullanım',
  HIZ_IHLALI: 'Hız ihlali',
  TEMIZLIK: 'Temizlik',
  KLIMA_ISITMA: 'Klima / ısıtma',
  EMNIYET_KEMERI: 'Emniyet kemeri',
  ARAC_ARIZASI: 'Araç arızası',
  FAZLA_YOLCU: 'Fazla yolcu',
  YANLIS_GUZERGAH: 'Yanlış güzergâh',
  SAAT_UYUMSUZLUGU: 'Saat uyumsuzluğu',
  DIGER: 'Diğer',
}

const KAYNAK_ETIKET: Record<string, string> = { IV: 'İV', PERSONEL: 'Çalışan' }

function gunMetni(deger: string | null | undefined): string {
  if (!deger) return '-'
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(deger)
  return m ? m[1] : deger
}

function etiket(s: Secenek): string {
  return s.kod ? `${s.kod} — ${s.ad}` : s.ad
}

export default function SikayetListesiPage() {
  const { data: session } = useSession()
  const permissions = session?.user?.permissions || []
  const canView = permissions.includes('servis.sikayet.view')

  const [guzergahId, setGuzergahId] = useState('')
  const [durakId, setDurakId] = useState('')
  const [durum, setDurum] = useState('')
  const [kategori, setKategori] = useState('')
  const [kaynak, setKaynak] = useState('')
  const [bildirimBaslangic, setBildirimBaslangic] = useState('')
  const [bildirimBitis, setBildirimBitis] = useState('')

  const [guzergahlar, setGuzergahlar] = useState<Secenek[]>([])
  const [duraklar, setDuraklar] = useState<Secenek[]>([])

  const [satirlar, setSatirlar] = useState<SikayetSatiri[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)

  const sorguDizesi = useMemo(() => {
    const p = new URLSearchParams()
    if (guzergahId) p.set('guzergahId', guzergahId)
    if (durakId) p.set('durakId', durakId)
    if (durum) p.set('durum', durum)
    if (kategori) p.set('kategori', kategori)
    if (kaynak) p.set('kaynak', kaynak)
    if (bildirimBaslangic) p.set('bildirimBaslangic', bildirimBaslangic)
    if (bildirimBitis) p.set('bildirimBitis', bildirimBitis)
    return p.toString()
  }, [guzergahId, durakId, durum, kategori, kaynak, bildirimBaslangic, bildirimBitis])

  useEffect(() => {
    if (!canView) return
    let iptal = false
    ;(async () => {
      for (const [url, kur] of [
        ['/api/servis-yonetimi/guzergah?durum=aktif', setGuzergahlar],
        ['/api/servis-yonetimi/durak?durum=aktif', setDuraklar],
      ] as const) {
        try {
          const res = await fetch(url)
          const json = await res.json()
          if (!iptal && res.ok && json.ok) kur(json.data ?? [])
        } catch {
          // Seçenek listesi alınamazsa seçici boş kalır; ekran çökmez.
        }
      }
    })()
    return () => {
      iptal = true
    }
  }, [canView])

  const yukle = useCallback(async () => {
    setYukleniyor(true)
    setHata(null)
    try {
      const res = await fetch(`/api/servis-yonetimi/sikayet${sorguDizesi ? `?${sorguDizesi}` : ''}`)
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setHata(json.message || 'Şikâyet listesi alınamadı.')
        setSatirlar([])
        return
      }
      setSatirlar(json.data ?? [])
    } catch {
      setHata('Şikâyet listesi alınırken beklenmeyen bir hata oluştu.')
      setSatirlar([])
    } finally {
      setYukleniyor(false)
    }
  }, [sorguDizesi])

  useEffect(() => {
    if (!canView) return
    yukle()
  }, [canView, yukle])

  // 🔴 "Yetki yok" hâli, "kayıt yok" hâlinden AYRI ve ilk sırada.
  if (!canView) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Servis Şikâyetleri</h1>
        <p className="mt-2 text-sm text-muted-foreground">Bu sayfayı görüntüleme yetkiniz yok.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Servis Şikâyetleri</h1>
        <p className="text-sm text-muted-foreground">
          Servis kullanımına dair şikâyet ve uygunsuzluk kayıtları.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Filtreler</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="filtre-guzergah">Güzergâh</Label>
            <select
              id="filtre-guzergah" value={guzergahId} onChange={e => setGuzergahId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Tümü</option>
              {guzergahlar.map(g => <option key={g.id} value={g.id}>{etiket(g)}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="filtre-durak">Durak</Label>
            <select
              id="filtre-durak" value={durakId} onChange={e => setDurakId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Tümü</option>
              {duraklar.map(d => <option key={d.id} value={d.id}>{etiket(d)}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="filtre-durum">Durum</Label>
            <select
              id="filtre-durum" value={durum} onChange={e => setDurum(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Tümü</option>
              {(Object.keys(DURUM_ETIKET) as Durum[]).map(d => (
                <option key={d} value={d}>{DURUM_ETIKET[d]}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="filtre-kategori">Kategori</Label>
            <select
              id="filtre-kategori" value={kategori} onChange={e => setKategori(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Tümü</option>
              {Object.entries(KATEGORI_ETIKET).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="filtre-kaynak">Kaynak</Label>
            <select
              id="filtre-kaynak" value={kaynak} onChange={e => setKaynak(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Tümü</option>
              {Object.entries(KAYNAK_ETIKET).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="filtre-baslangic">Bildirim başlangıç</Label>
            <input
              id="filtre-baslangic" type="date" value={bildirimBaslangic}
              onChange={e => setBildirimBaslangic(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <Label htmlFor="filtre-bitis">Bildirim bitiş</Label>
            <input
              id="filtre-bitis" type="date" value={bildirimBitis}
              onChange={e => setBildirimBitis(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {yukleniyor ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : hata ? (
        // 🔴 Hata hâli — "kayıt yok" ile karıştırılmasın.
        <p className="text-sm text-red-600">{hata}</p>
      ) : satirlar.length === 0 ? (
        // 🔴 Boş liste hâli — yetki yok ve hata hâllerinden AYRI metin.
        <p className="text-sm text-muted-foreground">
          Bu filtrelerle eşleşen şikâyet kaydı yok.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No</TableHead>
              <TableHead>Olay tarihi</TableHead>
              <TableHead>Bildirim tarihi</TableHead>
              <TableHead>Güzergâh</TableHead>
              <TableHead>Durak</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead>Şikâyetçi</TableHead>
              <TableHead>Sorumlu</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {satirlar.map(s => (
              <TableRow key={s.id}>
                <TableCell className="font-mono">{s.no}</TableCell>
                <TableCell>{gunMetni(s.tarih)}</TableCell>
                <TableCell>{gunMetni(s.bildirimTarihi)}</TableCell>
                <TableCell>{s.guzergahId}</TableCell>
                <TableCell>{s.durak ? `${s.durak.kod} — ${s.durak.ad}` : '-'}</TableCell>
                <TableCell>{KATEGORI_ETIKET[s.kategori] ?? s.kategori}</TableCell>
                <TableCell>
                  {/* Etiket metni tek başına yeterli; renk yalnız destek. */}
                  <Badge className={DURUM_RENK[s.durum]} variant="secondary">
                    {DURUM_ETIKET[s.durum] ?? s.durum}
                  </Badge>
                </TableCell>
                <TableCell>{s.sikayetci?.adSoyad ?? '-'}</TableCell>
                <TableCell>{s.sorumlu?.adSoyad ?? '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
