'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarCheck, ChevronLeft, ChevronRight, Hourglass, Loader2, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

type Hucre = 'IZINLI' | 'YARIM' | 'BEKLIYOR' | 'TATIL' | 'YARIM_TATIL' | 'HAFTA_SONU' | 'BOS'
type Veri = {
  ay: string
  gunler: { tarih: string; gun: string; kapali: boolean; tatil: string | null }[]
  satirlar: { personnelId: string; ad: string; hucreler: { h: Hucre; title: string }[] }[]
  ozet: { bugunIzinli: number | null; ekip: number; enYogun: { tarih: string; kisi: number } | null; bekleyenTalep: number }
  departmanlar: { id: string; name: string }[] | null
  departmentId: string | null
  kapsam: 'IV' | 'EKIP'
}

// Renkler (canvas): izinli koyu mavi, yarım gün açık mavi, onay bekliyor turuncu, hafta sonu/tatil gri. Kırmızı-yeşil YOK.
const RENK: Record<Hucre, string> = {
  IZINLI: 'bg-[#1D6FB8]',
  YARIM: 'bg-[#9CC3E8]',
  BEKLIYOR: 'bg-[#F2B872]',
  TATIL: 'bg-[#E3E7EC]',
  HAFTA_SONU: 'bg-[#E3E7EC]',
  YARIM_TATIL: 'bg-[linear-gradient(90deg,#F7F9FB_50%,#E3E7EC_50%)]',
  BOS: 'bg-[#F7F9FB]',
}
const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
const bugun = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10)
const ayEkle = (ay: string, n: number) => {
  const [y, m] = ay.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7)
}

export function EkipTakvimiClient() {
  const [ay, setAy] = useState(bugun().slice(0, 7))
  const [dep, setDep] = useState<string | null>(null)
  const [v, setV] = useState<Veri | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [yukleniyor, setYukleniyor] = useState(true)

  const yukle = useCallback(async () => {
    setYukleniyor(true)
    try {
      const r = await fetch(`/api/izin/takvim?ay=${ay}${dep ? `&departmentId=${dep}` : ''}`, { cache: 'no-store' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || d.ok === false) setHata(d.error ?? 'Ekip takvimi alınamadı')
      else { setHata(null); setV(d) }
    } catch {
      setHata('Sunucuya ulaşılamadı')
    }
    setYukleniyor(false)
  }, [ay, dep])
  useEffect(() => void yukle(), [yukle])

  const bg = bugun()
  const oz = v?.ozet
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-end gap-3">
        {v?.departmanlar ? (
          <div className="w-56">
            <Label className="text-xs text-slate-500">Ekip (departman)</Label>
            <Select value={dep ?? v.departmentId ?? ''} onValueChange={setDep}>
              <SelectTrigger className="mt-1 bg-white"><SelectValue placeholder="Departman" /></SelectTrigger>
              <SelectContent>{v.departmanlar.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        ) : (
          v && <span className="mr-auto text-sm text-slate-500">Ekibim · {v.ozet.ekip} kişi</span>
        )}
        <div className="flex h-10 items-center gap-1">
          <button type="button" aria-label="Önceki ay" onClick={() => setAy(ayEkle(ay, -1))} className="flex h-10 w-10 items-center justify-center rounded-lg border bg-white hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-[120px] text-center text-[15px] font-semibold">{AYLAR[Number(ay.slice(5)) - 1]} {ay.slice(0, 4)}</span>
          <button type="button" aria-label="Sonraki ay" onClick={() => setAy(ayEkle(ay, 1))} className="flex h-10 w-10 items-center justify-center rounded-lg border bg-white hover:bg-slate-50"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      {hata && <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">{hata}</div>}
      {!v && yukleniyor && <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" />}

      {v && (
        <div className={cn('rounded-lg border bg-white p-3 sm:p-4', yukleniyor && 'opacity-60')}>
          <div className="overflow-x-auto">
            <table className="border-separate border-spacing-[3px] text-center">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 min-w-[150px] bg-white sm:min-w-[170px]" />
                  {v.gunler.map((d) => (
                    <th key={d.tarih} className={cn('min-w-[26px] text-[11px] font-normal', d.tarih === bg ? 'font-bold text-[#1B4F72]' : d.kapali ? 'text-slate-400' : 'text-slate-500')} title={d.tatil ?? undefined}>
                      <div>{d.gun}</div>
                      <div className="font-mono text-xs">{Number(d.tarih.slice(8))}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {v.satirlar.map((s) => (
                  <tr key={s.personnelId}>
                    <td className="sticky left-0 z-10 max-w-[170px] truncate bg-white pr-2 text-left text-[13px]">{s.ad}</td>
                    {s.hucreler.map((c, i) => (
                      <td key={v.gunler[i].tarih} title={c.title || undefined} className={cn('h-[30px] rounded-[5px]', RENK[c.h])}>
                        <span className="sr-only">{c.title}</span>
                      </td>
                    ))}
                  </tr>
                ))}
                {v.satirlar.length === 0 && (
                  <tr><td colSpan={v.gunler.length + 1} className="py-8 text-sm text-slate-400">Bu ekipte aktif personel yok</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 border-t pt-3 text-xs text-slate-500">
            <Lejant renk="bg-[#1D6FB8]" ad="İzinli" />
            <Lejant renk="bg-[#9CC3E8]" ad="Yarım gün izinli" />
            <Lejant renk="bg-[#F2B872]" ad="Onay bekliyor" />
            <Lejant renk="bg-[#E3E7EC]" ad="Hafta sonu / tatil" />
            <span className="sm:ml-auto">Rapor ve izin türü burada görünmez; yalnızca &quot;İzinli&quot;.</span>
          </div>
        </div>
      )}

      {oz && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Kart ikon={<Users className="h-4 w-4" />} baslik="Bugün izinli" deger={oz.bugunIzinli === null ? '—' : `${oz.bugunIzinli} / ${oz.ekip}`} />
          <Kart ikon={<CalendarCheck className="h-4 w-4" />} baslik="En yoğun gün" deger={oz.enYogun ? `${Number(oz.enYogun.tarih.slice(8))} ${AYLAR[Number(oz.enYogun.tarih.slice(5, 7)) - 1]} · ${oz.enYogun.kisi} kişi` : '—'} />
          <Kart ikon={<Hourglass className="h-4 w-4" />} baslik="Onay bekleyen" deger={`${oz.bekleyenTalep} talep`} turuncu />
        </div>
      )}
    </div>
  )
}

function Lejant({ renk, ad }: { renk: string; ad: string }) {
  return <span className="flex items-center gap-1.5"><span className={cn('h-3.5 w-3.5 rounded', renk)} />{ad}</span>
}

function Kart({ ikon, baslik, deger, turuncu }: { ikon: React.ReactNode; baslik: string; deger: string; turuncu?: boolean }) {
  return (
    <Card className="shadow-none">
      <CardContent className="p-4">
        <div className={cn('flex items-center gap-1.5 text-xs font-medium', turuncu ? 'text-amber-700' : 'text-slate-500')}>{ikon}{baslik}</div>
        <div className={cn('mt-1 font-mono text-2xl font-semibold tabular-nums', turuncu ? 'text-amber-700' : 'text-slate-900')}>{deger}</div>
      </CardContent>
    </Card>
  )
}
