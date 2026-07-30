'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  gunDurumu,
  tarihAnahtari,
  IPRO_TATIL_TIPLERI,
  TATIL_RENK,
  type IproTatilTip,
} from '@/lib/ipro/takvim-util'

type Vardiya = {
  id: string
  kod: string
  ad: string
  baslangicSaat: string
  bitisSaat: string
  ertesiGuneTasar: boolean
  sira: number
  aktif: boolean
}
type Tatil = { id: string; tarih: string; tip: IproTatilTip; aciklama: string; yil: number }

const AY_ADLARI = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
const GUN_ADLARI = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const TIP_ETIKET: Record<IproTatilTip, string> = { TATIL: 'Tatil', YARIM: 'Yarım Gün', MESAI: 'Mesai (çalışılan)' }

async function jsonFetch<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: 'no-store' })
    if (!r.ok) return null
    return (await r.json()) as T
  } catch {
    return null
  }
}

export function TakvimClient({ canEditVardiya, canEditTakvim }: { canEditVardiya: boolean; canEditTakvim: boolean }) {
  return (
    <Tabs defaultValue="takvim">
      <TabsList>
        <TabsTrigger value="takvim">Çalışma Takvimi</TabsTrigger>
        <TabsTrigger value="vardiya">Vardiyalar</TabsTrigger>
      </TabsList>
      <TabsContent value="takvim" className="mt-4">
        <TakvimBolumu canEdit={canEditTakvim} />
      </TabsContent>
      <TabsContent value="vardiya" className="mt-4">
        <VardiyaBolumu canEdit={canEditVardiya} />
      </TabsContent>
    </Tabs>
  )
}

