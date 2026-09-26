'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowUpRight, CreditCard, History, Loader2, Plus, Search, UserX, Upload, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

type Senkron = 'YUKLENDI' | 'BEKLIYOR' | 'HATA' | 'SILINDI' | 'YOK'
type Satir = {
  id: string
  kartNo: string
  durum: 'AKTIF' | 'PASIF'
  pasifNedeni: string | null
  sicil: string | null
  adSoyad: string
  departman: string | null
  personelAktif: boolean
  senkron: Senkron
  senkronHata: string | null
  kaynak: string
  tanimlanma: string
}
type MutabakatCihaz = {
  kod: string
  panelde: number
  hubdaTanimsiz: { cardNo: string; employeeNo: string }[]
  paneldeEksik: { kartId: string; kart: string; sicil: string | null }[]
  hata?: string
}
type Veri = {
  satirlar: Satir[]
  ozet: { aktifKart: number; paneleYuklu: number; senkronBekliyor: number; senkronHata: number; kartsizAktifPersonel: number; aktifCihaz: number }
  mutabakat: { zaman: string; hubdaTanimsiz: number; paneldeEksik: number; cihazlar: MutabakatCihaz[] } | null
}
type Aday = { id: string; sicil: string | null; adSoyad: string; departman: string | null; aktifKart: string | null }
type Gecmis = {
  kart: { kartNo: string; sicil: string | null; adSoyad: string; durum: string; pasifNedeni: string | null; kaynak: string; olusturma: string; olusturan: string }
  panel: { cihaz: string; durum: string; deneme: number; sonHata: string | null; sonDeneme: string | null; yuklendi: string | null }[]
  olaylar: { id: string; action: string; aktor: string; zaman: string; details: Record<string, unknown> | null }[]
}

// Renk dili: mavi = aktif / yüklendi, turuncu = bekliyor / uyarı, gri = pasif / silindi.
// Kırmızı-yeşil ayrımı BİLİNÇLİ olarak yok (renk körlüğü).
const SENKRON: Record<Senkron, { etiket: string; nokta: string; metin: string }> = {
  YUKLENDI: { etiket: 'Yüklendi', nokta: 'bg-blue-600', metin: 'text-blue-800' },
  BEKLIYOR: { etiket: 'Bekliyor', nokta: 'bg-amber-500', metin: 'text-amber-800' },
  HATA: { etiket: 'Hata', nokta: 'bg-amber-700 ring-2 ring-amber-300', metin: 'text-amber-900 font-medium' },
  SILINDI: { etiket: 'Panelden silindi', nokta: 'bg-slate-400', metin: 'text-slate-600' },
  YOK: { etiket: 'Panele gitmedi', nokta: 'bg-slate-300', metin: 'text-slate-500' },
}
const KAYNAK: Record<string, string> = { BIZMANAGER_IMPORT: 'BizManager aktarımı', GV_IMPORT: 'GV aktarımı', MANUEL: 'Elle' }
const NEDEN: Record<string, string> = { KAYIP: 'Kayıp', BOZUK: 'Bozuk', DEGISTI: 'Değişti', IPTAL: 'İptal', AYRILDI: 'Ayrıldı' }
const OLAY: Record<string, string> = {
  PDKS_KART_CREATED: 'Kart tanımlandı',
  PDKS_KART_PASIFLENDI: 'Kart pasiflendi',
  PDKS_KART_IMPORT: 'İçe aktarım',
}

const tarih = (iso: string | null, saat = false) =>
  iso
    ? new Date(iso).toLocaleString('tr-TR', {
        timeZone: 'Europe/Istanbul',
        day: '2-digit', month: '2-digit', year: 'numeric',
        ...(saat ? { hour: '2-digit', minute: '2-digit' } : {}),
      })
    : '—'

