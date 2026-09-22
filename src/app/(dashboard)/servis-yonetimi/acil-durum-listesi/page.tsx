'use client'

// MASTER Madde 49 — Acil Durum Servis Listesi ekranı.
//
// TASARIM KARARI (acil durum senaryosu): önce KİME ULAŞILACAK (araç/şoför →
// güzergâh sorumlusu → firma), sonra KİM ETKİLENDİ (yolcular), en sonda
// güzergâh detayı (duraklar). Uzun yolcu listesi kısa iletişim bloklarını
// aşağı itmesin; yolcu SAYISI en üstte, başlıkta görünür (kaç kişi olması
// gerektiği ilk bakışta okunsun, listeye kaydırmaya gerek kalmasın).
//
// 🔴 TÜM TELEFONLAR tel: bağlantısı — acil anda tek dokunuşla aranabilmeli.
// 🔴 EKSİK GÖRÜNÜR: blok durumu ATANMAMIS ise uyarı rengiyle "— ATANMAMIŞ —",
// SEFER_TANIMLI_DEGIL ise ayrı mesaj. Sessiz boş satır YOK.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Label } from '@/components/ui/label'
import { buttonVariants } from '@/components/ui/button'
import { AlertTriangle, FileText, Loader2, Phone } from 'lucide-react'

type BlokDurumu = 'VERI_VAR' | 'ATANMAMIS' | 'SEFER_TANIMLI_DEGIL'
type Blok<T> = { durum: BlokDurumu; kayitlar: T[] }
type RolluBlok<T> = { ana: Blok<T>; yedek: Blok<T> }

type Arac = { aracId: string; plaka: string; kapasite: number; firmaAd: string }
type Sofor = { soforId: string; adSoyad: string; telefon: string | null; dahiliMi: boolean }
type Sorumlu = { personnelId: string; sicilNo: string | null; adSoyad: string; telefon: string | null }
type Firma = { firmaId: string; ad: string; yetkiliAdi: string | null; telefon: string | null; eposta: string | null }
type Yolcu = {
  personnelId: string
  sicilNo: string | null
  adSoyad: string
  durakKod: string | null
  durakAd: string | null
  telefon: string | null
}
type Durak = {
  sira: number
  durakId: string
  durakKod: string
  durakAd: string
  il: string | null
  ilce: string | null
  saat: string | null
}

type Sonuc = {
  tarih: string
  guzergah: { id: string; kod: string; ad: string; yerleskeKod: string; yerleskeAd: string }
  dilim: { id: string; kod: string; ad: string; yon: string }
  seferTanimli: boolean
  duraklar: Blok<Durak>
  arac: RolluBlok<Arac>
  sofor: RolluBlok<Sofor>
  sorumlu: RolluBlok<Sorumlu>
  firmalar: Blok<Firma>
  yolcular: Blok<Yolcu>
}

type Secenek = { id: string; kod?: string | null; ad: string }

function etiket(s: Secenek): string {
  return s.kod ? `${s.kod} — ${s.ad}` : s.ad
}

/** Acil anda tek dokunuşla arama — telefonun olduğu HER yerde bu kullanılır. */
function Telefon({ numara }: { numara: string | null }) {
  if (!numara) return <span className="text-amber-700">telefon yok</span>
  return (
    <a href={`tel:${numara.replace(/\s/g, '')}`} className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline">
      <Phone className="h-3.5 w-3.5" />
      {numara}
    </a>
  )
}

function EksikUyarisi({ durum }: { durum: BlokDurumu }) {
  if (durum === 'SEFER_TANIMLI_DEGIL') {
    return <p className="text-sm text-muted-foreground">Bu dilimde sefer tanımlı değil.</p>
  }
  return (
    <p className="flex items-center gap-2 text-sm font-semibold text-red-700">
      <AlertTriangle className="h-4 w-4" /> — ATANMAMIŞ —
    </p>
  )
}

function Bolum({ baslik, children }: { baslik: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{baslik}</h2>
      {children}
    </section>
  )
}

