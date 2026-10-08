'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, RefreshCw, Printer, Search, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type Kisi = { personnelId: string; adSoyad: string; sicil: string | null; bolum: string; girisZamani: string }
type Veri = { olusturuldu: string; pencereSaat: number; toplam: number; bolumler: { bolum: string; kisiler: Kisi[] }[] }

const YENILE_MS = 15_000
const saat = (iso: string) => new Date(iso).toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' })
const tamZaman = (iso: string) => new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'short' })

export function IcerideClient() {
  const [veri, setVeri] = useState<Veri | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [arama, setArama] = useState('')
  const [otoYenile, setOtoYenile] = useState(true)
  const otoRef = useRef(otoYenile)
  otoRef.current = otoYenile

  const yukle = useCallback(() => {
    setYukleniyor(true)
    fetch('/api/pdks/iceride')
      .then((r) => r.json())
      .then((j) => (j.ok ? (setVeri(j as Veri), setHata(null)) : setHata(j.error ?? 'Veri alınamadı')))
      .catch(() => setHata('Veri alınamadı'))
      .finally(() => setYukleniyor(false))
  }, [])

  useEffect(() => {
    yukle()
    const t = setInterval(() => otoRef.current && yukle(), YENILE_MS)
    return () => clearInterval(t)
  }, [yukle])

  // Arama: ad / sicil / bölüm (ekran içi; tahliye baskısı için aramayı temizleyin)
  const bolumler = useMemo(() => {
    if (!veri) return []
    const q = arama.trim().toLocaleLowerCase('tr')
    if (!q) return veri.bolumler
    return veri.bolumler
      .map((b) => ({
        ...b,
        kisiler: b.kisiler.filter(
          (k) =>
            k.adSoyad.toLocaleLowerCase('tr').includes(q) ||
            (k.sicil ?? '').toLocaleLowerCase('tr').includes(q) ||
            k.bolum.toLocaleLowerCase('tr').includes(q),
        ),
      }))
      .filter((b) => b.kisiler.length > 0)
  }, [veri, arama])

  const gosterilen = useMemo(() => bolumler.reduce((a, b) => a + b.kisiler.length, 0), [bolumler])

  if (hata && !veri) return <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{hata}</div>
  if (!veri) return <div className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor…</div>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Users className="h-5 w-5 text-[#1B4F72]" />
          <span className="text-lg font-bold text-slate-800">{veri.toplam}</span> kişi binada
          {arama.trim() && <span className="text-slate-400">· {gosterilen} eşleşme</span>}
          <span className="text-slate-400">· {tamZaman(veri.olusturuldu)} · son {veri.pencereSaat} saat</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input value={arama} onChange={(e) => setArama(e.target.value)} placeholder="Ad, sicil veya bölüm" className="w-56 pl-8" />
          </div>
          <label className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-600">
            <input type="checkbox" className="h-4 w-4" checked={otoYenile} onChange={(e) => setOtoYenile(e.target.checked)} />
            Oto-yenile
          </label>
          <Button variant="outline" size="sm" onClick={yukle} disabled={yukleniyor}>
            <RefreshCw className={`mr-1 h-4 w-4 ${yukleniyor ? 'animate-spin' : ''}`} /> Yenile
          </Button>
          <Button size="sm" onClick={() => window.print()} title="Aramayı temizleyince tam liste yazdırılır">
            <Printer className="mr-1 h-4 w-4" /> Tahliye listesi yazdır
          </Button>
        </div>
      </div>

      {/* Yazdırma başlığı — yalnız baskıda */}
      <div className="hidden print:block">
        <div className="text-lg font-bold">Yangın Tahliye — Binadaki Personel</div>
        <div className="text-sm">{tamZaman(veri.olusturuldu)} · Toplam {veri.toplam} kişi{arama.trim() ? ` · (filtre: ${arama.trim()})` : ''}</div>
      </div>

      {gosterilen === 0 ? (
        <div className="rounded-lg border p-4 text-sm text-slate-600">
          {arama.trim() ? 'Eşleşen kişi yok.' : `Son ${veri.pencereSaat} saatte binada görünen personel yok.`}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
          {bolumler.map((b) => (
            <Card key={b.bolum} className="break-inside-avoid">
              <CardContent className="p-4">
                <div className="mb-2 flex items-center justify-between border-b pb-1">
                  <span className="font-semibold text-[#1B4F72]">{b.bolum}</span>
                  <span className="text-sm text-slate-500">{b.kisiler.length}</span>
                </div>
                <ul className="space-y-1 text-sm">
                  {b.kisiler.map((k) => (
                    <li key={k.personnelId} className="flex items-center justify-between gap-2">
                      <span className="text-slate-800">{k.adSoyad}{k.sicil && <span className="ml-1 text-slate-400">({k.sicil})</span>}</span>
                      <span className="tabular-nums text-slate-500">{saat(k.girisZamani)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
