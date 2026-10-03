'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { KapasiteGuzergahSatiri, ServisKapasiteToplu } from '@/lib/servis-yonetimi/kapasite'
import type { ServisPaneliOzeti } from '@/lib/servis-yonetimi/panel'
import { cn } from '@/lib/utils'
import { TIRE, bosKoltukMetni, koltukMetni } from '../_lib/kapasite-gosterim'
import { DolulukCubugu, DurumRozeti } from '../_components/KapasiteRozetleri'
import { servisIstek } from '../_lib/servis-istek'
import {
  panelSatirlariFiltreleSirala,
  type PanelSiralama,
  type PanelSiralamaAlani,
} from '../_lib/panel-liste'

// SERVİS PANELİ (B2) — bugünkü kapasite ve doluluk.
//
// Bu ekran HESAP YAPMAZ: koltuk, personel, boş koltuk, doluluk, durum ve KPI toplamları
// kapasite motorundan (src/lib/servis-yonetimi/kapasite.ts) gelir. Burada yalnız
// biçimlendirme, arama ve sıralama vardır.

type SikayetOzeti = { acik: number; aksiyonAlindi: number }

const bugunMetni = () =>
  new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })

const AY_ADLARI = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

function KpiKarti({ baslik, deger, alt, vurgu }: { baslik: string; deger: string; alt?: string; vurgu?: 'kirmizi' }) {
  return (
    <Card className={vurgu === 'kirmizi' ? 'border-red-300 bg-red-50 dark:bg-red-950/20' : undefined}>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">{baslik}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={cn('text-2xl font-semibold tabular-nums', vurgu === 'kirmizi' && 'text-red-600')} data-testid={`kpi-${baslik}`}>
          {deger}
        </p>
        {alt && <p className="text-xs text-muted-foreground">{alt}</p>}
      </CardContent>
    </Card>
  )
}

