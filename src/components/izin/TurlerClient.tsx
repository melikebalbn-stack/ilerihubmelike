'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Lock, Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

type Tur = {
  id: string
  kod: string
  ad: string
  yasal: boolean
  bakiyeli: boolean
  sabitGun: number | null
  gunSayimi: 'IS_GUNU' | 'TAKVIM_GUNU'
  ucretli: boolean
  yarimGunOlur: boolean
  onayAkisi: 'YONETICI_IV' | 'YALNIZ_IV'
  belgeZorunlu: boolean
  ozelNitelikli: boolean
  pdksEtiketi: string
  aktif: boolean
  sira: number
  talepSayisi: number
}

async function istek<T = Record<string, unknown>>(url: string, init?: RequestInit): Promise<{ ok: boolean; veri: T & { error?: string } }> {
  try {
    const r = await fetch(url, { cache: 'no-store', ...init })
    const veri = (await r.json().catch(() => ({}))) as T & { error?: string; ok?: boolean }
    return { ok: r.ok && veri.ok !== false, veri }
  } catch {
    return { ok: false, veri: { error: 'Sunucuya ulaşılamadı' } as T & { error?: string } }
  }
}

function Rozet({ ton, children }: { ton: 'mavi' | 'turuncu' | 'gri'; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
      ton === 'mavi' && 'border-blue-200 bg-blue-50 text-blue-800',
      ton === 'turuncu' && 'border-amber-200 bg-amber-50 text-amber-800',
      ton === 'gri' && 'border-slate-200 bg-slate-100 text-slate-600')}>
      {children}
    </span>
  )
}

const sure = (t: Tur) =>
  t.bakiyeli ? 'Bakiyeden' : t.sabitGun ? (t.sabitGun % 7 === 0 && t.sabitGun >= 56 ? `${t.sabitGun / 7} hafta` : `${t.sabitGun} gün`) : 'Sınırsız'

