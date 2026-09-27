'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ArrowUpRight, CalendarClock, Download, Hourglass, Info, Loader2, Search, Sigma, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SplitBadge } from '@/components/ui/split-badge'
import { cn } from '@/lib/utils'

type Ozet = {
  kidemYil: number
  kidemAy: number
  yillikHak: number | null
  kullanilanBuYil: number
  bekleyen: number
  bakiye: number
  kalan: number
  sonraki: { tarih: string; gun: number; ilk: boolean } | null
}
type Satir = { personnelId: string; sicil: string | null; adSoyad: string; departman: string | null; yaka: string; acilisVar: boolean; ozet: Ozet }
type Veri = {
  bugun: string
  gecisTarihi: string | null
  satirlar: Satir[]
  departmanlar: { id: string; name: string }[]
  ozet: { aktifPersonel: number; toplamKalan: number; ivOnayiBekleyen: number; otuzGunuAsan: number }
}
type Hareket = { id: string; hareket: string; gun: number; tarih: string; aciklama: string | null; olusturan: string; zaman: string; talepVar: boolean; bakiye: number }
type Hareketler = { personel: { id: string; sicil: string | null; adSoyad: string; aktif: boolean }; hareketler: Hareket[] }

// Renk dili (PDKS ile aynı): mavi = normal/onaylı, turuncu = bekleyen/uyarı, gri = sıfır/pasif. Kırmızı-yeşil YOK.
const YAKA: Record<string, string> = { MAVI: 'Mavi', BEYAZ: 'Beyaz', GRI: 'Gri' }
const HAREKET: Record<string, string> = { HAK_EDIS: 'Hak ediş', KULLANIM: 'Kullanım', IPTAL_IADE: 'İptal iadesi', ACILIS: 'Açılış', DUZELTME: 'Düzeltme' }

export const gunFmt = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 1 })
const tarihFmt = (iso: string | null) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '—')

async function istek<T = Record<string, unknown>>(url: string, init?: RequestInit): Promise<{ ok: boolean; veri: T & { error?: string } }> {
  try {
    const r = await fetch(url, { cache: 'no-store', ...init })
    const veri = (await r.json().catch(() => ({}))) as T & { error?: string; ok?: boolean }
    return { ok: r.ok && veri.ok !== false, veri }
  } catch {
    return { ok: false, veri: { error: 'Sunucuya ulaşılamadı' } as T & { error?: string } }
  }
}

