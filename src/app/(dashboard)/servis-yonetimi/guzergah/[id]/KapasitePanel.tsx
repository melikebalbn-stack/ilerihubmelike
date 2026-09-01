'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { SeferDilimi } from './types'

type KapasiteOzeti = {
  kapasite: number
  atananPersonelSayisi: number
  bosKoltuk: number
  dolulukOrani: number
}

type DilimOzeti = { dilim: SeferDilimi; ozet: KapasiteOzeti }

const bugun = () => new Date().toISOString().slice(0, 10)

export function KapasitePanel({ guzergahId, dilimler }: { guzergahId: string; dilimler: SeferDilimi[] }) {
  const [hesapTarihi, setHesapTarihi] = useState(bugun())
  const [ozetler, setOzetler] = useState<DilimOzeti[]>([])
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)

  const yukle = useCallback(async () => {
    setYukleniyor(true)
    setHata(null)
    try {
      const sonuclar = await Promise.all(dilimler.map(async (dilim) => {
        const params = new URLSearchParams({ dilimId: dilim.id, tarih: hesapTarihi })
        const response = await fetch(`/api/servis-yonetimi/guzergah/${guzergahId}/kapasite?${params}`)
        const json = await response.json()
        if (!response.ok || !json.ok) throw new Error(json.message || 'Kapasite özeti alınamadı.')
        return { dilim, ozet: json.data as KapasiteOzeti }
      }))
      setOzetler(sonuclar)
    } catch (err) {
      setHata(err instanceof Error ? err.message : 'Kapasite özeti alınamadı.')
    } finally {
      setYukleniyor(false)
    }
  }, [dilimler, guzergahId, hesapTarihi])

  useEffect(() => { yukle() }, [yukle])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-medium">Kapasite ve Doluluk</h2>
          <p className="text-sm text-muted-foreground">Aktif ANA araçlar ve tarih aralığındaki personel atamaları esas alınır.</p>
        </div>
        <div className="w-full sm:w-48">
          <Label htmlFor="kapasite-hesap-tarihi">Hesap Tarihi</Label>
          <Input id="kapasite-hesap-tarihi" type="date" value={hesapTarihi} onChange={(e) => setHesapTarihi(e.target.value)} />
        </div>
      </div>
      {hata && <p className="text-sm text-red-600">{hata}</p>}
      {yukleniyor ? <p className="text-sm text-muted-foreground">Hesaplanıyor...</p> : (
        <Table>
          <TableHeader><TableRow><TableHead>Sefer Dilimi</TableHead><TableHead>Kapasite</TableHead><TableHead>Atanan Personel</TableHead><TableHead>Boş Koltuk</TableHead><TableHead>Doluluk</TableHead><TableHead>Durum</TableHead></TableRow></TableHeader>
          <TableBody>
            {ozetler.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Aktif sefer dilimi yok.</TableCell></TableRow>}
            {ozetler.map(({ dilim, ozet }) => {
              const asimVar = ozet.bosKoltuk < 0
              return <TableRow key={dilim.id} className={asimVar ? 'bg-red-50 dark:bg-red-950/20' : undefined}>
                <TableCell>{dilim.kod} — {dilim.ad}</TableCell>
                <TableCell>{ozet.kapasite}</TableCell>
                <TableCell>{ozet.atananPersonelSayisi}</TableCell>
                <TableCell className={asimVar ? 'font-semibold text-red-600' : undefined}>{ozet.bosKoltuk}</TableCell>
                <TableCell>%{ozet.dolulukOrani.toFixed(1)}</TableCell>
                <TableCell>{asimVar ? <Badge variant="destructive">Kapasite aşımı</Badge> : <Badge variant="secondary">Uygun</Badge>}</TableCell>
              </TableRow>
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
