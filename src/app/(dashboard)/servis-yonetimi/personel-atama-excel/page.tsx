'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { CheckCircle2, FileSpreadsheet, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { ExcelOnizleme, ExcelUygulamaSonucu, SatirTuru } from '@/lib/servis-yonetimi/excel-atama'
import { EXCEL_DOSYA_SINIRI_MESAJI, EXCEL_LIMITLERI, EXCEL_MAKS_MB } from '@/lib/servis-yonetimi/excel-atama-limitleri'
import type { KapasiteEtkisiSatiri } from '@/lib/servis-yonetimi/kapasite-asim'
import { cn } from '@/lib/utils'
import { AsimUyarisi, etkiMetni } from '../guzergah/[id]/AtamaDilimDialoglari'
import { apiHataMesaji } from '../_lib/servis-istek'
import { bugunTR } from '@/lib/servis-yonetimi/tarih-kurallari'

// EXCEL'DEN TOPLU ATAMA (C2) — 1 Dosya yükle → 2 Önizleme → 3 Uygula.
// Önizleme hiçbir kayıt yazmaz. Uygulamada dosya sunucuda YENİDEN doğrulanır; hatalı satırlar atlanır,
// geçerli satırlar tek seferde uygulanır. Sayılar/doğrulama sunucudadır; burada yalnız akış ve gösterim.

const BASE = '/api/servis-yonetimi/personel-atama-excel'

type Onizleme = Omit<ExcelOnizleme, 'satirlar'> & {
  satirlar: { satirNo: number; sicil: string; adSoyad: string | null; guzergahKod: string; durakKod: string; dilimKodlari: string[]; baslangic: string; tur: SatirTuru; hata: string | null; uyari?: string | null }[]
}

const TUR_ETIKETI: Record<SatirTuru, string> = {
  YENI: 'Yeni atama',
  DEGISIKLIK: 'Güzergâh/durak değişikliği',
  DILIM_EKLE: 'Dilim ekleme',
  YALNIZ_DILIM: 'Yalnız dilim ekleme',
  DEGISIKLIK_YOK: 'Değişiklik yok',
  HATA: 'Hatalı',
}

function TurRozeti({ tur }: { tur: SatirTuru }) {
  if (tur === 'HATA') return <Badge variant="destructive">{TUR_ETIKETI[tur]}</Badge>
  if (tur === 'DEGISIKLIK_YOK') return <Badge variant="outline">{TUR_ETIKETI[tur]}</Badge>
  if (tur === 'DEGISIKLIK') return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">{TUR_ETIKETI[tur]}</Badge>
  return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">{TUR_ETIKETI[tur]}</Badge>
}

