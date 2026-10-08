'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, Send, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'

type Satir = {
  personnelId: string
  sicil: string | null
  adSoyad: string
  calismaSaat: number
  fazlaMesaiSaat: number
  geceSaat: number
  normalGun: number
  mesaiGun: number
  haftaTatiliGun: number
  resmiTatilGun: number
  izinGun: number
  raporGun: number
  eksikGun: number
  eksikKayitGun: number
  durum: string
  ifsHata: string | null
  gonderilenAt: string | null
}
type Veri = { donem: string; satirlar: Satir[]; gonderilen?: number; hatali?: number }

const buAy = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 7)
const s1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('tr-TR')

const DURUM_RENK: Record<string, string> = {
  HAZIR: 'border-slate-300 bg-slate-50 text-slate-700',
  GONDERILDI: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  HATA: 'border-red-300 bg-red-50 text-red-800',
}

export function IfsAktarimClient() {
  const [donem, setDonem] = useState(buAy())
  const [veri, setVeri] = useState<Veri | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [mesaj, setMesaj] = useState<string | null>(null)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [islemde, setIslemde] = useState(false)

  const oku = useCallback(() => {
    setYukleniyor(true)
    setHata(null)
    fetch(`/api/pdks/ifs-aktarim?donem=${donem}`)
      .then((r) => r.json())
      .then((j) => (j.ok ? setVeri(j as Veri) : setHata(j.error ?? 'Veri alınamadı')))
      .catch(() => setHata('Veri alınamadı'))
      .finally(() => setYukleniyor(false))
  }, [donem])

  useEffect(() => oku(), [oku])

  const calistir = (aksiyon: 'hesapla' | 'gonder') => {
    setIslemde(true)
    setHata(null)
    setMesaj(null)
    fetch('/api/pdks/ifs-aktarim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aksiyon, donem }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) return setHata(j.error ?? 'İşlem başarısız')
        setVeri(j as Veri)
        if (aksiyon === 'hesapla') setMesaj(`${(j as Veri).satirlar.length} kişi hesaplandı.`)
        else setMesaj(`Gönderilen: ${j.gonderilen ?? 0} · Hatalı: ${j.hatali ?? 0}`)
      })
      .catch(() => setHata('İşlem başarısız'))
      .finally(() => setIslemde(false))
  }

  const satirlar = veri?.satirlar ?? []
  const bekleyen = satirlar.filter((s) => s.durum !== 'GONDERILDI').length
  const eksikKayitVar = satirlar.some((s) => s.eksikKayitGun > 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Dönem</span>
          <Input type="month" value={donem} onChange={(e) => setDonem(e.target.value)} className="w-44" />
        </label>
        <Button size="sm" variant="outline" onClick={() => calistir('hesapla')} disabled={islemde || yukleniyor}>
          {islemde ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />} Hesapla / Yenile
        </Button>
        <Button size="sm" onClick={() => calistir('gonder')} disabled={islemde || yukleniyor || bekleyen === 0}>
          {islemde ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />} IFS&apos;e Gönder ({bekleyen})
        </Button>
      </div>

      <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
        <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
        Yalnızca <strong>devam (gün/saat)</strong> bilgisi aktarılır. Maaş, ücret, ek ödeme ve kesinti Hub&apos;da
        tutulmaz ve IFS&apos;e Hub&apos;dan yazılmaz.
      </div>

      {eksikKayitVar && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          Bazı kişilerde forma bağlı eksik kayıt var (eksik giriş/çıkış). Önce Kart Okutamama formları onaylanmalı,
          sonra yeniden hesaplanmalı — aksi halde devam eksik gider.
        </div>
      )}

      {mesaj && <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">{mesaj}</div>}
      {hata && <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{hata}</div>}

      {yukleniyor ? (
        <div className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor…</div>
      ) : satirlar.length === 0 ? (
        <div className="rounded-lg border p-4 text-sm text-slate-600">
          Bu dönem için hesaplanmış kayıt yok. &quot;Hesapla / Yenile&quot; ile PDKS&apos;ten üret.
        </div>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="px-3 py-2 font-medium">Personel</th>
                  <th className="px-3 py-2 font-medium">Sicil</th>
                  <th className="px-3 py-2 text-right font-medium">Çalışma s.</th>
                  <th className="px-3 py-2 text-right font-medium">Fazla m. s.</th>
                  <th className="px-3 py-2 text-right font-medium">Gece s.</th>
                  <th className="px-3 py-2 text-right font-medium">Normal g.</th>
                  <th className="px-3 py-2 text-right font-medium">H.tatili</th>
                  <th className="px-3 py-2 text-right font-medium">R.tatil</th>
                  <th className="px-3 py-2 text-right font-medium">İzin</th>
                  <th className="px-3 py-2 text-right font-medium">Rapor</th>
                  <th className="px-3 py-2 text-right font-medium">Devamsız</th>
                  <th className="px-3 py-2 font-medium">Durum</th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((s) => (
                  <tr key={s.personnelId} className="border-b last:border-0">
                    <td className="px-3 py-2 text-slate-800">{s.adSoyad}</td>
                    <td className="px-3 py-2 text-slate-500">{s.sicil ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s1(s.calismaSaat)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s1(s.fazlaMesaiSaat)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s1(s.geceSaat)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.normalGun}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.haftaTatiliGun}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.resmiTatilGun}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s1(s.izinGun)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s1(s.raporGun)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.eksikGun}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full border px-2 py-0.5 text-xs ${DURUM_RENK[s.durum] ?? DURUM_RENK.HAZIR}`}>
                        {s.durum === 'GONDERILDI' ? 'Gönderildi' : s.durum === 'HATA' ? 'Hata' : 'Hazır'}
                      </span>
                      {s.ifsHata && <div className="mt-0.5 max-w-[16rem] truncate text-xs text-red-600" title={s.ifsHata}>{s.ifsHata}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