export function BakiyelerClient({ canBakiyeAdmin }: { canBakiyeAdmin: boolean }) {
  const [durum, setDurum] = useState<'AKTIF' | 'AYRILAN'>('AKTIF')
  const [departmentId, setDepartmentId] = useState('TUMU')
  const [arama, setArama] = useState('')
  const [q, setQ] = useState('')
  const [yakinda, setYakinda] = useState(false)
  const [veri, setVeri] = useState<Veri | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hareketId, setHareketId] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setQ(arama.trim()), 300)
    return () => clearTimeout(t)
  }, [arama])

  const sorgu = `durum=${durum}&departmentId=${departmentId === 'TUMU' ? '' : departmentId}&q=${encodeURIComponent(q)}${yakinda ? '&yakinda=1' : ''}`
  const yukle = useCallback(async () => {
    setYukleniyor(true)
    const { ok, veri: v } = await istek<Veri>(`/api/izin/bakiyeler?${sorgu}`)
    setYukleniyor(false)
    if (!ok) return setHata(v.error ?? 'Bakiyeler alınamadı')
    setHata(null)
    setVeri(v)
  }, [sorgu])
  useEffect(() => void yukle(), [yukle])

  const o = veri?.ozet

  return (
    <div className="space-y-5">
      {/* Başlık satırı sağı: departman · ara · İzin türleri · iki parçalı içe aktarım */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="inline-flex rounded-lg border bg-white p-0.5" role="tablist" aria-label="Personel durumu">
          {(['AKTIF', 'AYRILAN'] as const).map((d) => (
            <button
              key={d}
              role="tab"
              aria-selected={durum === d}
              onClick={() => setDurum(d)}
              className={cn('rounded-md px-3 py-1.5 text-sm transition-colors', durum === d ? 'bg-[#1B4F72] text-white' : 'text-slate-600 hover:bg-slate-100')}
            >
              {d === 'AKTIF' ? 'Aktif' : 'Ayrılanlar'}
            </button>
          ))}
        </div>
        <div className="w-44">
          <Label className="text-xs text-slate-500">Departman</Label>
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger className="mt-1 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TUMU">Tümü</SelectItem>
              {veri?.departmanlar.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Label className="text-xs text-slate-500">Ara</Label>
          <Search className="pointer-events-none absolute left-2.5 top-[34px] h-4 w-4 text-slate-400" />
          <Input value={arama} onChange={(e) => setArama(e.target.value)} placeholder="Sicil veya ad" className="mt-1 bg-white pl-8" />
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/izin/yonetim/turler">İzin türleri</Link>
          </Button>
          {/* Hub kuralı: iki parçalı rozet — solda ne olduğu, sağda eylem */}
          <SplitBadge label="Açılış bakiyesi" action="Excel'den içe aktar" href="/izin/yonetim/ice-aktarim" tone="blue" className="text-sm" />
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {veri?.gecisTarihi ? (
            <>Açılış bakiyeleri <strong>{tarihFmt(veri.gecisTarihi)}</strong> itibarıyla yüklendi; sonraki yıldönümleri otomatik yazılır.</>
          ) : (
            <>İçe aktarım önce deneme olarak çalışır; sonucu görüp onaylamadan hiçbir bakiye yazılmaz. Gerçek aktarım canlıya geçiş günü yapılacak. Açılış yüklenene kadar tablodaki bakiyeler 0 görünür.</>
          )}
        </span>
      </div>

      {/* 4 özet kart */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OzetKart ikon={<Users className="h-4 w-4" />} baslik="Aktif personel" deger={o ? String(o.aktifPersonel) : undefined} ton="mavi" />
        <OzetKart ikon={<Sigma className="h-4 w-4" />} baslik={durum === 'AKTIF' ? 'Toplam kalan yıllık izin' : 'Ayrılanların kalan izni'} deger={o ? `${gunFmt(o.toplamKalan)} gün` : undefined} ton="mavi" alt={durum === 'AKTIF' && (departmentId !== 'TUMU' || q) ? 'filtreye göre' : undefined} />
        <OzetKart ikon={<Hourglass className="h-4 w-4" />} baslik="İV onayı bekleyen" deger={o ? `${o.ivOnayiBekleyen} talep` : undefined} ton="turuncu" />
        <OzetKart ikon={<CalendarClock className="h-4 w-4" />} baslik="30 günden fazla biriken" deger={o ? `${o.otuzGunuAsan} kişi` : undefined} ton="turuncu" />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        {durum === 'AKTIF' && (
          <label className="inline-flex cursor-pointer items-center gap-2 text-slate-600">
            <input type="checkbox" checked={yakinda} onChange={(e) => setYakinda(e.target.checked)} className="h-4 w-4 accent-[#1B4F72]" />
            Önümüzdeki 30 günde hak edecekler
          </label>
        )}
        <span className="text-slate-400">{veri ? `${veri.satirlar.length} kişi` : ''}</span>
        <Button variant="ghost" size="sm" className="ml-auto" asChild>
          <a href={`/api/izin/bakiyeler?${sorgu}&format=xlsx`}>
            <Download className="mr-1 h-4 w-4" /> Excel
          </a>
        </Button>
      </div>

      {hata && <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">{hata}</div>}

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Sicil</th>
              <th className="px-3 py-2 font-medium">Ad Soyad</th>
              <th className="px-3 py-2 font-medium">Departman</th>
              <th className="px-3 py-2 font-medium">Yaka</th>
              <th className="px-3 py-2 font-medium">Kıdem</th>
              <th className="px-3 py-2 text-right font-medium">Yıllık hak</th>
              <th className="px-3 py-2 text-right font-medium" title="Bu takvim yılında kullanılan (iadeler düşülmüş)">Kullanılan</th>
              <th className="px-3 py-2 text-right font-medium">Bekleyen</th>
              <th className="px-3 py-2 text-right font-medium" title="Bakiye − bekleyen talepler">Kalan</th>
              <th className="px-3 py-2 font-medium">Sonraki hak ediş</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {veri?.satirlar.map((s) => {
              const z = s.ozet
              return (
                <tr key={s.personnelId} className="border-t align-middle hover:bg-slate-50/60">
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-slate-500">{s.sicil ?? '—'}</td>
                  <td className="px-3 py-2.5 font-medium">{s.adSoyad}</td>
                  <td className="px-3 py-2.5 text-slate-600">{s.departman ?? '—'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{YAKA[s.yaka] ?? s.yaka}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs">{z.kidemYil >= 1 ? `${z.kidemYil} yıl` : `${z.kidemAy} ay`}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs">{z.yillikHak ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs">{gunFmt(z.kullanilanBuYil)}</td>
                  <td className={cn('px-3 py-2.5 text-right font-mono text-xs', z.bekleyen > 0 && 'font-medium text-amber-700')}>{gunFmt(z.bekleyen)}</td>
                  <td
                    className={cn(
                      'px-3 py-2.5 text-right font-mono font-semibold',
                      z.kalan > 30 ? 'text-amber-800' : z.kalan <= 0 ? 'text-slate-500' : 'text-blue-800',
                    )}
                    title={!s.acilisVar ? 'Açılış bakiyesi yüklenmedi' : undefined}
                  >
                    {gunFmt(z.kalan)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-600">
                    {z.sonraki ? (
                      <>
                        {tarihFmt(z.sonraki.tarih)} · +{z.sonraki.gun}
                        {z.sonraki.ilk && <span className="text-slate-400"> · ilk hak</span>}
                      </>
                    ) : '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                    <button onClick={() => setHareketId(s.personnelId)} className="inline-flex items-center gap-0.5 text-sm font-medium text-[#1B4F72] hover:underline">
                      Hareketler <ArrowUpRight className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              )
            })}
            {veri && veri.satirlar.length === 0 && (
              <tr><td colSpan={11} className="px-3 py-10 text-center text-slate-400">{q || departmentId !== 'TUMU' || yakinda ? 'Filtreye uyan kişi yok' : durum === 'AYRILAN' ? 'İzin defteri olan ayrılan personel yok' : 'Personel yok'}</td></tr>
            )}
            {!veri && yukleniyor && (
              <tr><td colSpan={11} className="px-3 py-10 text-center text-slate-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
            )}
          </tbody>
        </table>
      </div>

      <HareketlerDialog personnelId={hareketId} kapat={() => setHareketId(null)} canBakiyeAdmin={canBakiyeAdmin} degisti={yukle} />
    </div>
  )
}

function OzetKart({ ikon, baslik, deger, ton, alt }: { ikon: React.ReactNode; baslik: string; deger?: string; ton: 'mavi' | 'turuncu' | 'gri'; alt?: string }) {
  return (
    <Card className="shadow-none">
      <CardContent className="p-4">
        <div className={cn('flex items-center gap-1.5 text-xs font-medium', ton === 'mavi' && 'text-blue-700', ton === 'turuncu' && 'text-amber-700', ton === 'gri' && 'text-slate-500')}>
          {ikon}{baslik}
        </div>
        <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{deger ?? '—'}</div>
        {alt && <div className="mt-0.5 text-xs text-slate-500">{alt}</div>}
      </CardContent>
    </Card>
  )
}

// ── Hareketler (defter) + düzeltme ───────────────────────────────────────────

function HareketlerDialog({ personnelId, kapat, canBakiyeAdmin, degisti }: { personnelId: string | null; kapat: () => void; canBakiyeAdmin: boolean; degisti: () => void }) {
  const [v, setV] = useState<Hareketler | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [gun, setGun] = useState('')
  const [gerekce, setGerekce] = useState('')
  const [formHata, setFormHata] = useState<string | null>(null)
  const [kaydediliyor, setKaydediliyor] = useState(false)

  const yukle = useCallback(async () => {
    if (!personnelId) return
    const { ok, veri } = await istek<Hareketler>(`/api/izin/bakiyeler/${personnelId}/hareketler`)
    if (ok) setV(veri)
    else setHata(veri.error ?? 'Hareketler alınamadı')
  }, [personnelId])
  useEffect(() => {
    setV(null); setHata(null); setGun(''); setGerekce(''); setFormHata(null)
    void yukle()
  }, [yukle])

  const kaydet = async () => {
    if (!personnelId) return
    setFormHata(null)
    setKaydediliyor(true)
    const { ok, veri } = await istek(`/api/izin/bakiyeler/${personnelId}/duzeltme`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gun, gerekce }),
    })
    setKaydediliyor(false)
    if (!ok) return setFormHata(veri.error ?? 'Kaydedilemedi')
    setGun(''); setGerekce('')
    await yukle()
    degisti()
  }

  const son = v?.hareketler.at(-1)?.bakiye ?? 0
  return (
    <Dialog open={!!personnelId} onOpenChange={(o) => !o && kapat()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Yıllık izin hareketleri</DialogTitle>
        </DialogHeader>
        {hata && <p className="text-sm text-amber-800">{hata}</p>}
        {!v && !hata && <Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" />}
        {v && (
          <div className="space-y-4 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <p>
                <span className="font-mono text-slate-500">{v.personel.sicil}</span> · <span className="font-medium">{v.personel.adSoyad}</span>
                {!v.personel.aktif && <span className="ml-2 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Ayrıldı</span>}
              </p>
              <p className="text-slate-500">Bakiye <span className="font-mono text-base font-semibold text-blue-800">{gunFmt(son)}</span> gün</p>
            </div>
            <div className="max-h-[45vh] overflow-y-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-3 py-1.5 font-medium">Tarih</th>
                    <th className="px-3 py-1.5 font-medium">Hareket</th>
                    <th className="px-3 py-1.5 text-right font-medium">Gün</th>
                    <th className="px-3 py-1.5 text-right font-medium">Bakiye</th>
                    <th className="px-3 py-1.5 font-medium">Açıklama · kaydeden</th>
                  </tr>
                </thead>
                <tbody>
                  {v.hareketler.map((h) => (
                    <tr key={h.id} className="border-t align-top">
                      <td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs">{tarihFmt(h.tarih)}</td>
                      <td className="whitespace-nowrap px-3 py-1.5">{HAREKET[h.hareket] ?? h.hareket}</td>
                      <td className={cn('px-3 py-1.5 text-right font-mono', h.gun < 0 ? 'text-slate-600' : 'text-blue-800')}>{h.gun > 0 ? '+' : ''}{gunFmt(h.gun)}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{gunFmt(h.bakiye)}</td>
                      <td className="px-3 py-1.5 text-xs text-slate-600">
                        {h.aciklama ?? (h.talepVar ? 'izin talebi' : '')}
                        <div className="text-slate-400">{h.olusturan}</div>
                      </td>
                    </tr>
                  ))}
                  {v.hareketler.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">Henüz hareket yok — açılış bakiyesi yüklenmedi</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {canBakiyeAdmin && v.personel.aktif && (
              <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-medium text-slate-600">Düzeltme ekle (defter değişmez, yeni satır yazılır)</div>
                <div className="flex flex-wrap gap-2">
                  <Input value={gun} onChange={(e) => setGun(e.target.value)} placeholder="+2 veya -0,5" className="w-32 bg-white font-mono" aria-label="Gün" />
                  <Textarea value={gerekce} onChange={(e) => setGerekce(e.target.value)} placeholder="Gerekçe (zorunlu)" rows={1} className="min-h-[40px] flex-1 bg-white" aria-label="Gerekçe" />
                </div>
                {formHata && <p className="text-sm text-amber-800">{formHata}</p>}
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={kapat}>Kapat</Button>
          {canBakiyeAdmin && v?.personel.aktif && (
            <Button onClick={kaydet} disabled={kaydediliyor || !gun.trim() || gerekce.trim().length < 5}>Düzeltmeyi yaz</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
