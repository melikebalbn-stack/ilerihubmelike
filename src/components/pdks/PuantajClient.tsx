'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, CalendarDays, Clock, Download, Loader2, Lock, LockOpen, RefreshCw, Search, UserCheck, UserX, AlertTriangle, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

type Durum = 'TAM' | 'TAM_FORMLA' | 'EKSIK_GIRIS' | 'EKSIK_CIKIS' | 'GELMEDI' | 'TATIL' | 'HAFTA_SONU' | 'MESAI' | 'BEKLENMIYOR'
type Satir = {
  personnelId: string; sicil: string | null; adSoyad: string; departman: string | null; vardiya: string | null
  ilkGiris: string | null; sonCikis: string | null; girisKaynak: string | null; cikisKaynak: string | null
  gecDakika: number; erkenCikisDakika: number; calismaDakika: number | null; fiiliDakika: number | null; onayliMesaiDakika: number | null
  durum: Durum; uyarilar: string[]; kilitli: boolean
}
type Veri = {
  gun: string
  satirlar: Satir[]
  ozet: { beklenen: number; tam: number; eksik: number; gelmedi: number; gec: number }
  meta: { kayit: number; aktifPersonel: number; hesaplanmamis: number; sonHesaplama: string | null; kuralSurumleri: number[]; guncelKuralSurumu: number; kilitli: boolean; kismenKilitli: boolean }
  departmanlar: { id: string; name: string }[]
}

// Renk dili: mavi = tam, turuncu = eksik/geç/uyarı, gri = gelmedi/pasif/çalışılmayan gün. Kırmızı-yeşil YOK.
const DURUM: Record<Durum, { etiket: string; sinif: string }> = {
  TAM: { etiket: 'Tam', sinif: 'border-blue-200 bg-blue-50 text-blue-800' },
  TAM_FORMLA: { etiket: 'Tam (formla)', sinif: 'border-blue-200 bg-white text-blue-800' },
  MESAI: { etiket: 'Mesai (form)', sinif: 'border-blue-300 bg-blue-100 text-blue-900' },
  EKSIK_GIRIS: { etiket: 'Eksik giriş', sinif: 'border-amber-300 bg-amber-50 text-amber-900' },
  EKSIK_CIKIS: { etiket: 'Eksik çıkış', sinif: 'border-amber-300 bg-amber-50 text-amber-900' },
  GELMEDI: { etiket: 'Gelmedi · izin bilgisi yok', sinif: 'border-slate-300 bg-slate-100 text-slate-700' },
  TATIL: { etiket: 'Tatil', sinif: 'border-slate-200 bg-white text-slate-500' },
  HAFTA_SONU: { etiket: 'Hafta sonu', sinif: 'border-slate-200 bg-white text-slate-500' },
  BEKLENMIYOR: { etiket: 'Beklenmiyor', sinif: 'border-slate-200 bg-white text-slate-400' },
}
const saat = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' }) : '—'
const sure = (dk: number | null) => (dk === null ? '—' : `${Math.floor(dk / 60)} sa ${String(dk % 60).padStart(2, '0')} dk`)
const bugun = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10)

