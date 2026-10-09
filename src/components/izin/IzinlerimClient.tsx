'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CalendarClock, Hourglass, Loader2, Search, Sigma, UserRound, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

type Tur = {
  id: string; kod: string; ad: string; bakiyeli: boolean; sabitGun: number | null; yarimGunOlur: boolean; gunSayimi: string; kapali: string | null
  birim: 'GUN' | 'SAAT'; belgeZorunlu: boolean; ozelNitelikli: boolean
}
type Talep = {
  id: string; tur: string; baslangic: string; bitis: string; baslangicYarim: string | null; bitisYarim: string | null
  gun: number; durum: string; durumMetni: string; adim: string; geriCekilebilir: boolean
  baslangicSaat: string | null; bitisSaat: string | null; dakika: number | null; belgeSayisi: number
  belgeler?: { id: string; ad: string }[]
}
type Veri =
  | { bagli: false }
  | {
      bagli: true
      personel: { id: string; adSoyad: string; sicil: string | null; kendi: boolean }
      gecisTarihi: string | null
      kartlar: { kalan: number; bakiye: number; bekleyenTalep: number; bekleyenGun: number; kullanilanBuYil: number; sonraki: { tarih: string; gun: number; ilk: boolean } | null }
      turler: Tur[]
      kotalar: { turId: string; ad: string; kotaDk: number; kullanilanDk: number }[]
      talepler: Talep[]
    }
type Onizleme = {
  toplam: number; dakika: number | null; notlar: string[]; bakiye: { kalan: number; sonrasi: number; yeterli: boolean } | null
  kota: { kotaDk: number; kalanDk: number; sonrasiDk: number; yeterli: boolean } | null; belgeZorunlu: boolean
  cakisan: { baslangic: string; bitis: string } | null; ekipCakisma: number; onayMetni: string
}
type Aday = { id: string; adSoyad: string; sicil: string | null; departman: string | null; hesapVar: boolean }