function Ozet({ baslik, deger, vurgu }: { baslik: string; deger: number; vurgu?: 'kirmizi' | 'amber' }) {
  return (
    <Card className={vurgu === 'kirmizi' && deger > 0 ? 'border-red-300 bg-red-50 dark:bg-red-950/20' : vurgu === 'amber' && deger > 0 ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/20' : undefined}>
      <CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-muted-foreground">{baslik}</CardTitle></CardHeader>
      <CardContent><p className="text-2xl font-semibold tabular-nums" data-testid={`ozet-${baslik}`}>{deger}</p></CardContent>
    </Card>
  )
}

function Adimlar({ adim }: { adim: 1 | 2 | 3 }) {
  const liste = ['Dosya yükle', 'Önizleme', 'Uygula']
  return (
    <ol className="flex flex-wrap gap-2 text-sm" aria-label="Adımlar">
      {liste.map((a, i) => (
        <li key={a} className={cn('rounded-full border px-3 py-1', adim === i + 1 ? 'border-[#1B4F72] bg-[#1B4F72] text-white' : adim > i + 1 ? 'text-muted-foreground' : 'text-muted-foreground')} aria-current={adim === i + 1 ? 'step' : undefined}>
          {i + 1}. {a}
        </li>
      ))}
    </ol>
  )
}

export default function PersonelAtamaExcelPage() {
  const { data: session } = useSession()
  const permissions = session?.user?.permissions || []
  // API ile AYNI: servis.view VE servis.edit
  const yetkili = permissions.includes('servis.view') && permissions.includes('servis.edit')

  const [dosya, setDosya] = useState<File | null>(null)
  const [onizleme, setOnizleme] = useState<Onizleme | null>(null)
  const [sonuc, setSonuc] = useState<ExcelUygulamaSonucu | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [asimUyarisi, setAsimUyarisi] = useState<KapasiteEtkisiSatiri[] | null>(null)
  const [asimOnayi, setAsimOnayi] = useState(false)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [sadeceHatali, setSadeceHatali] = useState(false)
  const girdi = useRef<HTMLInputElement>(null)

  if (!yetkili) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Bu sayfayı görüntüleme yetkiniz yok.</p>
      </div>
    )
  }

  const adim: 1 | 2 | 3 = sonuc ? 3 : onizleme ? 2 : 1

  function dosyaSec(f: File | null) {
    setHata(null)
    setOnizleme(null)
    setSonuc(null)
    setAsimUyarisi(null)
    setAsimOnayi(false)
    if (!f) return setDosya(null)
    if (!/\.xlsx$/i.test(f.name)) {
      setDosya(null)
      return setHata('Yalnız .xlsx dosyası yüklenebilir. Şablonu indirip kullanın.')
    }
    if (f.size > EXCEL_LIMITLERI.maksDosyaBayt) {
      setDosya(null)
      return setHata(EXCEL_DOSYA_SINIRI_MESAJI)
    }
    setDosya(f)
  }

  const formOlustur = (ekstra: Record<string, string> = {}) => {
    const fd = new FormData()
    fd.append('dosya', dosya!)
    for (const [k, v] of Object.entries(ekstra)) fd.append(k, v)
    return fd
  }

  async function onizle() {
    if (!dosya) return
    setYukleniyor(true)
    setHata(null)
    setAsimUyarisi(null)
    setAsimOnayi(false)
    try {
      const res = await fetch(`${BASE}/onizleme`, { method: 'POST', body: formOlustur() })
      const json = await res.json()
      if (!res.ok || !json.ok) return setHata(apiHataMesaji(res.status, json, 'Önizleme alınamadı.'))
      setOnizleme(json.data)
    } catch {
      setHata('Sunucuya ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin.')
    } finally {
      setYukleniyor(false)
    }
  }

  const gecerliSayisi = onizleme ? onizleme.satirlar.filter((s) => s.tur !== 'HATA').length : 0
  const uygulanacakSayisi = onizleme ? onizleme.ozet.yeni + onizleme.ozet.degisiklik + onizleme.ozet.dilimEkle : 0
  const asimlar = onizleme?.etki.filter((e) => e.asim) ?? []

  async function uygula() {
    if (!onizleme) return
    setYukleniyor(true)
    setHata(null)
    try {
      const res = await fetch(`${BASE}/uygula`, {
        method: 'POST',
        body: formOlustur({
          asimOnayi: String(asimOnayi), beklenenGecerli: String(gecerliSayisi), beklenenHatali: String(onizleme.ozet.hatali),
        }),
      })
      const json = await res.json()
      if (res.status === 409 && json?.kod === 'ASIM_ONAYI_GEREKLI') {
        setAsimUyarisi(json.ayrinti?.etki ?? [])
        setAsimOnayi(false)
        return
      }
      if (!res.ok || !json.ok) return setHata(apiHataMesaji(res.status, json, 'Atamalar uygulanamadı.'))
      setSonuc(json.data)
    } catch {
      setHata('Sunucuya ulaşılamadı; hiçbir kayıt yazılmadı olabilir. Önizlemeyi yenileyip kontrol edin.')
    } finally {
      setYukleniyor(false)
    }
  }

  async function hataRaporuIndir() {
    if (!dosya) return
    setHata(null)
    try {
      const res = await fetch(`${BASE}/hata-raporu`, { method: 'POST', body: formOlustur() })
      if (!res.ok) return setHata(apiHataMesaji(res.status, await res.json().catch(() => null), 'Hata raporu alınamadı.'))
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Atama-Hata-Raporu-${bugunTR()}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setHata('Hata raporu indirilemedi.')
    }
  }

  function bastanBasla() {
    setDosya(null)
    setOnizleme(null)
    setSonuc(null)
    setHata(null)
    setAsimUyarisi(null)
    setAsimOnayi(false)
    if (girdi.current) girdi.current.value = ''
  }

  const gorunenSatirlar = onizleme ? (sadeceHatali ? onizleme.satirlar.filter((s) => s.tur === 'HATA') : onizleme.satirlar) : []
  const uygulanabilir = !!onizleme && uygulanacakSayisi > 0 && (asimlar.length === 0 || asimOnayi) && (!asimUyarisi || asimOnayi) && !yukleniyor

  return (
    <div className="space-y-6 p-6">
      <div>
        <Link href="/servis-yonetimi" className="text-sm text-muted-foreground hover:underline">← Servis Yönetimi</Link>
        <h1 className="mt-1 text-2xl font-semibold">Excel&apos;den Toplu Atama</h1>
        <p className="text-sm text-muted-foreground">
          Personeli güzergâh, durak ve sefer dilimine toplu atayın ya da dilimsiz atamalara dilim ekleyin. Önce önizleme yapılır;
          hiçbir kayıt yazılmaz.
        </p>
      </div>
      <Adimlar adim={adim} />

      {hata && <p role="alert" className="text-sm text-red-600">{hata}</p>}

      {adim === 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base">1. Dosya yükle</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <ul className="list-disc pl-5 text-sm text-muted-foreground">
              <li>Sütunlar: Sicil No · Güzergâh Kodu · Durak Kodu · Sefer Dilimi Kodu(ları) · Başlangıç Tarihi.</li>
              <li><strong>Sefer dilimi zorunludur</strong>; dilimsiz atama üretilmez. Birden çok dilim virgülle ayrılır.</li>
              <li>Güzergâh ve Durak boş, Sefer Dilimi dolu bırakılırsa personelin mevcut aktif atamasına dilim eklenir.</li>
              <li>
                En fazla {EXCEL_LIMITLERI.maksSatir} satır (başlık hariç), {EXCEL_MAKS_MB} MB, yalnız .xlsx. Daha büyük listeleri parçalara bölün.
              </li>
            </ul>
            <div className="flex flex-wrap items-center gap-3">
              <a href={`${BASE}/sablon`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Şablonu indir
              </a>
              <input
                ref={girdi}
                type="file"
                accept=".xlsx"
                aria-label="Excel dosyası"
                onChange={(e) => dosyaSec(e.target.files?.[0] ?? null)}
                className="text-sm"
              />
              <Button onClick={onizle} disabled={!dosya || yukleniyor}>
                {yukleniyor && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Önizle
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {adim === 2 && onizleme && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
            <Ozet baslik="Yeni atama" deger={onizleme.ozet.yeni} />
            <Ozet baslik="Değişiklik" deger={onizleme.ozet.degisiklik} />
            <Ozet baslik="Dilim ekleme" deger={onizleme.ozet.dilimEkle} />
            <Ozet baslik="Değişmeyen" deger={onizleme.ozet.degismeyen} />
            <Ozet baslik="Kapasite uyarısı" deger={onizleme.ozet.kapasiteUyarisi} vurgu="kirmizi" />
            <Ozet baslik="Hatalı satır" deger={onizleme.ozet.hatali} vurgu="amber" />
            {onizleme.ozet.uyarili > 0 && <Ozet baslik="Uyarılı satır" deger={onizleme.ozet.uyarili} vurgu="amber" />}
          </div>

          {onizleme.etki.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Kapasite etkisi (bugünün kapasitesi)</CardTitle></CardHeader>
              <CardContent>
                <ul className="list-disc pl-5 text-sm" data-testid="kapasite-etkisi">
                  {onizleme.etki.map((e) => (
                    <li key={`${e.guzergahId}-${e.dilimId}`} className={e.asim ? 'text-red-700' : undefined}>
                      {e.guzergahKod} — {etkiMetni(e)}{e.asim ? ` — AŞIM +${e.fazla}` : ''}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {asimlar.length > 0 && <AsimUyarisi satirlar={asimlar} onay={asimOnayi} onOnay={setAsimOnayi} />}
          {asimUyarisi && asimlar.length === 0 && <AsimUyarisi satirlar={asimUyarisi} onay={asimOnayi} onOnay={setAsimOnayi} />}

          <Card>
            <CardHeader className="flex flex-col gap-2 pb-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">2. Önizleme — {onizleme.ozet.toplamSatir} satır</CardTitle>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={sadeceHatali} onChange={(e) => setSadeceHatali(e.target.checked)} /> Yalnız hatalı satırlar
                </label>
                {onizleme.ozet.hatali > 0 && (
                  <Button size="sm" variant="outline" onClick={hataRaporuIndir}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" /> Hata raporunu indir (Excel)
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-9 w-16">Satır</TableHead>
                    <TableHead className="h-9">Sicil</TableHead>
                    <TableHead className="h-9">Ad soyad</TableHead>
                    <TableHead className="h-9">Güzergâh</TableHead>
                    <TableHead className="h-9">Durak</TableHead>
                    <TableHead className="h-9">Dilim</TableHead>
                    <TableHead className="h-9">Sonuç</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gorunenSatirlar.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="py-6 text-center text-muted-foreground">Gösterilecek satır yok.</TableCell></TableRow>
                  )}
                  {gorunenSatirlar.map((s) => (
                    <TableRow key={s.satirNo} className={s.tur === 'HATA' ? 'bg-red-50 dark:bg-red-950/20' : undefined}>
                      <TableCell className="py-1.5 tabular-nums">{s.satirNo}</TableCell>
                      <TableCell className="py-1.5 font-mono text-xs">{s.sicil || '—'}</TableCell>
                      <TableCell className="py-1.5">{s.adSoyad ?? '—'}</TableCell>
                      <TableCell className="py-1.5">{s.guzergahKod || '—'}</TableCell>
                      <TableCell className="py-1.5">{s.durakKod || '—'}</TableCell>
                      <TableCell className="py-1.5 text-xs">{s.dilimKodlari.join(', ') || '—'}</TableCell>
                      <TableCell className="py-1.5">
                        <TurRozeti tur={s.tur} />
                        {s.hata && <span className="mt-0.5 block text-xs text-red-700">{s.hata}</span>}
                        {s.uyari && <span className="mt-0.5 block text-xs text-amber-700" data-testid="satir-uyari">Uyarı: {s.uyari}</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {uygulanacakSayisi === 0 && (
            <p role="alert" className="text-sm text-amber-700">Uygulanacak geçerli satır yok. Hataları düzeltip dosyayı yeniden yükleyin.</p>
          )}
          {onizleme.ozet.hatali > 0 && uygulanacakSayisi > 0 && (
            <p className="text-sm text-muted-foreground">{onizleme.ozet.hatali} hatalı satır atlanacak; yalnız geçerli satırlar uygulanır.</p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={bastanBasla}>Vazgeç / Yeni dosya</Button>
            <Button onClick={uygula} disabled={!uygulanabilir}>
              {yukleniyor && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {uygulanacakSayisi} satırı uygula
            </Button>
          </div>
        </>
      )}

      {adim === 3 && sonuc && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="h-5 w-5 text-emerald-600" /> 3. Uygulandı</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p data-testid="uygulama-ozeti">
              {sonuc.yeni} yeni atama, {sonuc.degisiklik} değişiklik, {sonuc.dilimEkle} dilim ekleme uygulandı
              {sonuc.degismeyen > 0 ? `; ${sonuc.degismeyen} satırda değişiklik yoktu` : ''}
              {sonuc.atlanan > 0 ? `; ${sonuc.atlanan} hatalı satır atlandı` : ''}.
            </p>
            <p className="text-muted-foreground">
              Toplu işlem no: <span className="font-mono">{sonuc.topluIslemId}</span> — her atamanın tarihçesinde bu numarayla
              izlenebilir; atamalar güzergâh detayından tek tek kapatılabilir.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={bastanBasla}>Yeni dosya yükle</Button>
              <Link href="/servis-yonetimi" className={buttonVariants({ variant: 'outline' })}>Servis Yönetimi</Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