export function PuantajClient({ canManage }: { canManage: boolean }) {
  const [gun, setGun] = useState(bugun())
  const [dep, setDep] = useState('HEPSI')
  const [arama, setArama] = useState('')
  const [q, setQ] = useState('')
  const [veri, setVeri] = useState<Veri | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [mesaj, setMesaj] = useState<string | null>(null)
  const [isliyor, setIsliyor] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setQ(arama.trim()), 300)
    return () => clearTimeout(t)
  }, [arama])

  const yukle = useCallback(async () => {
    const p = new URLSearchParams({ gun, q })
    if (dep !== 'HEPSI') p.set('departmentId', dep)
    try {
      const r = await fetch(`/api/pdks/puantaj?${p}`, { cache: 'no-store' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || d.ok === false) return setHata(d.error ?? 'Puantaj alınamadı')
      setHata(null)
      setVeri(d)
    } catch {
      setHata('Sunucuya ulaşılamadı')
    }
  }, [gun, dep, q])
  useEffect(() => void yukle(), [yukle])

  const islem = async (url: string, govde: unknown, basari: (d: Record<string, unknown>) => string) => {
    setIsliyor(true)
    setMesaj(null)
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(govde) })
      const d = await r.json().catch(() => ({}))
      setMesaj(!r.ok || d.ok === false ? `Hata: ${d.error ?? 'işlem başarısız'}` : basari(d))
      await yukle()
    } finally {
      setIsliyor(false)
    }
  }
  const excel = (p: Record<string, string>) => {
    const s = new URLSearchParams(p)
    if (dep !== 'HEPSI') s.set('departmentId', dep)
    window.location.href = `/api/pdks/puantaj/excel?${s}`
  }

  const o = veri?.ozet
  const m = veri?.meta

  return (
    <div className="space-y-5">
      {/* Üst satır */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4 text-slate-500" />
          <Input type="date" value={gun} max={bugun()} onChange={(e) => e.target.value && setGun(e.target.value)} className="w-40" />
        </div>
        <Select value={dep} onValueChange={setDep}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Departman" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="HEPSI">Tüm departmanlar</SelectItem>
            {(veri?.departmanlar ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input value={arama} onChange={(e) => setArama(e.target.value)} placeholder="Sicil veya ad" className="pl-8" />
        </div>
        <div className="ml-auto inline-flex overflow-hidden rounded-lg border border-[#1B4F72] text-sm">
          <span className="bg-white px-3 py-1.5 font-medium text-[#1B4F72]">{m?.kayit ?? '…'} kişi</span>
          <button onClick={() => excel({ gun })} className="inline-flex items-center gap-1 border-l border-[#1B4F72] bg-[#1B4F72] px-3 py-1.5 font-medium text-white hover:bg-[#154360]">
            Excel&apos;e aktar <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
        <Button variant="outline" size="sm" onClick={() => excel({ ay: gun.slice(0, 7) })} title="Seçili günün ayı — kişi özeti + günlük detay">
          <Download className="mr-1 h-4 w-4" /> Aylık Excel ({gun.slice(0, 7)})
        </Button>
      </div>

      {/* 5 özet kart */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Ozet ikon={<Users className="h-4 w-4" />} baslik="Beklenen" deger={o?.beklenen} ton="gri" />
        <Ozet ikon={<UserCheck className="h-4 w-4" />} baslik="Tam" deger={o?.tam} ton="mavi" />
        <Ozet ikon={<AlertTriangle className="h-4 w-4" />} baslik="Eksik okutma" deger={o?.eksik} ton="turuncu" />
        <Ozet ikon={<UserX className="h-4 w-4" />} baslik="Gelmedi" deger={o?.gelmedi} ton="gri" />
        <Ozet ikon={<Clock className="h-4 w-4" />} baslik="Geç kalan" deger={o?.gec} ton="turuncu" />
      </div>

      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" disabled={isliyor || gun > bugun()}
            onClick={() => islem('/api/pdks/puantaj/hesapla', { gun }, (d) => `${gun}: ${d.yazilan} kişi hesaplandı${Number(d.kilitliAtlanan) ? `, ${d.kilitliAtlanan} kilitli atlandı` : ''}${(d.vardiyasiz as string[] | undefined)?.length ? ` · vardiyasız: ${(d.vardiyasiz as string[]).join(', ')}` : ''}`)}>
            {isliyor ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />} Yeniden hesapla
          </Button>
          {m?.kilitli ? (
            <Button size="sm" variant="outline" disabled={isliyor} onClick={() => confirm(`${gun} kilidi açılsın mı? (denetim kaydına yazılır)`) && islem('/api/pdks/puantaj/kilit', { bas: gun, bit: gun, kilitli: false }, (d) => `${d.adet} satırın kilidi açıldı`)}>
              <LockOpen className="mr-1 h-4 w-4" /> Kilidi aç
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled={isliyor || !m?.kayit} onClick={() => confirm(`${gun} kilitlensin mi? Kilitli gün yeniden hesaplanmaz.`) && islem('/api/pdks/puantaj/kilit', { bas: gun, bit: gun, kilitli: true }, (d) => `${d.adet} satır kilitlendi`)}>
              <Lock className="mr-1 h-4 w-4" /> Günü kilitle
            </Button>
          )}
          {mesaj && <span className={cn('text-sm', mesaj.startsWith('Hata') ? 'text-amber-800' : 'text-slate-600')}>{mesaj}</span>}
        </div>
      )}

      {hata && <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">{hata}</div>}

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Sicil</th>
              <th className="px-3 py-2">Ad Soyad</th>
              <th className="px-3 py-2">Departman</th>
              <th className="px-3 py-2">Vardiya</th>
              <th className="px-3 py-2">İlk giriş</th>
              <th className="px-3 py-2">Son çıkış</th>
              <th className="px-3 py-2 text-right">Geç</th>
              <th className="px-3 py-2 text-right">Erken</th>
              <th className="px-3 py-2 text-right">Çalışma</th>
              <th className="px-3 py-2">Durum</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {veri?.satirlar.map((s) => (
              <tr key={s.personnelId} className="border-t">
                <td className="whitespace-nowrap px-3 py-1.5">{s.sicil ?? '—'}</td>
                <td className="px-3 py-1.5">{s.adSoyad}</td>
                <td className="px-3 py-1.5 text-slate-600">{s.departman ?? '—'}</td>
                <td className="whitespace-nowrap px-3 py-1.5 text-xs text-slate-500">{s.vardiya ?? '—'}</td>
                <td className="whitespace-nowrap px-3 py-1.5 font-mono tabular-nums">{saat(s.ilkGiris)}{s.girisKaynak === 'FORM' && <sup className="ml-0.5 text-blue-700" title="Kart okutamama formundan">F</sup>}</td>
                <td className="whitespace-nowrap px-3 py-1.5 font-mono tabular-nums">{saat(s.sonCikis)}{s.cikisKaynak === 'FORM' && <sup className="ml-0.5 text-blue-700" title="Kart okutamama formundan">F</sup>}</td>
                <td className={cn('px-3 py-1.5 text-right tabular-nums', s.gecDakika > 0 && 'font-medium text-amber-800')}>{s.gecDakika || '—'}</td>
                <td className={cn('px-3 py-1.5 text-right tabular-nums', s.erkenCikisDakika > 0 && 'font-medium text-amber-800')}>{s.erkenCikisDakika || '—'}</td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums" title={s.fiiliDakika !== null ? `Fiili turnike: ${sure(s.fiiliDakika)}${s.onayliMesaiDakika !== null ? ` · mesai formu: ${sure(s.onayliMesaiDakika)}` : ''}` : undefined}>
                  {sure(s.calismaDakika)}
                  {s.onayliMesaiDakika !== null && <div className="text-[11px] text-slate-500">form {sure(s.onayliMesaiDakika)} · turnike {sure(s.fiiliDakika)}</div>}
                </td>
                <td className="px-3 py-1.5">
                  <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs', DURUM[s.durum].sinif)}>
                    {s.kilitli && <Lock className="h-3 w-3" />}
                    {DURUM[s.durum].etiket}
                  </span>
                  {s.uyarilar.includes('GUN_SURUYOR') && <div className="text-[11px] text-slate-500">gün sürüyor</div>}
                  {s.uyarilar.includes('KART_OKUTAMAMA_ONAY_BEKLIYOR') && <div className="text-[11px] text-amber-800">form onay bekliyor</div>}
                </td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right text-xs">
                  {(s.durum === 'EKSIK_GIRIS' || s.durum === 'EKSIK_CIKIS') && !s.uyarilar.includes('GUN_SURUYOR') && (
                    <Link href="/forms/toplu-kart-okutamama" className="inline-flex items-center gap-0.5 font-medium text-[#1B4F72] hover:underline">
                      Kart okutamama formu aç <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                  {s.durum === 'TAM_FORMLA' && <span className="text-blue-800">Formla tamamlandı</span>}
                </td>
              </tr>
            ))}
            {veri && veri.satirlar.length === 0 && (
              <tr><td colSpan={11} className="px-3 py-10 text-center text-slate-400">
                Bu gün için hesaplanmış puantaj yok{canManage ? ' — “Yeniden hesapla” ile hesaplayın' : ''}
              </td></tr>
            )}
            {!veri && !hata && <tr><td colSpan={11} className="px-3 py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></td></tr>}
          </tbody>
        </table>
        {m && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t px-3 py-2 text-xs text-slate-500">
            <span>{m.kayit} kayıt{m.hesaplanmamis > 0 && ` · ${m.hesaplanmamis} aktif personel hesaplanmamış`}</span>
            <span>son hesaplama {m.sonHesaplama ? new Date(m.sonHesaplama).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }) : '—'}</span>
            <span className={cn(m.kuralSurumleri.some((k) => k !== m.guncelKuralSurumu) && 'font-medium text-amber-800')}>
              kural sürümü {m.kuralSurumleri.length ? m.kuralSurumleri.join(', ') : '—'} (güncel {m.guncelKuralSurumu})
            </span>
            <span className="inline-flex items-center gap-1">
              {m.kilitli ? <><Lock className="h-3 w-3" /> kilitli</> : m.kismenKilitli ? 'kısmen kilitli' : 'kilitsiz'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function Ozet({ ikon, baslik, deger, ton }: { ikon: React.ReactNode; baslik: string; deger?: number; ton: 'mavi' | 'turuncu' | 'gri' }) {
  return (
    <Card className="shadow-none">
      <CardContent className="p-4">
        <div className={cn('flex items-center gap-1.5 text-xs font-medium', ton === 'mavi' && 'text-blue-700', ton === 'turuncu' && 'text-amber-700', ton === 'gri' && 'text-slate-500')}>
          {ikon}{baslik}
        </div>
        <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{deger ?? '—'}</div>
      </CardContent>
    </Card>
  )
}