async function istek<T = Record<string, unknown>>(url: string, init?: RequestInit): Promise<{ ok: boolean; veri: T & { error?: string } }> {
  try {
    const r = await fetch(url, { cache: 'no-store', ...init })
    const veri = (await r.json().catch(() => ({}))) as T & { error?: string; ok?: boolean }
    return { ok: r.ok && veri.ok !== false, veri }
  } catch {
    return { ok: false, veri: { error: 'Sunucuya ulaşılamadı' } as T & { error?: string } }
  }
}

function Rozet({ ton, children, title }: { ton: 'mavi' | 'turuncu' | 'gri'; children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        ton === 'mavi' && 'border-blue-200 bg-blue-50 text-blue-800',
        ton === 'turuncu' && 'border-amber-200 bg-amber-50 text-amber-800',
        ton === 'gri' && 'border-slate-200 bg-slate-100 text-slate-600',
      )}
    >
      {children}
    </span>
  )
}

export function KartlarClient({ canManage, baslangicKartNo }: { canManage: boolean; baslangicKartNo?: string }) {
  const [durum, setDurum] = useState<'AKTIF' | 'PASIF' | 'TUMU'>('AKTIF')
  const [arama, setArama] = useState('')
  const [q, setQ] = useState('')
  const [veri, setVeri] = useState<Veri | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  // Geçiş Kayıtları › "Personele bağla" → ?kartNo=118-63577 ile gelinirse pencere kart no dolu açılır.
  const [tanimlaAcik, setTanimlaAcik] = useState(canManage && !!baslangicKartNo)
  const [pasifle, setPasifle] = useState<Satir | null>(null)
  const [gecmisId, setGecmisId] = useState<string | null>(null)
  const [farkAcik, setFarkAcik] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setQ(arama.trim()), 300)
    return () => clearTimeout(t)
  }, [arama])

  const yukle = useCallback(async () => {
    setYukleniyor(true)
    const { ok, veri: v } = await istek<Veri>(`/api/pdks/kartlar?durum=${durum}&q=${encodeURIComponent(q)}`)
    setYukleniyor(false)
    if (!ok) return setHata(v.error ?? 'Kartlar alınamadı')
    setHata(null)
    setVeri(v)
  }, [durum, q])
  useEffect(() => void yukle(), [yukle])

  const o = veri?.ozet
  const m = veri?.mutabakat

  return (
    <div className="space-y-5">
      {/* Başlık satırı: filtre + arama + iki parçalı buton */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border bg-white p-0.5" role="tablist" aria-label="Durum">
          {(['AKTIF', 'PASIF', 'TUMU'] as const).map((d) => (
            <button
              key={d}
              role="tab"
              aria-selected={durum === d}
              onClick={() => setDurum(d)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm transition-colors',
                durum === d ? 'bg-[#1B4F72] text-white' : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              {d === 'AKTIF' ? 'Aktif' : d === 'PASIF' ? 'Pasif' : 'Tümü'}
            </button>
          ))}
        </div>
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input value={arama} onChange={(e) => setArama(e.target.value)} placeholder="Sicil, ad veya kart no" className="pl-8" />
        </div>
        <div className="ml-auto inline-flex overflow-hidden rounded-lg border border-[#1B4F72] text-sm">
          <button
            onClick={() => setDurum('AKTIF')}
            className="bg-white px-3 py-1.5 font-medium text-[#1B4F72] hover:bg-blue-50"
            title="Aktif kartları göster"
          >
            {o ? o.aktifKart : '…'} aktif
          </button>
          {canManage && (
            <button
              onClick={() => setTanimlaAcik(true)}
              className="inline-flex items-center gap-1 border-l border-[#1B4F72] bg-[#1B4F72] px-3 py-1.5 font-medium text-white hover:bg-[#154360]"
            >
              Kart tanımla <Plus className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* 4 özet kart */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OzetKart ikon={<CreditCard className="h-4 w-4" />} baslik="Aktif kart" deger={o?.aktifKart} ton="mavi" />
        <OzetKart
          ikon={<Upload className="h-4 w-4" />}
          baslik="Panele yüklü"
          deger={o?.paneleYuklu}
          ton="mavi"
          alt={o && o.aktifCihaz === 0 ? 'Panel tanımlı değil — cihaz eklenince yüklenir' : undefined}
        />
        <OzetKart
          ikon={<Clock className="h-4 w-4" />}
          baslik="Senkron bekliyor"
          deger={o?.senkronBekliyor}
          ton="turuncu"
          alt={o && o.senkronHata > 0 ? `${o.senkronHata} kartta hata` : undefined}
        />
        <OzetKart ikon={<UserX className="h-4 w-4" />} baslik="Kartsız aktif personel" deger={o?.kartsizAktifPersonel} ton="gri" />
      </div>

      {/* Mutabakat uyarı şeridi — yalnız fark varsa */}
      {m && (m.hubdaTanimsiz > 0 || m.paneldeEksik > 0) && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            {m.hubdaTanimsiz > 0 && <>Panelde <strong>{m.hubdaTanimsiz}</strong> kart var ama Hub&apos;da tanımlı değil. </>}
            {m.paneldeEksik > 0 && <>Hub&apos;da yüklü görünen <strong>{m.paneldeEksik}</strong> kart panelde yok. </>}
            <span className="text-amber-700">Son mutabakat: {tarih(m.zaman, true)}</span>
          </span>
          <button onClick={() => setFarkAcik(true)} className="ml-auto inline-flex items-center gap-0.5 font-medium underline-offset-2 hover:underline">
            Farkı incele <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {hata && <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">{hata}</div>}

      {/* Tablo */}
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Kart no</th>
              <th className="px-3 py-2">Sicil</th>
              <th className="px-3 py-2">Ad Soyad</th>
              <th className="px-3 py-2">Departman</th>
              <th className="px-3 py-2">Kart</th>
              <th className="px-3 py-2">Panel senkronu</th>
              <th className="px-3 py-2">Tanımlanma</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {veri?.satirlar.map((s) => {
              const sk = SENKRON[s.senkron]
              return (
                <tr key={s.id} className="border-t align-middle hover:bg-slate-50/60">
                  <td className="whitespace-nowrap px-3 py-2 font-mono">{s.kartNo}</td>
                  <td className="whitespace-nowrap px-3 py-2">{s.sicil ?? '—'}</td>
                  <td className="px-3 py-2">
                    {s.adSoyad}
                    {!s.personelAktif && s.durum === 'AKTIF' && (
                      <span className="ml-1.5"><Rozet ton="turuncu" title="Hub'da pasif — kart bir sonraki senkronda kapatılır">personel pasif</Rozet></span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{s.departman ?? '—'}</td>
                  <td className="px-3 py-2">
                    {s.durum === 'AKTIF' ? (
                      <Rozet ton="mavi">Aktif</Rozet>
                    ) : (
                      <Rozet ton="gri" title={s.pasifNedeni ? `Neden: ${NEDEN[s.pasifNedeni] ?? s.pasifNedeni}` : undefined}>
                        Pasif{s.pasifNedeni ? ` · ${NEDEN[s.pasifNedeni] ?? s.pasifNedeni}` : ''}
                      </Rozet>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className={cn('inline-flex items-center gap-1.5', sk.metin)} title={s.senkronHata ?? undefined}>
                      <span className={cn('h-2 w-2 rounded-full', sk.nokta)} />
                      {sk.etiket}
                      {s.senkron === 'HATA' && <AlertTriangle className="h-3.5 w-3.5" />}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                    {KAYNAK[s.kaynak] ?? s.kaynak} · {tarih(s.tanimlanma)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {canManage && s.durum === 'AKTIF' && (
                      <Button variant="ghost" size="sm" onClick={() => setPasifle(s)}>Pasifle</Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setGecmisId(s.id)} title="Geçmiş">
                      <History className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              )
            })}
            {veri && veri.satirlar.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-slate-400">
                  {q ? 'Aramaya uyan kart yok' : durum === 'PASIF' ? 'Pasif kart yok' : 'Henüz kart tanımlı değil'}
                </td>
              </tr>
            )}
            {!veri && yukleniyor && (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-slate-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {canManage && <TanimlaDialog acik={tanimlaAcik} kapat={() => setTanimlaAcik(false)} bitti={yukle} ilkKartNo={baslangicKartNo} />}
      {canManage && <PasifleDialog kart={pasifle} kapat={() => setPasifle(null)} bitti={yukle} />}
      <GecmisDialog id={gecmisId} kapat={() => setGecmisId(null)} />
      <FarkDialog acik={farkAcik} kapat={() => setFarkAcik(false)} cihazlar={m?.cihazlar ?? []} zaman={m?.zaman ?? null} />
    </div>
  )
}

function OzetKart({ ikon, baslik, deger, ton, alt }: { ikon: React.ReactNode; baslik: string; deger?: number; ton: 'mavi' | 'turuncu' | 'gri'; alt?: string }) {
  return (
    <Card className="shadow-none">
      <CardContent className="p-4">
        <div className={cn('flex items-center gap-1.5 text-xs font-medium',
          ton === 'mavi' && 'text-blue-700', ton === 'turuncu' && 'text-amber-700', ton === 'gri' && 'text-slate-500')}>
          {ikon}{baslik}
        </div>
        <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{deger ?? '—'}</div>
        {alt && <div className="mt-0.5 text-xs text-slate-500">{alt}</div>}
      </CardContent>
    </Card>
  )
}

// ── Kart tanımla ─────────────────────────────────────────────────────────────

function TanimlaDialog({ acik, kapat, bitti, ilkKartNo }: { acik: boolean; kapat: () => void; bitti: () => void; ilkKartNo?: string }) {
  const [arama, setArama] = useState('')
  const [adaylar, setAdaylar] = useState<Aday[]>([])
  const [secili, setSecili] = useState<Aday | null>(null)
  const [kartNo, setKartNo] = useState(ilkKartNo ?? '')
  const [hata, setHata] = useState<string | null>(null)
  const [kaydediliyor, setKaydediliyor] = useState(false)

  useEffect(() => {
    if (!acik) return
    const t = setTimeout(async () => {
      const { ok, veri } = await istek<{ personeller: Aday[] }>(`/api/pdks/kartlar/personel-aday?q=${encodeURIComponent(arama.trim())}`)
      if (ok) setAdaylar(veri.personeller)
    }, 250)
    return () => clearTimeout(t)
  }, [arama, acik])

  const sifirla = () => {
    setArama(''); setSecili(null); setKartNo(''); setHata(null)
  }
  const onizleme = useMemo(() => {
    const s = kartNo.trim()
    const a = /^(\d{1,3})[\s-]+(\d{1,5})$/.exec(s)
    if (a) return `${a[1].padStart(3, '0')}-${a[2].padStart(5, '0')}`
    if (/^\d{8}$/.test(s)) return `${s.slice(0, 3)}-${s.slice(3)}`
    return null
  }, [kartNo])

  const kaydet = async () => {
    if (!secili) return setHata('Personel seçin')
    setHata(null)
    setKaydediliyor(true)
    const { ok, veri } = await istek('/api/pdks/kartlar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personnelId: secili.id, kartNo }),
    })
    setKaydediliyor(false)
    if (!ok) return setHata(veri.error ?? 'Kaydedilemedi')
    sifirla()
    kapat()
    bitti()
  }

  return (
    <Dialog open={acik} onOpenChange={(o) => { if (!o) { sifirla(); kapat() } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Kart tanımla</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Personel (yalnız aktif; kartsızlar üstte)</Label>
            <Input value={arama} onChange={(e) => setArama(e.target.value)} placeholder="Sicil veya ad ile ara" className="mt-1" />
            <div className="mt-2 max-h-56 overflow-y-auto rounded-md border">
              {adaylar.map((a) => (
                <button
                  key={a.id}
                  disabled={!!a.aktifKart}
                  onClick={() => setSecili(a)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-left text-sm last:border-b-0',
                    secili?.id === a.id ? 'bg-blue-50' : 'hover:bg-slate-50',
                    a.aktifKart && 'cursor-not-allowed opacity-60',
                  )}
                >
                  <span>
                    <span className="font-medium">{a.adSoyad}</span>
                    <span className="ml-2 text-xs text-slate-500">{a.sicil} · {a.departman ?? '—'}</span>
                  </span>
                  {a.aktifKart ? <Rozet ton="gri">kart var · {a.aktifKart}</Rozet> : <Rozet ton="turuncu">kartsız</Rozet>}
                </button>
              ))}
              {adaylar.length === 0 && <div className="px-3 py-4 text-center text-sm text-slate-400">Sonuç yok</div>}
            </div>
          </div>
          <div>
            <Label>Kart no</Label>
            <Input value={kartNo} onChange={(e) => setKartNo(e.target.value)} placeholder="118-63577 veya 11863577" className="mt-1 font-mono" />
            <p className="mt-1 text-xs text-slate-500">
              {onizleme ? <>Kaydedilecek: <span className="font-mono">{onizleme}</span> (tesis-kart)</> : '3 hane tesis kodu + 5 hane kart no'}
            </p>
          </div>
          {hata && <p className="text-sm text-amber-800">{hata}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { sifirla(); kapat() }}>İptal</Button>
          <Button onClick={kaydet} disabled={kaydediliyor || !secili || !onizleme}>Tanımla</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Pasifle ──────────────────────────────────────────────────────────────────

function PasifleDialog({ kart, kapat, bitti }: { kart: Satir | null; kapat: () => void; bitti: () => void }) {
  const [neden, setNeden] = useState<string>('')
  const [hata, setHata] = useState<string | null>(null)
  const [kaydediliyor, setKaydediliyor] = useState(false)
  useEffect(() => {
    setNeden('')
    setHata(null)
  }, [kart])

  const kaydet = async () => {
    if (!kart || !neden) return
    setKaydediliyor(true)
    const { ok, veri } = await istek(`/api/pdks/kartlar/${kart.id}/pasifle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ neden }),
    })
    setKaydediliyor(false)
    if (!ok) return setHata(veri.error ?? 'Pasiflenemedi')
    kapat()
    bitti()
  }

  return (
    <Dialog open={!!kart} onOpenChange={(o) => !o && kapat()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Kartı pasifle</DialogTitle></DialogHeader>
        {kart && (
          <div className="space-y-3 text-sm">
            <p>
              <span className="font-mono">{kart.kartNo}</span> · {kart.sicil} · {kart.adSoyad}
            </p>
            <div>
              <Label>Neden</Label>
              <Select value={neden} onValueChange={setNeden}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Neden seçin" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="KAYIP">Kayıp</SelectItem>
                  <SelectItem value="BOZUK">Bozuk</SelectItem>
                  <SelectItem value="DEGISTI">Değişti (yeni kart verilecek)</SelectItem>
                  <SelectItem value="IPTAL">İptal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-slate-500">Kart panelden öncelikli olarak silinir. İşlem denetim kaydına yazılır.</p>
            {hata && <p className="text-sm text-amber-800">{hata}</p>}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={kapat}>Vazgeç</Button>
          <Button onClick={kaydet} disabled={!neden || kaydediliyor}>Pasifle</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Geçmiş ───────────────────────────────────────────────────────────────────

function GecmisDialog({ id, kapat }: { id: string | null; kapat: () => void }) {
  const [g, setG] = useState<Gecmis | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  useEffect(() => {
    setG(null)
    setHata(null)
    if (!id) return
    void (async () => {
      const { ok, veri } = await istek<Gecmis>(`/api/pdks/kartlar/${id}/gecmis`)
      if (ok) setG(veri)
      else setHata(veri.error ?? 'Geçmiş alınamadı')
    })()
  }, [id])

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && kapat()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Kart geçmişi</DialogTitle></DialogHeader>
        {hata && <p className="text-sm text-amber-800">{hata}</p>}
        {!g && !hata && <Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" />}
        {g && (
          <div className="space-y-4 text-sm">
            <p>
              <span className="font-mono">{g.kart.kartNo}</span> · {g.kart.sicil} · {g.kart.adSoyad}
            </p>
            <ol className="space-y-2 border-l-2 border-slate-200 pl-4">
              {g.olaylar.map((o) => (
                <li key={o.id}>
                  <div className="font-medium">{OLAY[o.action] ?? o.action}{o.details?.neden ? ` · ${NEDEN[String(o.details.neden)] ?? String(o.details.neden)}` : ''}</div>
                  <div className="text-xs text-slate-500">{tarih(o.zaman, true)} · {o.aktor}</div>
                </li>
              ))}
              <li>
                <div className="font-medium">Oluşturuldu · {KAYNAK[g.kart.kaynak] ?? g.kart.kaynak}</div>
                <div className="text-xs text-slate-500">{tarih(g.kart.olusturma, true)} · {g.kart.olusturan}</div>
              </li>
            </ol>
            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Panel senkronu</div>
              {g.panel.length === 0 ? (
                <p className="text-slate-500">Henüz panel kaydı yok (aktif cihaz tanımlı değil).</p>
              ) : (
                <ul className="space-y-1">
                  {g.panel.map((p) => (
                    <li key={p.cihaz}>
                      <span className="font-medium">{p.cihaz}</span>: {p.durum}
                      {p.yuklendi && ` · yüklendi ${tarih(p.yuklendi, true)}`}
                      {p.deneme > 0 && ` · ${p.deneme} deneme`}
                      {p.sonHata && <div className="text-xs text-amber-800">{p.sonHata}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Mutabakat farkı ──────────────────────────────────────────────────────────

function FarkDialog({ acik, kapat, cihazlar, zaman }: { acik: boolean; kapat: () => void; cihazlar: MutabakatCihaz[]; zaman: string | null }) {
  return (
    <Dialog open={acik} onOpenChange={(o) => !o && kapat()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Panel mutabakat farkı</DialogTitle></DialogHeader>
        <p className="text-xs text-slate-500">
          Son mutabakat: {tarih(zaman, true)}. Panelde olup Hub&apos;da tanımlı olmayan kartlar otomatik SİLİNMEZ — karar pdks.manage&apos;da.
        </p>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto text-sm">
          {cihazlar.map((c) => (
            <div key={c.kod}>
              <div className="font-medium">{c.kod} · panelde {c.panelde} kart</div>
              {c.hata && <div className="text-amber-800">{c.hata}</div>}
              {c.hubdaTanimsiz.length > 0 && (
                <div className="mt-1">
                  <div className="text-xs text-slate-500">Hub&apos;da tanımsız ({c.hubdaTanimsiz.length})</div>
                  <ul className="font-mono text-xs">{c.hubdaTanimsiz.map((k) => <li key={k.cardNo}>{k.cardNo} · {k.employeeNo || '—'}</li>)}</ul>
                </div>
              )}
              {c.paneldeEksik.length > 0 && (
                <div className="mt-1">
                  <div className="text-xs text-slate-500">Panelde eksik ({c.paneldeEksik.length})</div>
                  <ul className="font-mono text-xs">{c.paneldeEksik.map((k) => <li key={k.kartId}>{k.kart} · {k.sicil ?? '—'}</li>)}</ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