function SiralamaBasligi({
  alan, etiket, siralama, onSirala, className,
}: {
  alan: PanelSiralamaAlani
  etiket: string
  siralama: PanelSiralama | null
  onSirala: (alan: PanelSiralamaAlani) => void
  className?: string
}) {
  const aktif = siralama?.alan === alan
  const Ikon = !aktif ? ArrowUpDown : siralama!.yon === 'asc' ? ArrowUp : ArrowDown
  return (
    <TableHead
      className={cn('h-9', className)}
      aria-sort={aktif ? (siralama!.yon === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button type="button" className="inline-flex items-center gap-1 font-medium" onClick={() => onSirala(alan)}>
        {etiket}
        <Ikon className="h-3 w-3 opacity-60" />
      </button>
    </TableHead>
  )
}

export default function ServisPaneliPage() {
  const { data: session } = useSession()
  const permissions = session?.user?.permissions || []
  const canView = permissions.includes('servis.view')
  // Export düğmeleri: görüntüleme + dışa aktarma izni BİRLİKTE (API de AND ister).
  const canExport = canView && permissions.includes('servis.export')
  const canSikayet = permissions.includes('servis.sikayet.view')

  const [toplu, setToplu] = useState<ServisKapasiteToplu | null>(null)
  const [ozet, setOzet] = useState<ServisPaneliOzeti | null>(null)
  const [sikayet, setSikayet] = useState<SikayetOzeti | null>(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)
  const [ozetHatasi, setOzetHatasi] = useState<string | null>(null)
  const [arama, setArama] = useState('')
  const [siralama, setSiralama] = useState<PanelSiralama | null>(null)

  const yukle = useCallback(async () => {
    setYukleniyor(true)
    setHata(null)
    setOzetHatasi(null)
    const [kapasite, panel, kpi] = await Promise.all([
      servisIstek('/api/servis-yonetimi/kapasite-toplu', undefined, 'Kapasite özeti alınamadı.'),
      servisIstek('/api/servis-yonetimi/panel', undefined, 'Panel özeti alınamadı.'),
      canSikayet
        ? servisIstek('/api/servis-yonetimi/sikayet/kpi', undefined, 'Şikâyet özeti alınamadı.')
        : Promise.resolve(null),
    ])
    if (!kapasite.ok) setHata(kapasite.mesaj)
    else setToplu((kapasite.json as { data: ServisKapasiteToplu }).data)
    if (!panel.ok) setOzetHatasi(panel.mesaj)
    else setOzet((panel.json as { data: ServisPaneliOzeti }).data)
    if (kpi?.ok) {
      const d = (kpi.json as { data: { durumKirilim: { durum: string; adet: number }[] } }).data
      const adet = (durum: string) => d.durumKirilim.find((x) => x.durum === durum)?.adet ?? 0
      setSikayet({ acik: adet('ACIK'), aksiyonAlindi: adet('AKSIYON_ALINDI') })
    }
    setYukleniyor(false)
  }, [canSikayet])

  useEffect(() => {
    if (canView) void yukle()
  }, [canView, yukle])

  function sirala(alan: PanelSiralamaAlani) {
    setSiralama((onceki) => {
      if (!onceki || onceki.alan !== alan) return { alan, yon: 'asc' }
      return onceki.yon === 'asc' ? { alan, yon: 'desc' } : null
    })
  }

  const satirlar = useMemo(
    () => panelSatirlariFiltreleSirala(toplu?.guzergahlar ?? [], arama, siralama),
    [toplu, arama, siralama],
  )

  if (!canView) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Bu sayfayı görüntüleme yetkiniz yok.</p>
      </div>
    )
  }

  const bos = toplu !== null && toplu.toplam.guzergahSayisi === 0

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Servis Paneli</h1>
          <p className="text-sm text-muted-foreground">Bugünkü kapasite ve doluluk · {bugunMetni()}</p>
        </div>
        {canExport && (
          <div className="flex flex-wrap gap-2">
            <a
              href="/api/servis-yonetimi/export/kapasite"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Kapasite Raporu (Excel)
            </a>
            <a
              href="/api/servis-yonetimi/export/guzergah-listesi-pdf"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <FileText className="mr-2 h-4 w-4" /> Güzergâh Listesi (PDF)
            </a>
          </div>
        )}
      </div>

      {hata && (
        <p role="alert" className="text-sm text-red-600">
          {hata}
        </p>
      )}

      {yukleniyor && !toplu && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor...
        </p>
      )}

      {bos && (
        <Card>
          <CardContent className="space-y-3 py-10 text-center">
            <p className="font-medium">Henüz aktif güzergâh yok.</p>
            <p className="text-sm text-muted-foreground">
              Kapasite ve doluluk, tanımlı aktif güzergâhlar, araç atamaları ve personel atamalarından hesaplanır.
              Önce Servis Yönetimi'nden yerleşke, güzergâh ve araç tanımlayın.
            </p>
            <Link href="/servis-yonetimi" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Servis Yönetimi'ne git
            </Link>
          </CardContent>
        </Card>
      )}

      {toplu && !bos && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <KpiKarti baslik="Güzergâh" deger={String(toplu.toplam.guzergahSayisi)} />
            <KpiKarti
              baslik="Atanmış personel"
              deger={String(toplu.toplam.atanmisPersonel)}
              alt={
                toplu.toplam.dilimsizAtamaSayisi > 0
                  ? `${toplu.toplam.dilimsizAtamaSayisi} atama dilim bağlantısız, kapasiteye girmiyor`
                  : undefined
              }
            />
            <KpiKarti baslik="Toplam koltuk" deger={String(toplu.toplam.toplamKoltuk)} alt="Yalnız aracı olan güzergâhlar" />
            <KpiKarti baslik="Boş koltuk" deger={String(toplu.toplam.netBosKoltuk)} alt="Aşımlar düşülmüş net" />
            <KpiKarti
              baslik="Kapasite aşımı"
              deger={String(toplu.toplam.asimSayisi)}
              alt={toplu.toplam.asimSayisi > 0 ? `${toplu.toplam.asimKisi} kişi fazla` : undefined}
              vurgu={toplu.toplam.asimSayisi > 0 ? 'kirmizi' : undefined}
            />
          </div>
          <p className="-mt-3 text-xs text-muted-foreground">
            Her güzergâh, en dolu sefer diliminin değerleriyle gösterilir; dilim ayrıntısı Kapasite Raporu'ndadır.
          </p>

          {toplu.asimlar.length > 0 && (
            <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 dark:bg-red-950/20">
              <p className="flex items-center gap-2 font-medium text-red-700">
                <AlertTriangle className="h-4 w-4" /> {toplu.asimlar.length} güzergâh/dilimde kapasite aşıldı
              </p>
              <ul className="mt-2 space-y-1 text-sm text-red-800">
                {toplu.asimlar.map((a) => (
                  <li key={`${a.guzergahId}-${a.dilimKod}`}>
                    <Link href={`/servis-yonetimi/guzergah/${a.guzergahId}`} className="font-medium underline">
                      {a.kod} — {a.ad}
                    </Link>{' '}
                    ({a.dilimKod}): {a.personel} kişi / {a.koltuk} koltuk (+{a.fazla})
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-red-800">
                Aşan güzergâhlara araç ekleyin ya da personeli başka servise taşıyın (güzergâh detayı → Personel
                Atamaları → Alternatif Servis Öner).
              </p>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Card>
              <CardHeader className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base">Güzergâh bazında kapasite</CardTitle>
                <Input
                  value={arama}
                  onChange={(e) => setArama(e.target.value)}
                  placeholder="Güzergâh veya plaka ara"
                  aria-label="Güzergâh ara"
                  className="h-8 sm:max-w-xs"
                />
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SiralamaBasligi alan="guzergah" etiket="Güzergâh" siralama={siralama} onSirala={sirala} />
                      <TableHead className="h-9">Araç</TableHead>
                      <SiralamaBasligi alan="koltuk" etiket="Koltuk" siralama={siralama} onSirala={sirala} className="text-right" />
                      <SiralamaBasligi alan="personel" etiket="Personel" siralama={siralama} onSirala={sirala} className="text-right" />
                      <SiralamaBasligi alan="bos" etiket="Boş" siralama={siralama} onSirala={sirala} className="text-right" />
                      <SiralamaBasligi alan="doluluk" etiket="Doluluk" siralama={siralama} onSirala={sirala} />
                      <SiralamaBasligi alan="durum" etiket="Durum" siralama={siralama} onSirala={sirala} />
                      <TableHead className="h-9 text-right">Detay</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {satirlar.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="py-6 text-center text-muted-foreground">
                          Aramayla eşleşen güzergâh yok.
                        </TableCell>
                      </TableRow>
                    )}
                    {satirlar.map((g) => (
                      <TableRow key={g.guzergahId} className={g.ozet.durum === 'ASIM' ? 'bg-red-50 dark:bg-red-950/20' : undefined}>
                        <TableCell className="py-1.5">
                          <span className="font-medium">{g.kod}</span> — {g.ad}
                          {g.dilimSayisi > 1 && g.dilimKod && (
                            <span className="block text-xs text-muted-foreground">en dolu dilim: {g.dilimKod}</span>
                          )}
                        </TableCell>
                        <TableCell className="py-1.5 font-mono text-xs">{g.araclar.length > 0 ? g.araclar.join(', ') : TIRE}</TableCell>
                        <TableCell className="py-1.5 text-right tabular-nums">{koltukMetni(g.ozet)}</TableCell>
                        <TableCell className="py-1.5 text-right tabular-nums">{g.ozet.atananPersonelSayisi}</TableCell>
                        <TableCell className={cn('py-1.5 text-right tabular-nums', g.ozet.durum === 'ASIM' && 'font-semibold text-red-600')}>
                          {bosKoltukMetni(g.ozet)}
                        </TableCell>
                        <TableCell className="py-1.5"><DolulukCubugu ozet={g.ozet} /></TableCell>
                        <TableCell className="py-1.5"><DurumRozeti ozet={g.ozet} /></TableCell>
                        <TableCell className="py-1.5 text-right">
                          <Link
                            href={`/servis-yonetimi/guzergah/${g.guzergahId}`}
                            className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'h-7 px-2' })}
                            aria-label={`${g.kod} detay`}
                          >
                            Detay
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="mt-3 text-xs">
                  <Link href="/servis-yonetimi/kapasite" className="text-blue-700 hover:underline">
                    Tüm güzergâhlar, tarih seçimi ve sefer dilimi ayrıntısı → Toplu kapasite
                  </Link>
                </p>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Bu Ay Ne Değişti?</CardTitle></CardHeader>
                <CardContent className="space-y-1 text-sm">
                  {ozetHatasi && <p role="alert" className="text-xs text-red-600">{ozetHatasi}</p>}
                  {ozet && (
                    <>
                      <p className="text-xs text-muted-foreground">{AY_ADLARI[ozet.buAy.ay - 1]} {ozet.buAy.yil}</p>
                      <p><span className="font-semibold tabular-nums">{ozet.buAy.yeniServisKullanicisi}</span> yeni servis kullanıcısı</p>
                      <p><span className="font-semibold tabular-nums">{ozet.buAy.servistenAyrilan}</span> servisten ayrılan</p>
                      <p><span className="font-semibold tabular-nums">{ozet.buAy.servisDegistiren + ozet.buAy.durakDegistiren}</span> servis/durak değiştiren</p>
                      <p><span className="font-semibold tabular-nums">{ozet.buAy.aracDegisenServis + ozet.buAy.soforDegisenServis}</span> araç/şoför değişen servis</p>
                    </>
                  )}
                  <Link href="/servis-yonetimi/bu-ay-ne-degisti" className="mt-2 inline-block text-xs text-blue-700 hover:underline">
                    Ayrıntı →
                  </Link>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Veri Kalitesi</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {ozet && (
                    <>
                      <p>
                        <span className="font-semibold tabular-nums">{ozet.veriKalite.toplamBulgu}</span> bulgu ·{' '}
                        {ozet.veriKalite.bulguluKontrol}/{ozet.veriKalite.kontrolSayisi} kontrolde
                      </p>
                      {ozet.veriKalite.hataliKontrol > 0 && (
                        <p role="alert" className="text-xs text-red-600">{ozet.veriKalite.hataliKontrol} kontrol çalışırken hata verdi.</p>
                      )}
                      {ozet.veriKalite.dilimsizAtama !== null && ozet.veriKalite.dilimsizAtama > 0 && (
                        <p className="text-xs" data-testid="vk-dilimsiz">
                          <span className="font-semibold tabular-nums">{ozet.veriKalite.dilimsizAtama}</span> atama dilim bağlantısız
                        </p>
                      )}
                      <ul className="space-y-0.5 text-xs text-muted-foreground">
                        {ozet.veriKalite.enCokBulgu.map((s) => (
                          <li key={s.kod}>{s.baslik}: <span className="tabular-nums">{s.adet}</span></li>
                        ))}
                      </ul>
                    </>
                  )}
                  <Link href="/servis-yonetimi/veri-kalite" className={buttonVariants({ variant: 'outline', size: 'sm', className: 'h-7 px-2' })}>
                    Veri Kalite Merkezi
                  </Link>
                </CardContent>
              </Card>

              {canSikayet && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Şikâyetler</CardTitle></CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    {sikayet && (
                      <>
                        <p><span className="font-semibold tabular-nums">{sikayet.acik}</span> açık</p>
                        <p className="text-xs text-muted-foreground">{sikayet.aksiyonAlindi} aksiyon alındı</p>
                      </>
                    )}
                    <Link href="/servis-yonetimi/sikayet" className="mt-2 inline-block text-xs text-blue-700 hover:underline">
                      Şikâyetlere git →
                    </Link>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </>
      )}

    </div>
  )
}