// ── Vardiyalar ──
function VardiyaBolumu({ canEdit }: { canEdit: boolean }) {
  const [liste, setListe] = useState<Vardiya[]>([])
  const [duzen, setDuzen] = useState<Vardiya | null>(null)
  const [hata, setHata] = useState<string | null>(null)

  const yukle = useCallback(async () => {
    const d = await jsonFetch<{ vardiyalar: Vardiya[] }>('/api/ipro/vardiya')
    if (d) setListe(d.vardiyalar)
  }, [])
  useEffect(() => void yukle(), [yukle])

  const kaydet = async () => {
    if (!duzen) return
    setHata(null)
    const yeni = !duzen.id
    const r = await fetch(yeni ? '/api/ipro/vardiya' : `/api/ipro/vardiya/${duzen.id}`, {
      method: yeni ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(duzen),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) return setHata(d?.error ?? 'Kaydedilemedi')
    setDuzen(null)
    void yukle()
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <Button
          size="sm"
          onClick={() => setDuzen({ id: '', kod: '', ad: '', baslangicSaat: '07:00', bitisSaat: '17:00', ertesiGuneTasar: false, sira: 0, aktif: true })}
        >
          <Plus className="mr-1 h-4 w-4" /> Vardiya Ekle
        </Button>
      )}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-3 py-2">Kod</th>
              <th className="px-3 py-2">Ad</th>
              <th className="px-3 py-2">Saat</th>
              <th className="px-3 py-2">Ertesi Gün</th>
              <th className="px-3 py-2">Durum</th>
              {canEdit && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {liste.map((v) => (
              <tr key={v.id} className="border-t">
                <td className="px-3 py-2 font-medium">{v.kod}</td>
                <td className="px-3 py-2">{v.ad}</td>
                <td className="px-3 py-2">{v.baslangicSaat}–{v.bitisSaat}</td>
                <td className="px-3 py-2">{v.ertesiGuneTasar ? 'Evet' : '—'}</td>
                <td className="px-3 py-2"><Badge variant={v.aktif ? 'default' : 'secondary'}>{v.aktif ? 'Aktif' : 'Pasif'}</Badge></td>
                {canEdit && (
                  <td className="px-3 py-2 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setDuzen({ ...v })}><Pencil className="h-4 w-4" /></Button>
                  </td>
                )}
              </tr>
            ))}
            {liste.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">Vardiya tanımı yok</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!duzen} onOpenChange={(o) => !o && setDuzen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{duzen?.id ? 'Vardiya Düzenle' : 'Vardiya Ekle'}</DialogTitle></DialogHeader>
          {duzen && (
            <div className="space-y-3">
              <div><Label>Kod</Label><Input value={duzen.kod} onChange={(e) => setDuzen({ ...duzen, kod: e.target.value })} placeholder="VARDIYA-1" /></div>
              <div><Label>Ad</Label><Input value={duzen.ad} onChange={(e) => setDuzen({ ...duzen, ad: e.target.value })} placeholder="1. Vardiya" /></div>
              <div className="flex gap-3">
                <div className="flex-1"><Label>Başlangıç</Label><Input value={duzen.baslangicSaat} onChange={(e) => setDuzen({ ...duzen, baslangicSaat: e.target.value })} placeholder="07:00" /></div>
                <div className="flex-1"><Label>Bitiş</Label><Input value={duzen.bitisSaat} onChange={(e) => setDuzen({ ...duzen, bitisSaat: e.target.value })} placeholder="17:00" /></div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Ertesi güne taşar (gece vardiyası)</Label>
                <Switch checked={duzen.ertesiGuneTasar} onCheckedChange={(c) => setDuzen({ ...duzen, ertesiGuneTasar: c })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Aktif</Label>
                <Switch checked={duzen.aktif} onCheckedChange={(c) => setDuzen({ ...duzen, aktif: c })} />
              </div>
              {hata && <p className="text-sm text-red-600">{hata}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDuzen(null)}>İptal</Button>
            <Button onClick={kaydet}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Çalışma takvimi (aylık) ──
function TakvimBolumu({ canEdit }: { canEdit: boolean }) {
  const bugun = useMemo(() => new Date(), [])
  const [yil, setYil] = useState(bugun.getUTCFullYear())
  const [ay, setAy] = useState(bugun.getUTCMonth()) // 0-11
  const [tatiller, setTatiller] = useState<Tatil[]>([])
  const [ekle, setEkle] = useState<{ tarih: string; tip: IproTatilTip; aciklama: string } | null>(null)
  const [hata, setHata] = useState<string | null>(null)

  const yukle = useCallback(async () => {
    const d = await jsonFetch<{ tatiller: Tatil[] }>(`/api/ipro/tatil?yil=${yil}`)
    if (d) setTatiller(d.tatiller)
  }, [yil])
  useEffect(() => void yukle(), [yukle])

  const tatilMap = useMemo(() => {
    const m = new Map<string, IproTatilTip>()
    for (const t of tatiller) m.set(t.tarih.slice(0, 10), t.tip)
    return m
  }, [tatiller])
  const kayitByGun = useMemo(() => {
    const m = new Map<string, Tatil>()
    for (const t of tatiller) m.set(t.tarih.slice(0, 10), t)
    return m
  }, [tatiller])

  // Ayın günlerini Pazartesi-başlangıçlı ızgaraya diz.
  const hucreler = useMemo(() => {
    const ilk = new Date(Date.UTC(yil, ay, 1))
    const bosOncesi = (ilk.getUTCDay() + 6) % 7 // Pzt=0
    const gunSayisi = new Date(Date.UTC(yil, ay + 1, 0)).getUTCDate()
    const arr: (Date | null)[] = []
    for (let i = 0; i < bosOncesi; i++) arr.push(null)
    for (let g = 1; g <= gunSayisi; g++) arr.push(new Date(Date.UTC(yil, ay, g)))
    return arr
  }, [yil, ay])

  const ayDegis = (delta: number) => {
    const yeni = ay + delta
    if (yeni < 0) { setAy(11); setYil(yil - 1) }
    else if (yeni > 11) { setAy(0); setYil(yil + 1) }
    else setAy(yeni)
  }

  const tatilKaydet = async () => {
    if (!ekle) return
    setHata(null)
    const r = await fetch('/api/ipro/tatil', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ekle),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) return setHata(d?.error ?? 'Kaydedilemedi')
    setEkle(null); void yukle()
  }
  const tatilSil = async (id: string) => {
    await fetch(`/api/ipro/tatil/${id}`, { method: 'DELETE' })
    void yukle()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => ayDegis(-1)}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="min-w-40 text-center text-lg font-semibold">{AY_ADLARI[ay]} {yil}</span>
        <Button variant="outline" size="icon" onClick={() => ayDegis(1)}><ChevronRight className="h-4 w-4" /></Button>
        <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
          <LegendNokta renk={TATIL_RENK.TATIL} ad="Tatil" />
          <LegendNokta renk={TATIL_RENK.YARIM} ad="Yarım" />
          <LegendNokta renk={TATIL_RENK.MESAI} ad="Mesai" />
          <span className="text-slate-400">Pazar otomatik tatil</span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {GUN_ADLARI.map((g) => <div key={g} className="py-1 text-center text-xs font-medium text-slate-400">{g}</div>)}
        {hucreler.map((d, i) => {
          if (!d) return <div key={i} />
          const anahtar = tarihAnahtari(d)
          const durum = gunDurumu(d, tatilMap)
          const kayit = kayitByGun.get(anahtar)
          const renk = TATIL_RENK[durum]
          return (
            <button
              key={i}
              disabled={!canEdit}
              onClick={() => canEdit && setEkle({ tarih: anahtar, tip: kayit?.tip ?? 'TATIL', aciklama: kayit?.aciklama ?? '' })}
              className={`min-h-16 rounded border p-1.5 text-left ${canEdit ? 'hover:ring-2 hover:ring-[#1B4F72]/30' : ''}`}
              style={{ backgroundColor: durum === 'CALISMA' ? 'transparent' : `${renk}22`, borderColor: durum === 'CALISMA' ? undefined : renk }}
            >
              <div className="text-sm font-medium">{d.getUTCDate()}</div>
              {kayit && <div className="mt-0.5 truncate text-[10px]" style={{ color: renk }}>{kayit.aciklama}</div>}
              {!kayit && durum === 'TATIL' && <div className="mt-0.5 text-[10px] text-slate-400">Pazar</div>}
            </button>
          )
        })}
      </div>

      <Dialog open={!!ekle} onOpenChange={(o) => !o && setEkle(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Çalışma Takvimi — {ekle?.tarih}</DialogTitle></DialogHeader>
          {ekle && (
            <div className="space-y-3">
              <div>
                <Label>Tip</Label>
                <Select value={ekle.tip} onValueChange={(v) => setEkle({ ...ekle, tip: v as IproTatilTip })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {IPRO_TATIL_TIPLERI.map((t) => <SelectItem key={t} value={t}>{TIP_ETIKET[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Açıklama</Label><Input value={ekle.aciklama} onChange={(e) => setEkle({ ...ekle, aciklama: e.target.value })} placeholder="Resmi Tatil / Bayram / vb." /></div>
              {hata && <p className="text-sm text-red-600">{hata}</p>}
            </div>
          )}
          <DialogFooter className="flex items-center justify-between">
            {ekle && kayitByGun.get(ekle.tarih) && (
              <Button variant="ghost" className="text-red-600" onClick={() => { const k = kayitByGun.get(ekle.tarih); if (k) { void tatilSil(k.id); setEkle(null) } }}>
                <Trash2 className="mr-1 h-4 w-4" /> Kaldır
              </Button>
            )}
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" onClick={() => setEkle(null)}>İptal</Button>
              <Button onClick={tatilKaydet}>Kaydet</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function LegendNokta({ renk, ad }: { renk: string; ad: string }) {
  return <span className="flex items-center gap-1"><span className="h-3 w-3 rounded" style={{ backgroundColor: renk }} />{ad}</span>
}