const gunFmt = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 1 })
const saatFmt = (dk: number) => (dk / 60).toLocaleString('tr-TR', { maximumFractionDigits: 2 })
const tarihFmt = (s: string) => `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}`
// Renk dili: mavi = onaylı / talep, turuncu = bekleyen / uyarı, gri = red / iptal / tatil. Kırmızı-yeşil YOK.
const DURUM_TON: Record<string, string> = {
  BEKLIYOR_YONETICI: 'border-amber-200 bg-amber-50 text-amber-800',
  BEKLIYOR_IV: 'border-amber-200 bg-amber-50 text-amber-800',
  ONAYLANDI: 'border-blue-200 bg-blue-50 text-blue-800',
  REDDEDILDI: 'border-slate-200 bg-slate-100 text-slate-600',
  IPTAL: 'border-slate-200 bg-slate-100 text-slate-500',
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

export function IzinlerimClient({ adinaAcabilir, ilkBaslangic }: { adinaAcabilir: boolean; ilkBaslangic?: string }) {
  const [kisi, setKisi] = useState<Aday | null>(null) // null = kendim
  const [veri, setVeri] = useState<Veri | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const pq = kisi ? `personnelId=${kisi.id}` : ''

  const yukle = useCallback(async () => {
    const { ok, veri: v } = await istek<Veri>(`/api/izin/talebim?${pq}`)
    if (!ok) return setHata(v.error ?? 'İzin bilgileri alınamadı')
    setHata(null)
    setVeri(v)
  }, [pq])
  useEffect(() => {
    setVeri(null)
    void yukle()
  }, [yukle])

  return (
    <div className="space-y-6">
      {adinaAcabilir && <KimIcin kisi={kisi} sec={setKisi} />}
      {hata && <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">{hata}</div>}
      {!veri && !hata && <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" />}
      {veri && !veri.bagli && (
        <div className="rounded-lg border bg-white px-4 py-6 text-sm text-slate-600">
          Hesabınız bir personel kaydına bağlı değil. İzin talebi için yöneticinize ya da İnsan Varlıkları&apos;na başvurun.
        </div>
      )}
      {veri?.bagli && (
        <>
          {!veri.personel.kendi && (
            <p className="text-sm text-muted-foreground"><strong className="font-medium text-slate-700">{veri.personel.adSoyad}</strong> adına talep açıyorsunuz.</p>
          )}
          <Kartlar k={veri.kartlar} gecis={veri.gecisTarihi} kotalar={veri.kotalar} />
          <TalepFormu key={veri.personel.id} turler={veri.turler} personnelId={kisi?.id ?? null} bitti={yukle} ilkBaslangic={veri.personel.kendi ? ilkBaslangic : undefined} />
          {(veri.personel.kendi || veri.talepler.length > 0) && <Taleplerim talepler={veri.talepler} degisti={yukle} />}
        </>
      )}
    </div>
  )
}

// ── Kimin için (adına) ──────────────────────────────────────────────────────

function KimIcin({ kisi, sec }: { kisi: Aday | null; sec: (a: Aday | null) => void }) {
  const [acik, setAcik] = useState(false)
  const [q, setQ] = useState('')
  const [adaylar, setAdaylar] = useState<Aday[]>([])
  const kutuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!acik) return
    const t = setTimeout(async () => {
      const { ok, veri } = await istek<{ kisiler: Aday[] }>(`/api/izin/adina-adaylar?q=${encodeURIComponent(q.trim())}`)
      if (ok) setAdaylar(veri.kisiler)
    }, 250)
    return () => clearTimeout(t)
  }, [q, acik])

  // Dışarı tıklanınca / Esc ile listeyi kapat
  useEffect(() => {
    if (!acik) return
    const disari = (e: MouseEvent) => { if (kutuRef.current && !kutuRef.current.contains(e.target as Node)) setAcik(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAcik(false) }
    document.addEventListener('mousedown', disari)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', disari); document.removeEventListener('keydown', esc) }
  }, [acik])

  const baskasiSecili = !!kisi || acik
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <UserRound className="h-4 w-4 text-slate-500" />
      <span className="text-slate-600">Kimin için:</span>
      <div ref={kutuRef} className="relative">
        <div className="inline-flex rounded-lg border bg-white p-0.5">
          <button type="button" onClick={() => { sec(null); setAcik(false) }}
            className={cn('rounded-md px-3 py-1.5', !baskasiSecili ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100')}>Kendim</button>
          <button type="button" onClick={() => setAcik((v) => !v)}
            className={cn('rounded-md px-3 py-1.5', baskasiSecili ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100')}>
            {kisi ? `${kisi.adSoyad} adına` : 'Başkası adına…'}
          </button>
        </div>
        {acik && (
          <div className="absolute left-0 top-full z-30 mt-1 w-[min(92vw,28rem)] rounded-lg border bg-white p-2 shadow-lg">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sicil veya ad ile ara" className="pl-8" autoFocus />
            </div>
            <div className="mt-2 max-h-72 overflow-y-auto">
              {adaylar.map((a) => (
                <button type="button" key={a.id} onClick={() => { sec(a); setAcik(false); setQ('') }} className="flex w-full items-center justify-between gap-2 rounded px-2 py-2 text-left hover:bg-slate-50">
                  <span><span className="font-medium">{a.adSoyad}</span> <span className="text-xs text-slate-500">{a.sicil} · {a.departman ?? '—'}</span></span>
                  {!a.hesapVar && <span className="whitespace-nowrap rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs text-slate-600">hesabı yok</span>}
                </button>
              ))}
              {adaylar.length === 0 && <div className="px-2 py-3 text-center text-slate-400">Kişi bulunamadı</div>}
              {adaylar.length >= 50 && <div className="px-2 py-2 text-center text-xs text-slate-400">Daha fazlası için ad ya da sicil yazın</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Özet kartları (sakin: normal boy sayı, nötr renk) ────────────────────────

function Kartlar({ k, gecis, kotalar }: { k: Extract<Veri, { bagli: true }>['kartlar']; gecis: string | null; kotalar: Extract<Veri, { bagli: true }>['kotalar'] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kart ikon={<Wallet className="h-4 w-4" />} baslik="Yıllık izin · kalan" deger={gecis ? gunFmt(k.kalan) : '—'} birim={gecis ? 'gün' : 'bakiye henüz yüklenmedi'} />
      {kotalar.map((q) => (
        <Kart key={q.turId} accent ikon={<Hourglass className="h-4 w-4" />} baslik={q.ad} deger={`${saatFmt(q.kotaDk - q.kullanilanDk)} / ${saatFmt(q.kotaDk)}`} birim="sa" />
      ))}
      <Kart ikon={<Sigma className="h-4 w-4" />} baslik="Bu yıl kullanılan" deger={gunFmt(k.kullanilanBuYil)} birim="gün" />
      <Kart ikon={<CalendarClock className="h-4 w-4" />} baslik="Sonraki hak ediş"
        deger={k.sonraki ? `+${k.sonraki.gun}` : '—'} birim={k.sonraki ? `gün · ${tarihFmt(k.sonraki.tarih)}${k.sonraki.ilk ? ' · ilk hak' : ''}` : ''} />
    </div>
  )
}

function Kart({ ikon, baslik, deger, birim, accent }: { ikon: React.ReactNode; baslik: string; deger: string; birim: string; accent?: boolean }) {
  return (
    <Card className={cn('shadow-none', accent && 'border-blue-200 bg-blue-50/60')}>
      <CardContent className="p-4">
        <div className={cn('flex items-center gap-1.5 text-xs font-medium', accent ? 'text-blue-800' : 'text-muted-foreground')}>{ikon}{baslik}</div>
        <div className="mt-1 flex flex-wrap items-baseline gap-1.5">
          <span className={cn('text-lg font-semibold tabular-nums', accent ? 'text-blue-900' : 'text-slate-800')}>{deger}</span>
          <span className="text-xs text-muted-foreground">{birim}</span>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Talep formu + takvim + önizleme ─────────────────────────────────────────

function Parcali({ ad, secenekler, deger, sec, kapali }: { ad: string; secenekler: [string, string][]; deger: string; sec: (v: string) => void; kapali?: boolean }) {
  return (
    <fieldset className="space-y-1.5" disabled={kapali}>
      <legend className="pb-1 text-xs text-slate-500">{ad}</legend>
      <div className={cn('flex h-10 overflow-hidden rounded-lg border text-sm', kapali && 'opacity-50')}>
        {secenekler.map(([v, etiket], i) => (
          <label key={v} className={cn('flex flex-1 cursor-pointer items-center justify-center', i > 0 && 'border-l', deger === v ? 'bg-slate-800 font-medium text-white' : 'bg-white text-slate-700')}>
            <input type="radio" className="sr-only" checked={deger === v} onChange={() => sec(v)} />
            {etiket}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function TalepFormu({ turler, personnelId, bitti, ilkBaslangic }: { turler: Tur[]; personnelId: string | null; bitti: () => void; ilkBaslangic?: string }) {
  const [turId, setTurId] = useState('')
  const [bas, setBas] = useState(ilkBaslangic ?? '')
  const [bit, setBit] = useState(ilkBaslangic ?? '')
  const [ilk, setIlk] = useState('TAM')
  const [son, setSon] = useState('TAM')
  const [aciklama, setAciklama] = useState('')
  const [saatBas, setSaatBas] = useState('')
  const [saatBit, setSaatBit] = useState('')
  const [belge, setBelge] = useState<File | null>(null)
  const [on, setOn] = useState<Onizleme | null>(null)
  const [onHata, setOnHata] = useState<string | null>(null)
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [sonuc, setSonuc] = useState<string | null>(null)
  const tur = turler.find((t) => t.id === turId)

  const saatlik = tur?.birim === 'SAAT'
  const govde = useMemo(
    () =>
      saatlik
        ? { turId, baslangic: bas, bitis: bas, baslangicSaat: saatBas, bitisSaat: saatBit, ...(personnelId ? { personnelId } : {}) }
        : { turId, baslangic: bas, bitis: bit, baslangicYarim: ilk === 'OGLEDEN_SONRA' ? 'OGLEDEN_SONRA' : null, bitisYarim: son === 'SABAH' ? 'SABAH' : null, ...(personnelId ? { personnelId } : {}) },
    [saatlik, turId, bas, bit, ilk, son, saatBas, saatBit, personnelId],
  )
  useEffect(() => {
    setOn(null)
    setOnHata(null)
    if (!turId || !bas || (!saatlik && !bit) || (saatlik && (!saatBas || !saatBit)) || tur?.kapali) return
    const t = setTimeout(async () => {
      const { ok, veri } = await istek<Onizleme>('/api/izin/talebim/onizleme', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(govde) })
      if (ok) setOn(veri)
      else setOnHata(veri.error ?? 'Önizleme hesaplanamadı')
    }, 300)
    return () => clearTimeout(t)
  }, [govde, turId, bas, bit, saatlik, saatBas, saatBit, tur?.kapali])
  useEffect(() => {
    if (!tur?.yarimGunOlur) { setIlk('TAM'); setSon('TAM') }
  }, [tur?.yarimGunOlur])

  const gonder = async () => {
    setGonderiliyor(true)
    // Belge varsa multipart (veri = JSON alanlar, belge = dosya); yoksa JSON
    let init: RequestInit
    if (belge) {
      const fd = new FormData()
      fd.append('veri', JSON.stringify({ ...govde, aciklama }))
      fd.append('belge', belge)
      init = { method: 'POST', body: fd }
    } else init = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...govde, aciklama }) }
    const { ok, veri } = await istek<{ durum: string }>('/api/izin/talepler', init)
    setGonderiliyor(false)
    if (!ok) return setOnHata(veri.error ?? 'Talep gönderilemedi')
    setSonuc(veri.durum === 'BEKLIYOR_YONETICI' ? 'Talep yöneticinize gönderildi.' : 'Talep İnsan Varlıkları onayına gönderildi.')
    setBas(''); setBit(''); setAciklama(''); setSaatBas(''); setSaatBit(''); setBelge(null); setOn(null)
    bitti()
  }

  const gonderilebilir =
    !!on && !on.cakisan && (!on.bakiye || on.bakiye.yeterli) && (!on.kota || on.kota.yeterli) && (!tur?.belgeZorunlu || !!belge) && !gonderiliyor
  return (
    <section aria-labelledby="yeni-talep" className="space-y-4 rounded-lg border bg-white p-4 sm:p-5">
      <h2 id="yeni-talep" className="text-base font-semibold">Yeni izin talebi</h2>
      {sonuc && <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">{sonuc}</div>}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label className="text-xs text-slate-500">İzin türü</Label>
          <Select value={turId} onValueChange={(v) => { setTurId(v); setSonuc(null) }}>
            <SelectTrigger className="mt-1 h-11 bg-white"><SelectValue placeholder="Tür seçin" /></SelectTrigger>
            <SelectContent>
              {turler.map((t) => (
                <SelectItem key={t.id} value={t.id} disabled={!!t.kapali}>
                  {t.ad}{t.sabitGun ? ` · en çok ${t.sabitGun} gün` : ''}{t.kapali ? ` — ${t.kapali}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {turler.some((t) => t.kapali) && <p className="mt-1 text-xs text-amber-700">İzin bakiyeleri henüz yüklenmedi — yıllık izin talebi şimdilik açılamaz; diğer türler açılabilir.</p>}
        </div>
        <div className={saatlik ? 'col-span-2' : ''}>
          <Label htmlFor="izin-bas" className="text-xs text-slate-500">{saatlik ? 'Tarih' : 'Başlangıç'}</Label>
          <Input id="izin-bas" type="date" value={bas} onChange={(e) => { setBas(e.target.value); if (!bit || e.target.value > bit) setBit(e.target.value); setSonuc(null) }} className="mt-1 h-11 bg-white" />
        </div>
        {saatlik ? (
          <>
            <div>
              <Label htmlFor="izin-saat-bas" className="text-xs text-slate-500">Başlangıç saati</Label>
              <Input id="izin-saat-bas" type="time" step={900} value={saatBas} onChange={(e) => setSaatBas(e.target.value)} className="mt-1 h-11 bg-white" />
            </div>
            <div>
              <Label htmlFor="izin-saat-bit" className="text-xs text-slate-500">Bitiş saati</Label>
              <Input id="izin-saat-bit" type="time" step={900} value={saatBit} onChange={(e) => setSaatBit(e.target.value)} className="mt-1 h-11 bg-white" />
            </div>
          </>
        ) : (
          <>
            <div>
              <Label htmlFor="izin-bit" className="text-xs text-slate-500">Bitiş</Label>
              <Input id="izin-bit" type="date" value={bit} min={bas || undefined} onChange={(e) => setBit(e.target.value)} className="mt-1 h-11 bg-white" />
            </div>
            <Parcali ad="İlk gün" secenekler={[['TAM', 'Tam gün'], ['OGLEDEN_SONRA', 'Öğleden sonra']]} deger={ilk} sec={setIlk} kapali={!tur?.yarimGunOlur} />
            <Parcali ad="Son gün" secenekler={[['TAM', 'Tam gün'], ['SABAH', 'Sabah']]} deger={son} sec={setSon} kapali={!tur?.yarimGunOlur} />
          </>
        )}
      </div>

      {on && on.ekipCakisma > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0" /> Bu tarihlerde ekibinden {on.ekipCakisma} kişi izinli.
        </div>
      )}

      <div>
        <Label htmlFor="izin-aciklama" className="text-xs text-slate-500">Açıklama (isteğe bağlı)</Label>
        <Textarea id="izin-aciklama" rows={2} value={aciklama} onChange={(e) => setAciklama(e.target.value)} className="mt-1 resize-none bg-white" maxLength={500} />
      </div>

      <div>
        <Label htmlFor="izin-belge" className="text-xs text-slate-500">
          Belge {tur?.belgeZorunlu ? '(zorunlu' : '(rapor için isteğe bağlı; evlilik/ölüm/babalık için zorunlu'} · PDF, JPG ya da PNG · en çok 10 MB)
        </Label>
        <Input id="izin-belge" type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setBelge(e.target.files?.[0] ?? null)} className="mt-1 bg-white" />
        <p className="mt-1 text-xs text-slate-500">Belgeyi yalnız siz ve İnsan Varlıkları görür; yöneticiniz göremez.</p>
      </div>

      {/* Düşülecek — sade satır (önceki takvim + büyük panel yerine) */}
      <div className="rounded-lg border border-dashed bg-slate-50 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-slate-500">Düşülecek</span>
          <span className={cn('text-base font-semibold tabular-nums', on ? 'text-slate-900' : 'text-slate-400')}>
            {on ? (on.dakika !== null ? `${saatFmt(on.dakika)} sa` : `${gunFmt(on.toplam)} gün`) : 'Tarih seçince hesaplanır'}
          </span>
        </div>
        {on && on.notlar.length > 0 && <ul className="mt-2 space-y-0.5 text-xs leading-snug text-slate-600">{on.notlar.map((n) => <li key={n}>{n}</li>)}</ul>}
        {on?.bakiye && (
          <div className={cn('mt-2 text-xs', on.bakiye.yeterli ? 'text-slate-500' : 'text-amber-800')}>
            Kalan bakiye: <span className="font-medium tabular-nums">{gunFmt(on.bakiye.kalan)} → {gunFmt(on.bakiye.sonrasi)} gün</span>{!on.bakiye.yeterli && ' · bakiye yetersiz'}
          </div>
        )}
        {on?.kota && (
          <div className={cn('mt-1 text-xs', on.kota.yeterli ? 'text-slate-500' : 'text-amber-800')}>
            Kalan dönem kotası: <span className="font-medium tabular-nums">{saatFmt(on.kota.kalanDk)} → {saatFmt(on.kota.sonrasiDk)} sa</span>{!on.kota.yeterli && ' · kota yetersiz'}
          </div>
        )}
        {on?.cakisan && <div className="mt-1 text-xs text-amber-800">Bu tarihlerle çakışan talebiniz var ({tarihFmt(on.cakisan.baslangic)} – {tarihFmt(on.cakisan.bitis)})</div>}
        {onHata && <div className="mt-1 text-xs text-amber-800">{onHata}</div>}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs text-slate-500">{on?.onayMetni ?? 'Onay: Yöneticin → İnsan Varlıkları'}</span>
        <Button onClick={gonder} disabled={!gonderilebilir} className="h-11 px-6">
          {gonderiliyor && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Talebi gönder
        </Button>
      </div>
    </section>
  )
}

// ── Taleplerim ──────────────────────────────────────────────────────────────

function Taleplerim({ talepler, degisti }: { talepler: Talep[]; degisti: () => void }) {
  const [calisan, setCalisan] = useState<string | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const geriCek = async (id: string) => {
    if (!window.confirm('Talebi geri çekmek istiyor musunuz?')) return
    setCalisan(id)
    const { ok, veri } = await istek(`/api/izin/talepler/${id}/geri-cek`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    setCalisan(null)
    if (!ok) return setHata(veri.error ?? 'Geri çekilemedi')
    setHata(null)
    degisti()
  }
  return (
    <section aria-labelledby="taleplerim" className="min-w-0 space-y-3 rounded-lg border bg-white p-4 sm:p-5">
      <h2 id="taleplerim" className="text-base font-semibold">Taleplerim</h2>
      {hata && <p className="text-sm text-amber-800">{hata}</p>}
      {talepler.length === 0 && <p className="py-6 text-center text-sm text-slate-400">Henüz talep yok</p>}
      {talepler.map((t) => (
        <div key={t.id} className="space-y-1.5 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">{t.tur}</span>
            <span className={cn('whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium', DURUM_TON[t.durum])}>{t.durumMetni}</span>
          </div>
          <div className="flex justify-between font-mono text-sm text-slate-700">
            <span>
              {t.baslangic === t.bitis ? tarihFmt(t.baslangic) : `${tarihFmt(t.baslangic)} – ${tarihFmt(t.bitis)}`}
              {t.baslangicYarim === 'OGLEDEN_SONRA' ? ' · öğleden sonra' : ''}{t.bitisYarim === 'SABAH' ? ' · sabah' : ''}
              {t.baslangicSaat && t.bitisSaat ? ` · ${t.baslangicSaat}–${t.bitisSaat}` : ''}{t.belgeSayisi > 0 ? ' · belgeli' : ''}
            </span>
            <span>{t.dakika ? `${saatFmt(t.dakika)} sa` : `${gunFmt(t.gun)} gün`}</span>
          </div>
          <div className="text-xs text-slate-500">{t.adim}</div>
          {t.belgeler && t.belgeler.length > 0 && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
              <span className="text-slate-500">Belgeler:</span>
              {t.belgeler.map((b) => (
                <a key={b.id} href={`/api/izin/belge/${b.id}`} target="_blank" rel="noopener noreferrer" className="font-medium text-slate-800 hover:underline">{b.ad}</a>
              ))}
            </div>
          )}
          {t.geriCekilebilir && (
            <Button variant="outline" size="sm" onClick={() => geriCek(t.id)} disabled={calisan === t.id}>Talebi geri çek</Button>
          )}
        </div>
      ))}
    </section>
  )
}