export function TurlerClient({ canManage }: { canManage: boolean }) {
  const [turler, setTurler] = useState<Tur[] | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [duzenle, setDuzenle] = useState<Tur | 'YENI' | null>(null)

  const yukle = useCallback(async () => {
    const { ok, veri } = await istek<{ turler: Tur[] }>('/api/izin/turler')
    if (ok) { setTurler(veri.turler); setHata(null) } else setHata(veri.error ?? 'Türler alınamadı')
  }, [])
  useEffect(() => void yukle(), [yukle])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-slate-500">Yasal türler 4857 sayılı İş Kanunu&apos;ndan gelir ve kilitlidir. Şirkete özel türler bakiyeden düşmez; ekip ve yöneticiye yalnız &quot;İzinli&quot; olarak görünür.</p>
        {canManage && (
          <Button className="ml-auto" onClick={() => setDuzenle('YENI')}>
            <Plus className="mr-1 h-4 w-4" /> Şirkete özel tür
          </Button>
        )}
      </div>
      {hata && <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">{hata}</div>}
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Tür</th>
              <th className="px-3 py-2 font-medium">Süre</th>
              <th className="px-3 py-2 font-medium">Sayım</th>
              <th className="px-3 py-2 font-medium">Yarım gün</th>
              <th className="px-3 py-2 font-medium">Onay</th>
              <th className="px-3 py-2 font-medium">Ücret</th>
              <th className="px-3 py-2 font-medium">Durum</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {turler?.map((t) => (
              <tr key={t.id} className={cn('border-t align-middle', !t.aktif && 'text-slate-400')}>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2 font-medium">
                    {t.ad}
                    {t.yasal && <Rozet ton="gri"><Lock className="h-3 w-3" />yasal</Rozet>}
                    {t.ozelNitelikli && <Rozet ton="turuncu">belge · özel nitelikli</Rozet>}
                  </div>
                  <div className="font-mono text-xs text-slate-400">{t.kod}</div>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">{sure(t)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{t.gunSayimi === 'TAKVIM_GUNU' ? 'Takvim günü' : 'İş günü'}</td>
                <td className="px-3 py-2.5 text-slate-600">{t.yarimGunOlur ? 'Olur' : '—'}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{t.onayAkisi === 'YALNIZ_IV' ? 'Yalnız İV' : 'Yönetici → İV'}</td>
                <td className="px-3 py-2.5 text-slate-600">{t.ucretli ? 'Ücretli' : 'Ücretsiz'}</td>
                <td className="px-3 py-2.5">{t.aktif ? <Rozet ton="mavi">Aktif</Rozet> : <Rozet ton="gri">Pasif</Rozet>}</td>
                <td className="px-3 py-2.5 text-right">
                  {canManage && !t.yasal && (
                    <Button variant="ghost" size="sm" onClick={() => setDuzenle(t)} aria-label={`${t.ad} düzenle`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {!turler && !hata && (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-slate-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
            )}
          </tbody>
        </table>
      </div>
      {canManage && <TurDialog tur={duzenle} kapat={() => setDuzenle(null)} bitti={yukle} />}
    </div>
  )
}

function TurDialog({ tur, kapat, bitti }: { tur: Tur | 'YENI' | null; kapat: () => void; bitti: () => void }) {
  const yeni = tur === 'YENI'
  const [f, setF] = useState({ kod: '', ad: '', sabitGun: '', gunSayimi: 'IS_GUNU', ucretli: true, yarimGunOlur: false, aktif: true })
  const [hata, setHata] = useState<string | null>(null)
  const [kaydediliyor, setKaydediliyor] = useState(false)
  useEffect(() => {
    setHata(null)
    if (tur && tur !== 'YENI') setF({ kod: tur.kod, ad: tur.ad, sabitGun: tur.sabitGun ? String(tur.sabitGun) : '', gunSayimi: tur.gunSayimi, ucretli: tur.ucretli, yarimGunOlur: tur.yarimGunOlur, aktif: tur.aktif })
    else setF({ kod: '', ad: '', sabitGun: '', gunSayimi: 'IS_GUNU', ucretli: true, yarimGunOlur: false, aktif: true })
  }, [tur])

  const kaydet = async () => {
    if (!tur) return
    setKaydediliyor(true)
    const { ok, veri } = await istek(yeni ? '/api/izin/turler' : `/api/izin/turler/${tur.id}`, {
      method: yeni ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(f),
    })
    setKaydediliyor(false)
    if (!ok) return setHata(veri.error ?? 'Kaydedilemedi')
    kapat()
    bitti()
  }

  const Onay = ({ ad, alan }: { ad: string; alan: 'ucretli' | 'yarimGunOlur' | 'aktif' }) => (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={f[alan]} onChange={(e) => setF({ ...f, [alan]: e.target.checked })} className="h-4 w-4 accent-[#1B4F72]" />
      {ad}
    </label>
  )

  return (
    <Dialog open={!!tur} onOpenChange={(o) => !o && kapat()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{yeni ? 'Şirkete özel izin türü' : 'Türü düzenle'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Kod</Label>
            <Input value={f.kod} onChange={(e) => setF({ ...f, kod: e.target.value.toUpperCase() })} disabled={!yeni} placeholder="DOGUM_GUNU" className="mt-1 font-mono" />
            {yeni && <p className="mt-1 text-xs text-slate-500">Kaydedildikten sonra değişmez.</p>}
          </div>
          <div>
            <Label>Ad</Label>
            <Input value={f.ad} onChange={(e) => setF({ ...f, ad: e.target.value })} placeholder="Doğum günü izni" className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Süre (gün)</Label>
              <Input value={f.sabitGun} onChange={(e) => setF({ ...f, sabitGun: e.target.value.replace(/\D/g, '') })} placeholder="boş = sınırsız" className="mt-1" inputMode="numeric" />
            </div>
            <div>
              <Label>Sayım</Label>
              <Select value={f.gunSayimi} onValueChange={(v) => setF({ ...f, gunSayimi: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="IS_GUNU">İş günü</SelectItem>
                  <SelectItem value="TAKVIM_GUNU">Takvim günü</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <Onay ad="Ücretli" alan="ucretli" />
            <Onay ad="Yarım gün olur" alan="yarimGunOlur" />
            {!yeni && <Onay ad="Aktif" alan="aktif" />}
          </div>
          <p className="text-xs text-slate-500">Onay akışı Yönetici → İV. Bakiyeden düşmez, belge istemez.</p>
          {hata && <p className="text-sm text-amber-800">{hata}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={kapat}>Vazgeç</Button>
          <Button onClick={kaydet} disabled={kaydediliyor || f.ad.trim().length < 2 || (yeni && f.kod.length < 2)}>Kaydet</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
