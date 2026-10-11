'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'

type Satir = { tur: string; personnelId: string; adSoyad: string; sicil: string | null; bolum: string | null; zaman: string; detay: string }
type Veri = { bas: string; bit: string; satirlar: Satir[] }

const TUR: Record<string, string> = {
  ARDISIK_GIRIS: 'Ardışık giriş',
  ARDISIK_CIKIS: 'Ardışık çıkış',
  COK_HIZLI_FARKLI_NOKTA: 'Kart paylaşımı şüphesi',
}
const zaman = (iso: string) => new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'short' })
const bugunStr = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10)
const gunOnce = (n: number) => new Date(Date.now() + 3 * 3600_000 - n * 86400_000).toISOString().slice(0, 10)

export function AnomaliClient() {
  const [bas, setBas] = useState(gunOnce(6))
  const [bit, setBit] = useState(bugunStr())
  const [veri, setVeri] = useState<Veri | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [yukleniyor, setYukleniyor] = useState(false)

  const yukle = useCallback(() => {
    setYukleniyor(true)
    setHata(null)
    fetch(`/api/pdks/anomali?bas=${bas}&bit=${bit}`)
      .then((r) => r.json())
      .then((j) => (j.ok ? setVeri(j as Veri) : setHata(j.error ?? 'Veri alınamadı')))
      .catch(() => setHata('Veri alınamadı'))
      .finally(() => setYukleniyor(false))
  }, [bas, bit])

  useEffect(() => yukle(), [yukle])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Başlangıç</span>
          <Input type="date" value={bas} onChange={(e) => setBas(e.target.value)} className="w-40" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Bitiş</span>
          <Input type="date" value={bit} onChange={(e) => setBit(e.target.value)} className="w-40" />
        </label>
        <Button size="sm" onClick={yukle} disabled={yukleniyor}>
          {yukleniyor ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Tara
        </Button>
      </div>

      {hata && <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{hata}</div>}
      {!veri ? (
        <div className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor…</div>
      ) : veri.satirlar.length === 0 ? (
        <div className="rounded-lg border p-4 text-sm text-slate-600">Bu aralıkta anomali bulunamadı.</div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="px-4 py-2 font-medium">Zaman</th>
                  <th className="px-4 py-2 font-medium">Personel</th>
                  <th className="px-4 py-2 font-medium">Bölüm</th>
                  <th className="px-4 py-2 font-medium">Tür</th>
                  <th className="px-4 py-2 font-medium">Açıklama</th>
                </tr>
              </thead>
              <tbody>
                {veri.satirlar.map((s, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="whitespace-nowrap px-4 py-2 tabular-nums text-slate-600">{zaman(s.zaman)}</td>
                    <td className="px-4 py-2 text-slate-800">{s.adSoyad}{s.sicil && <span className="ml-1 text-slate-400">({s.sicil})</span>}</td>
                    <td className="px-4 py-2 text-slate-600">{s.bolum ?? '—'}</td>
                    <td className="px-4 py-2">
                      <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-900">{TUR[s.tur] ?? s.tur}</span>
                    </td>
                    <td className="px-4 py-2 text-slate-600">{s.detay}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
      <p className="flex items-center gap-1 text-xs text-slate-400"><ShieldAlert className="h-3.5 w-3.5" /> Anomaliler bir ihlal kanıtı değil, incelenmesi gereken işaretlerdir.</p>
    </div>
  )
}
