'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Clock, Flame, Loader2, Search, Server, Users } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

type Tip = 'GECERLI_KART' | 'TANIMSIZ_KART' | 'PASIF_KART' | 'YETKISIZ' | 'GECIS_SENSORU' | 'YANGIN_ALARMI' | 'DIGER'
type Satir = {
  id: string; zaman: string; kapi: string; yon: 'GIRIS' | 'CIKIS' | null; kartNo: string | null
  sicil: string | null; adSoyad: string | null; tip: Tip; kaynak: 'PUSH' | 'POLL' | 'GV_IMPORT'; sensorBagli: boolean
}
type Kayip = { seriBaslangic: number; seriBitis: number; kayipAdet: number; zamanBaslangic: string | null; zamanBitis: string; tespit: string }
type Veri = {
  gun: { tarih: string; bugun: boolean }
  satirlar: Satir[]
  toplamSatir: number
  kapilar: { id: string; ad: string }[]
  turnikeler: { ad: string; giris: number; cikis: number; sonOlay: string | null; cevrimici: boolean; kapilar: string[] }[]
  iceride: number
  saglik: {
    kod: string; saatSapmaSn: number | null; saatUyari: boolean; saatKontrolAt: string | null; sonPushAt: string | null
    sonPollAt: string | null; cevrimici: boolean; bekleyenBosluk: number; kayipBosluklar: Kayip[]
  }[]
  sonMutabakat: string | null
  tanimsizlar: { kartNo: string | null; bagla: string | null; tip: 'TANIMSIZ_KART' | 'PASIF_KART'; deneme: number; son: string | null; sicil: string | null; adSoyad: string | null }[]
}

// Renk dili: mavi = geçerli, turuncu = tanımsız/uyarı, gri = pasif, KOYU KIRMIZI yalnız yangın.
// Kırmızı-yeşil ayrımı YOK; yangın rozeti ayrıca ikonlu ve dolgulu (renk tek başına taşımaz).
const TIP: Record<Tip, { etiket: string; sinif: string }> = {
  GECERLI_KART: { etiket: 'Geçerli kart', sinif: 'border-blue-200 bg-blue-50 text-blue-800' },
  TANIMSIZ_KART: { etiket: 'Tanımsız kart', sinif: 'border-amber-300 bg-amber-50 text-amber-900' },
  PASIF_KART: { etiket: 'Pasif kart', sinif: 'border-slate-200 bg-slate-100 text-slate-600' },
  YETKISIZ: { etiket: 'Yetkisiz', sinif: 'border-amber-200 bg-white text-amber-800' },
  GECIS_SENSORU: { etiket: 'Geçti (sensör)', sinif: 'border-slate-200 bg-white text-slate-500' },
  YANGIN_ALARMI: { etiket: 'Yangın girişi', sinif: 'border-red-950 bg-red-900 text-white font-semibold' },
  DIGER: { etiket: 'Diğer', sinif: 'border-slate-200 bg-white text-slate-500' },
}

const saat = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'
const tarihSaat = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'
const once = (iso: string | null) => {
  if (!iso) return 'hiç'
  const dk = Math.round((Date.now() - Date.parse(iso)) / 60_000)
  return dk < 1 ? 'az önce' : dk < 60 ? `${dk} dk önce` : dk < 1440 ? `${Math.round(dk / 60)} sa önce` : tarihSaat(iso)
}
const bugunIstanbul = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10)

