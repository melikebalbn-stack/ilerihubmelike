'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { FileSpreadsheet, Loader2 } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { KapasiteDilimSatiri, ServisKapasiteToplu } from '@/lib/servis-yonetimi/kapasite'
import { normalizeTr } from '@/lib/normalize-tr'
import { cn } from '@/lib/utils'
import { TIRE, bosKoltukMetni, koltukMetni } from '../_lib/kapasite-gosterim'
import { servisIstek } from '../_lib/servis-istek'
import { DolulukCubugu, DurumRozeti } from '../_components/KapasiteRozetleri'

// TOPLU KAPASİTE (B3): tüm aktif güzergâh × sefer dilimi çiftleri, seçilen gün için.
// Servis Paneli ile AYNI kaynak (kapasite-toplu → kapasite motoru); burada hesap yok.

const bugun = () => new Date().toISOString().slice(0, 10)

const dilimAramaEslesir = (s: KapasiteDilimSatiri, q: string) =>
  [s.guzergahKod, s.guzergahAd, s.dilimKod, s.dilimAd, ...s.araclar].some((m) => normalizeTr(m).includes(q))

export default function TopluKapasitePage() {
  const { data: session } = useSession()
  const permissions = session?.user?.permissions || []
  const canView = permissions.includes('servis.view')
  const canExport = canView && permissions.includes('servis.export')

  const [tarih, setTarih] = useState(bugun())
  const [toplu, setToplu] = useState<ServisKapasiteToplu | null>(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)
  const [arama, setArama] = useState('')
  const [sadeceAsim, setSadeceAsim] = useState(false)

  const yukle = useCallback(async () => {
    setYukleniyor(true)
    setHata(null)
    const sonuc = await servisIstek(
      `/api/servis-yonetimi/kapasite-toplu?tarih=${encodeURIComponent(tarih)}`,
      undefined,
      'Kapasite özeti alınamadı.',
    )
    if (!sonuc.ok) {
      setHata(sonuc.mesaj)
      setToplu(null)
    } else {
      setToplu((sonuc.json as { data: ServisKapasiteToplu }).data)
    }
    setYukleniyor(false)
  }, [tarih])

  useEffect(() => {
    if (canView && tarih) void yukle()
  }, [canView, tarih, yukle])

  const satirlar = useMemo(() => {
    const q = normalizeTr(arama.trim())
    return (toplu?.dilimSatirlari ?? []).filter(
      (s) => (!q || dilimAramaEslesir(s, q)) && (!sadeceAsim || s.ozet.durum === 'ASIM'),
    )
  }, [toplu, arama, sadeceAsim])

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
          <Link href="/servis-yonetimi/panel" className="text-sm text-muted-foreground hover:underline">← Servis Paneli</Link>
          <h1 className="mt-1 text-2xl font-semibold">Toplu Kapasite</h1>
          <p className="text-sm text-muted-foreground">
            Tüm aktif güzergâhların sefer dilimi bazında koltuk, personel ve doluluk durumu.
          </p>
        </div>
        {canExport && (
          <a
            href={`/api/servis-yonetimi/export/kapasite?tarih=${encodeURIComponent(tarih)}`}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Kapasite Raporu (Excel)
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="kapasite-tarih">Hesap tarihi</Label>
          <Input id="kapasite-tarih" type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="kapasite-ara">Ara</Label>
          <Input id="kapasite-ara" value={arama} onChange={(e) => setArama(e.target.value)} placeholder="Güzergâh, dilim veya plaka" />
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" checked={sadeceAsim} onChange={(e) => setSadeceAsim(e.target.checked)} />
          Yalnız kapasite aşımları
        </label>
      </div>

      {hata && <p role="alert" className="text-sm text-red-600">{hata}</p>}
      {yukleniyor && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Hesaplanıyor...
        </p>
      )}

      {toplu && !yukleniyor && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {toplu.toplam.guzergahSayisi} güzergâh · {toplu.toplam.asimSayisi} aşım · {toplu.toplam.aracsizGuzergahSayisi} araçsız ·{' '}
              <span data-testid="toplu-tekil">{toplu.toplam.atanmisPersonel} tekil personel</span>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Tablo, her güzergâhın sefer dilimlerini ayrı ayrı gösterir. Tekil personel, aynı kişi bir kez sayılarak tüm aktif atamaları kapsar
              (dilimli ya da dilimsiz) ve satır toplamı değildir.
            </p>
            {toplu.toplam.dilimsizAtamaSayisi > 0 && (
              <p className="text-xs text-amber-700" data-testid="toplu-dilimsiz">
                {toplu.toplam.dilimsizAtamaSayisi} atama dilim bağlantısız, kapasiteye girmiyor.
              </p>
            )}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-9">Güzergâh</TableHead>
                  <TableHead className="h-9">Sefer dilimi</TableHead>
                  <TableHead className="h-9">Araç</TableHead>
                  <TableHead className="h-9 text-right">Koltuk</TableHead>
                  <TableHead className="h-9 text-right">Personel</TableHead>
                  <TableHead className="h-9 text-right">Boş</TableHead>
                  <TableHead className="h-9">Doluluk</TableHead>
                  <TableHead className="h-9">Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {satirlar.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-6 text-center text-muted-foreground">
                      {toplu.dilimSatirlari.length === 0 ? 'Aktif güzergâh/sefer dilimi yok.' : 'Eşleşen kayıt yok.'}
                    </TableCell>
                  </TableRow>
                )}
                {satirlar.map((s) => (
                  <TableRow key={`${s.guzergahId}-${s.dilimId}`} className={s.ozet.durum === 'ASIM' ? 'bg-red-50 dark:bg-red-950/20' : undefined}>
                    <TableCell className="py-1.5">
                      <Link href={`/servis-yonetimi/guzergah/${s.guzergahId}`} className="hover:underline">
                        <span className="font-medium">{s.guzergahKod}</span> — {s.guzergahAd}
                      </Link>
                    </TableCell>
                    <TableCell className="py-1.5">{s.dilimKod} — {s.dilimAd}</TableCell>
                    <TableCell className="py-1.5 font-mono text-xs">{s.araclar.length > 0 ? s.araclar.join(', ') : TIRE}</TableCell>
                    <TableCell className="py-1.5 text-right tabular-nums">{koltukMetni(s.ozet)}</TableCell>
                    <TableCell className="py-1.5 text-right tabular-nums">{s.ozet.atananPersonelSayisi}</TableCell>
                    <TableCell className={cn('py-1.5 text-right tabular-nums', s.ozet.durum === 'ASIM' && 'font-semibold text-red-600')}>
                      {bosKoltukMetni(s.ozet)}
                    </TableCell>
                    <TableCell className="py-1.5"><DolulukCubugu ozet={s.ozet} /></TableCell>
                    <TableCell className="py-1.5"><DurumRozeti ozet={s.ozet} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