function RolluGosterim<T>({ blok, render }: { blok: RolluBlok<T>; render: (k: T) => React.ReactNode }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {(['ana', 'yedek'] as const).map(rol => {
        const b = blok[rol]
        return (
          <div key={rol} className="rounded border bg-muted/20 p-3">
            <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">{rol === 'ana' ? 'ANA' : 'YEDEK'}</p>
            {b.kayitlar.length === 0 ? (
              <EksikUyarisi durum={b.durum} />
            ) : (
              <div className="space-y-2">{b.kayitlar.map((k, i) => <div key={i}>{render(k)}</div>)}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function AcilDurumListesiPage() {
  const { data: session } = useSession()
  const permissions = session?.user?.permissions || []
  // 🔴 İKİ anahtar birden — API ile aynı kural (servis.view tek başına YETMEZ).
  const canView = permissions.includes('servis.view') && permissions.includes('servis.kvkk.view')

  const [guzergahId, setGuzergahId] = useState('')
  const [dilimId, setDilimId] = useState('')
  const [guzergahlar, setGuzergahlar] = useState<Secenek[]>([])
  const [dilimler, setDilimler] = useState<Secenek[]>([])

  const [sonuc, setSonuc] = useState<Sonuc | null>(null)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)

  const sorguDizesi = useMemo(
    () => new URLSearchParams({ guzergahId, dilimId }).toString(),
    [guzergahId, dilimId],
  )

  useEffect(() => {
    if (!canView) return
    let iptal = false
    ;(async () => {
      for (const [url, kur] of [
        ['/api/servis-yonetimi/guzergah?durum=aktif', setGuzergahlar],
        ['/api/servis-yonetimi/sefer-dilimi?durum=aktif', setDilimler],
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
    if (!guzergahId || !dilimId) return
    setYukleniyor(true)
    setHata(null)
    try {
      const res = await fetch(`/api/servis-yonetimi/acil-durum-listesi?${sorguDizesi}`)
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setHata(json.message || 'Acil durum listesi alınamadı.')
        setSonuc(null)
        return
      }
      setSonuc(json.data)
    } catch {
      setHata('Acil durum listesi alınırken beklenmeyen bir hata oluştu.')
      setSonuc(null)
    } finally {
      setYukleniyor(false)
    }
  }, [guzergahId, dilimId, sorguDizesi])

  useEffect(() => {
    if (!canView) return
    yukle()
  }, [canView, yukle])

  if (!canView) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Bu sayfayı görüntüleme yetkiniz yok.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Acil Durum Servis Listesi</h1>
          <p className="text-sm text-muted-foreground">
            Seçilen güzergâh ve sefer diliminin BUGÜNKÜ durumu. Telefonlara dokunarak arayabilirsiniz.
          </p>
        </div>
        {sonuc && (
          <a
            href={`/api/servis-yonetimi/acil-durum-listesi/export-pdf?${sorguDizesi}`}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <FileText className="mr-2 h-4 w-4" /> PDF
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="secim-guzergah">Güzergâh</Label>
          <select
            id="secim-guzergah"
            value={guzergahId}
            onChange={e => setGuzergahId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Seçiniz</option>
            {guzergahlar.map(g => (
              <option key={g.id} value={g.id}>{etiket(g)}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="secim-dilim">Sefer Dilimi</Label>
          <select
            id="secim-dilim"
            value={dilimId}
            onChange={e => setDilimId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Seçiniz</option>
            {dilimler.map(d => (
              <option key={d.id} value={d.id}>{etiket(d)}</option>
            ))}
          </select>
        </div>
      </div>

      {hata && <p className="text-sm text-red-600">{hata}</p>}

      {!guzergahId || !dilimId ? (
        <p className="text-sm text-muted-foreground">Güzergâh ve sefer dilimi seçin.</p>
      ) : yukleniyor ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : sonuc ? (
        <div className="space-y-4">
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="font-semibold">
              {sonuc.guzergah.kod} — {sonuc.guzergah.ad} · {sonuc.dilim.ad}
            </p>
            <p className="text-sm text-muted-foreground">
              Yerleşke: {sonuc.guzergah.yerleskeKod} — {sonuc.guzergah.yerleskeAd} · Beklenen yolcu:{' '}
              <span className="font-semibold text-foreground">{sonuc.yolcular.kayitlar.length}</span>
            </p>
            {!sonuc.seferTanimli && (
              <p className="mt-2 text-sm text-amber-700">
                Bu güzergâh seçilen dilimde sefer yapmıyor görünüyor (tanımlı saat yok).
              </p>
            )}
          </div>

          <Bolum baslik="1 · Araç">
            <RolluGosterim
              blok={sonuc.arac}
              render={a => (
                <p className="text-sm">
                  <span className="font-mono font-semibold">{a.plaka}</span> · {a.kapasite} kişilik · {a.firmaAd}
                </p>
              )}
            />
          </Bolum>

          <Bolum baslik="1 · Şoför">
            <RolluGosterim
              blok={sonuc.sofor}
              render={s => (
                <p className="text-sm">
                  <span className="font-medium">{s.adSoyad}</span>{' '}
                  <span className="text-muted-foreground">({s.dahiliMi ? 'dahili' : 'dış firma'})</span>
                  {' · '}
                  <Telefon numara={s.telefon} />
                </p>
              )}
            />
          </Bolum>

          <Bolum baslik="2 · Güzergâh Sorumlusu">
            <RolluGosterim
              blok={sonuc.sorumlu}
              render={s => (
                <p className="text-sm">
                  <span className="font-medium">{s.adSoyad}</span>
                  {s.sicilNo ? <span className="text-muted-foreground"> ({s.sicilNo})</span> : null}
                  {' · '}
                  <Telefon numara={s.telefon} />
                </p>
              )}
            />
          </Bolum>

          <Bolum baslik="3 · Taşeron Firma İletişimi">
            {sonuc.firmalar.kayitlar.length === 0 ? (
              <EksikUyarisi durum={sonuc.firmalar.durum} />
            ) : (
              <div className="space-y-2">
                {sonuc.firmalar.kayitlar.map(f => (
                  <p key={f.firmaId} className="text-sm">
                    <span className="font-medium">{f.ad}</span>
                    {f.yetkiliAdi ? <span className="text-muted-foreground"> · {f.yetkiliAdi}</span> : null}
                    {' · '}
                    <Telefon numara={f.telefon} />
                    {f.eposta ? <span className="text-muted-foreground"> · {f.eposta}</span> : null}
                  </p>
                ))}
              </div>
            )}
          </Bolum>

          <Bolum baslik={`4 · Beklenen Yolcular (${sonuc.yolcular.kayitlar.length})`}>
            {sonuc.yolcular.kayitlar.length === 0 ? (
              <EksikUyarisi durum={sonuc.yolcular.durum} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sicil</TableHead>
                    <TableHead>Ad Soyad</TableHead>
                    <TableHead>Durak</TableHead>
                    <TableHead>Telefon</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sonuc.yolcular.kayitlar.map(y => (
                    <TableRow key={y.personnelId}>
                      <TableCell className="font-mono">{y.sicilNo || '-'}</TableCell>
                      <TableCell>{y.adSoyad}</TableCell>
                      <TableCell>{y.durakKod ? `${y.durakKod} — ${y.durakAd}` : '-'}</TableCell>
                      <TableCell><Telefon numara={y.telefon} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Bolum>

          <Bolum baslik="5 · Duraklar">
            {sonuc.duraklar.kayitlar.length === 0 ? (
              <EksikUyarisi durum={sonuc.duraklar.durum} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sıra</TableHead>
                    <TableHead>Durak</TableHead>
                    <TableHead>Konum</TableHead>
                    <TableHead>Saat</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sonuc.duraklar.kayitlar.map(d => (
                    <TableRow key={d.durakId}>
                      <TableCell>{d.sira}</TableCell>
                      <TableCell>{d.durakKod} — {d.durakAd}</TableCell>
                      <TableCell>{[d.il, d.ilce].filter(Boolean).join(' / ') || '-'}</TableCell>
                      <TableCell>{d.saat || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Bolum>

          <p className="text-sm text-muted-foreground">
            Eksik atama gördüyseniz{' '}
            <Link href="/servis-yonetimi/veri-kalite" className="text-blue-700 hover:underline">
              Veri Kalite Merkezi
            </Link>{' '}
            üzerinden düzeltilmesi gereken kaydı bulabilirsiniz.
          </p>
        </div>
      ) : null}
    </div>
  )
}