export function GecislerClient({ canManage }: { canManage: boolean }) {
  const [tarih, setTarih] = useState(bugunIstanbul())
  const [kapiId, setKapiId] = useState('HEPSI')
  const [tip, setTip] = useState('HEPSI')
  const [arama, setArama] = useState('')
  const [q, setQ] = useState('')
  const [veri, setVeri] = useState<Veri | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [yenilendi, setYenilendi] = useState<Date | null>(null)
  const aktifIstek = useRef(0)

  useEffect(() => {
    const t = setTimeout(() => setQ(arama.trim()), 300)
    return () => clearTimeout(t)
  }, [arama])

  const yukle = useCallback(async () => {
    const no = ++aktifIstek.current
    const p = new URLSearchParams({ tarih, q })
    if (kapiId !== 'HEPSI') p.set('kapiId', kapiId)
    if (tip !== 'HEPSI') p.set('tip', tip)
    try {
      const r = await fetch(`/api/pdks/gecisler?${p}`, { cache: 'no-store' })
      const d = await r.json().catch(() => ({}))
      if (no !== aktifIstek.current) return // eski istek — filtre değişti
      if (!r.ok || d.ok === false) return setHata(d.error ?? 'Geçiş kayıtları alınamadı')
      setHata(null)
      setVeri(d as Veri)
      setYenilendi(new Date())
    } catch {
      if (no === aktifIstek.current) setHata('Sunucuya ulaşılamadı')
    }
  }, [tarih, kapiId, tip, q])

  useEffect(() => {
    void yukle()
    if (tarih !== bugunIstanbul()) return
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') void yukle()
    }, 15_000)
    return () => clearInterval(t)
  }, [yukle, tarih])

  const canli = tarih === bugunIstanbul()
  const s = veri?.saglik ?? []

  return (
    <div className="space-y-5">
      <div className="-mt-3 flex items-center gap-2 text-sm text-slate-500">
        {canli ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600" />
            </span>
            Canlı · 15 sn
          </span>
        ) : (
          <span className="rounded-full border px-2 py-0.5 text-xs">Geçmiş gün</span>
        )}
        {yenilendi && <span className="text-xs">son yenileme {saat(yenilendi.toISOString())}</span>}
      </div>

      {/* Üst kartlar: turnikeler + içeride + panel sağlığı */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(veri?.turnikeler ?? []).slice(0, 2).map((t) => (
          <Card key={t.ad} className="shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">{t.ad}</span>
                <span className={cn('inline-flex items-center gap-1 text-xs', t.cevrimici ? 'text-blue-700' : 'text-slate-500')}>
                  <span className={cn('h-2 w-2 rounded-full', t.cevrimici ? 'bg-blue-600' : 'bg-slate-300')} />
                  {t.cevrimici ? 'çevrimiçi' : 'çevrimdışı'}
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-4 tabular-nums">
                <span className="flex items-center gap-1 text-2xl font-semibold text-slate-900"><ArrowDownLeft className="h-4 w-4 text-blue-600" />{t.giris}</span>
                <span className="flex items-center gap-1 text-2xl font-semibold text-slate-900"><ArrowUpRight className="h-4 w-4 text-slate-500" />{t.cikis}</span>
              </div>
              <div className="mt-1 text-xs text-slate-500">giriş · çıkış (bugün) · son olay {saat(t.sonOlay)}</div>
            </CardContent>
          </Card>
        ))}
        {veri && veri.turnikeler.length < 2 &&
          Array.from({ length: 2 - veri.turnikeler.length }).map((_, i) => (
            <Card key={`bos${i}`} className="border-dashed shadow-none">
              <CardContent className="flex h-full items-center p-4 text-sm text-slate-400">Turnike tanımlı değil</CardContent>
            </Card>
          ))}
        <Card className="shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700"><Users className="h-4 w-4 text-blue-700" /> Şu an içeride</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{veri?.iceride ?? '—'}</div>
            <div className="mt-1 text-xs text-slate-500">son geçişi GİRİŞ olan aktif personel (16 sa)</div>
          </CardContent>
        </Card>
        <Card className={cn('shadow-none', s.some((c) => c.saatUyari || c.kayipBosluklar.length) && 'border-amber-300')}>
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700"><Server className="h-4 w-4 text-slate-500" /> Panel sağlığı</div>
            {s.length === 0 && <div className="mt-2 text-sm text-slate-400">Aktif panel yok</div>}
            {s.map((c) => (
              <div key={c.kod} className="mt-2 space-y-0.5 text-xs text-slate-600">
                <div className="font-medium text-slate-800">{c.kod} · {c.cevrimici ? 'çevrimiçi' : 'çevrimdışı'}</div>
                <div className={cn(c.saatUyari && 'font-medium text-amber-800')}>
                  <Clock className="mr-1 inline h-3 w-3" />
                  saat farkı {c.saatSapmaSn === null ? '—' : `${c.saatSapmaSn > 0 ? '+' : ''}${c.saatSapmaSn} sn`}
                  {c.saatUyari && ' — NTP kontrol'}
                </div>
                <div>bekleyen boşluk {c.bekleyenBosluk} · push {once(c.sonPushAt)} · sorgu {once(c.sonPollAt)}</div>
                {c.kayipBosluklar.map((k) => (
                  <div key={`${k.tespit}${k.seriBaslangic}`} className="flex gap-1 rounded bg-amber-50 px-1.5 py-1 font-medium text-amber-900">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    KAYIP: seri {k.seriBaslangic}–{k.seriBitis} ({k.kayipAdet} olay), {tarihSaat(k.zamanBaslangic)} → {tarihSaat(k.zamanBitis)}
                  </div>
                ))}
              </div>
            ))}
            <div className="mt-2 text-xs text-slate-500">son mutabakat {once(veri?.sonMutabakat ?? null)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtreler */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={kapiId} onValueChange={setKapiId}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Kapı" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="HEPSI">Tüm kapılar</SelectItem>
            {(veri?.kapilar ?? []).map((k) => <SelectItem key={k.id} value={k.id}>{k.ad}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={tip} onValueChange={setTip}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Olay tipi" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="HEPSI">Tüm olaylar</SelectItem>
            {(Object.keys(TIP) as Tip[]).map((t) => <SelectItem key={t} value={t}>{TIP[t].etiket}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input value={arama} onChange={(e) => setArama(e.target.value)} placeholder="Sicil, ad veya kart no" className="pl-8" />
        </div>
        <Input type="date" value={tarih} max={bugunIstanbul()} onChange={(e) => e.target.value && setTarih(e.target.value)} className="w-40" />
      </div>

      {hata && <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">{hata}</div>}

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        {/* Tablo */}
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Saat</th>
                <th className="px-3 py-2">Kapı</th>
                <th className="px-3 py-2">Yön</th>
                <th className="px-3 py-2">Kart no</th>
                <th className="px-3 py-2">Sicil</th>
                <th className="px-3 py-2">Personel</th>
                <th className="px-3 py-2">Olay</th>
              </tr>
            </thead>
            <tbody>
              {veri?.satirlar.map((r) => (
                <tr key={r.id} className={cn('border-t', r.tip === 'YANGIN_ALARMI' && 'bg-red-50')}>
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono tabular-nums" title={r.kaynak === 'POLL' ? 'boşluk doldurmayla alındı' : undefined}>
                    {saat(r.zaman)}{r.kaynak === 'POLL' && <span className="ml-1 text-slate-400">·</span>}
                  </td>
                  <td className="px-3 py-1.5">{r.kapi}</td>
                  <td className="px-3 py-1.5">
                    {r.yon === 'GIRIS' ? <span className="text-blue-800">Giriş</span> : r.yon === 'CIKIS' ? <span className="text-slate-600">Çıkış</span> : '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono">{r.kartNo ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-1.5">{r.sicil ?? '—'}</td>
                  <td className="px-3 py-1.5">{r.adSoyad ?? '—'}</td>
                  <td className="px-3 py-1.5">
                    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs', TIP[r.tip].sinif)}>
                      {r.tip === 'YANGIN_ALARMI' && <Flame className="h-3 w-3" />}
                      {TIP[r.tip].etiket}
                    </span>
                  </td>
                </tr>
              ))}
              {veri && veri.satirlar.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-400">Bu gün için geçiş kaydı yok</td></tr>
              )}
              {!veri && !hata && (
                <tr><td colSpan={7} className="px-3 py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></td></tr>
              )}
            </tbody>
          </table>
          {veri && veri.toplamSatir > veri.satirlar.length && (
            <div className="border-t px-3 py-2 text-xs text-slate-500">
              En yeni {veri.satirlar.length} kayıt gösteriliyor (toplam {veri.toplamSatir}) — filtreyle daraltın.
            </div>
          )}
        </div>

        {/* Sağ panel: tanımsız / pasif kart okutmaları */}
        <Card className="h-fit shadow-none">
          <CardContent className="p-4">
            <div className="text-sm font-medium text-slate-700">Tanımsız kartlar</div>
            <div className="text-xs text-slate-500">{veri?.gun.bugun ? 'Bugünkü' : `${veri?.gun.tarih ?? ''} günündeki`} tanımsız ve pasif kart okutmaları</div>
            <ul className="mt-3 space-y-2">
              {(veri?.tanimsizlar ?? []).map((t) => (
                <li key={`${t.tip}${t.kartNo}`} className="rounded-md border px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono">{t.kartNo ?? '—'}</span>
                    <span className={cn('rounded-full border px-2 py-0.5 text-xs', TIP[t.tip].sinif)}>{TIP[t.tip].etiket}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {t.deneme} deneme · son {saat(t.son)}
                    {t.sicil && <> · {t.sicil} {t.adSoyad}</>}
                  </div>
                  {canManage && t.tip === 'TANIMSIZ_KART' && t.bagla && (
                    <Link
                      href={`/pdks/kartlar?kartNo=${encodeURIComponent(t.bagla)}`}
                      className="mt-1 inline-flex items-center gap-0.5 text-xs font-medium text-[#1B4F72] hover:underline"
                    >
                      Personele bağla <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </li>
              ))}
              {veri && veri.tanimsizlar.length === 0 && <li className="text-sm text-slate-400">Yok</li>}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
