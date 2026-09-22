'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Database, FileBarChart2, Loader2, Plus, FileSearch } from 'lucide-react'
import { RozetLink } from './rozet-link'

const NAVY = '#1B4F72'

interface Sablon {
  id: string
  kod: string
  ad: string
  aciklama: string | null
  durum: 'TASLAK' | 'YAYINDA' | 'ARSIV'
  tur: 'etkilesimli' | 'belge'
  guncellenme: string
}

const DURUM_ETIKET: Record<Sablon['durum'], { metin: string; sinif: string }> = {
  YAYINDA: { metin: 'Yayında', sinif: 'bg-green-100 text-green-800 hover:bg-green-100' },
  TASLAK: { metin: 'Taslak', sinif: 'bg-amber-100 text-amber-800 hover:bg-amber-100' },
  ARSIV: { metin: 'Arşiv', sinif: 'bg-gray-100 text-gray-700 hover:bg-gray-100' },
}

const tarihMetni = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })

export default function RaporListeClient() {
  const [sablonlar, setSablonlar] = useState<Sablon[] | null>(null)
  const [tasarlayabilir, setTasarlayabilir] = useState(false)
  const [hata, setHata] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/raporlar')
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`)
        setSablonlar(d.sablonlar ?? [])
        setTasarlayabilir(Boolean(d.tasarlayabilir))
      })
      .catch((e: Error) => { setHata(e.message); setSablonlar([]) })
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-3xl font-bold tracking-tight flex items-center gap-3">
            <FileBarChart2 className="h-6 w-6 lg:h-7 lg:w-7" style={{ color: NAVY }} />
            Raporlar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Tanımlı raporları çalıştırın, yazdırın veya Excel olarak indirin</p>
        </div>
        {tasarlayabilir && (
          <div className="flex items-center gap-2">
            <RozetLink href="/raporlar/veri-setleri" icon={<Database className="h-3.5 w-3.5" />}>Veri setleri</RozetLink>
            <RozetLink href="/raporlar/tasarim/yeni" icon={<Plus className="h-3.5 w-3.5" />}>Yeni rapor</RozetLink>
          </div>
        )}
      </div>

      {hata && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{hata}</div>
      )}

      {sablonlar === null ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Raporlar yükleniyor…
        </div>
      ) : sablonlar.length === 0 ? (
        <Card>
          <CardContent className="py-14 flex flex-col items-center text-center gap-2">
            <FileSearch className="h-10 w-10 text-muted-foreground/60" />
            <p className="font-medium">Henüz tanımlı rapor yok</p>
            <p className="text-sm text-muted-foreground max-w-md">
              {tasarlayabilir
                ? 'İlk raporu oluşturmak için "Yeni rapor" düğmesini kullanın.'
                : 'Rapor tasarımcıları bir rapor yayınladığında burada görünecek.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sablonlar.map((s) => {
            const durum = DURUM_ETIKET[s.durum]
            return (
              <Link key={s.id} href={`/raporlar/${s.id}`} className="group focus:outline-none">
                <Card className="h-full transition-shadow group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-ring">
                  <CardContent className="p-5 flex flex-col gap-3 h-full">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{s.kod}</span>
                      <span className="flex items-center gap-1">
                        <Badge className={s.tur === 'etkilesimli' ? 'bg-[#DCEDF5] text-[#1B4F72] hover:bg-[#DCEDF5]' : 'bg-slate-100 text-slate-700 hover:bg-slate-100'}>{s.tur === 'etkilesimli' ? 'Etkileşimli' : 'Belge'}</Badge>
                        <Badge className={durum.sinif}>{durum.metin}</Badge>
                      </span>
                    </div>
                    <div className="flex-1">
                      <h2 className="font-semibold leading-snug" style={{ color: NAVY }}>{s.ad}</h2>
                      {s.aciklama && <p className="text-sm text-muted-foreground mt-1 line-clamp-3">{s.aciklama}</p>}
                    </div>
                    <p className="text-xs text-muted-foreground">Son güncelleme: {tarihMetni(s.guncellenme)}</p>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
