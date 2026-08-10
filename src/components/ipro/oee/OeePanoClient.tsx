'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Factory, RefreshCw, Search, Signal, User } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const POLL_MS = 10_000

// ─────────── tipler (server string durum + sayılar + ISO — LucideIcon GEÇMEZ) ───────────
type Durum = 'calisiyor' | 'durusta' | 'bosta'
type Calisan = {
  adSoyad: string | null
  sicilNo: string | null
  ifsOrderNo: string | null
  ifsOperationNo: number | null
  ifsPartNo: string | null
  ifsPartDescription: string | null
  baslatildiAt: string
}
type CanliOee = {
  availability: number | null
  performance: number | null
  quality: null
  oeeCanli: number | null
  durum: 'CANLI_KISMI' | 'PLANLI_YOK'
  planliSaniye: number
  durusSaniye: number
  uretilen: number
  idealGuvenilir: boolean
  ornekSayisi: number
}
type Tezgah = {
  id: string
  kod: string
  ad: string
  hat: string | null
  sinyalli: boolean
  durum: Durum
  calisan: Calisan | null
  canliOee: CanliOee | null
}
type Pano = {
  olusturuldu: string
  esik: number
  tezgahlar: Tezgah[]
  ozet: { toplam: number; calisiyor: number; durusta: number; bosta: number; aktifOperator: number }
}

type Filtre = 'tumu' | 'calisiyor' | 'durusta' | 'aktif'

// ─────────── client-owns-styling: durum → renk (server yalnız string yollar) ───────────
const DURUM_STIL: Record<Durum, { nokta: string; kenar: string; rozet: string; etiket: string }> = {
  calisiyor: { nokta: 'bg-emerald-500', kenar: 'border-l-emerald-500', rozet: 'bg-emerald-50 text-emerald-700 border-emerald-200', etiket: 'Çalışıyor' },
  durusta: { nokta: 'bg-rose-500', kenar: 'border-l-rose-500', rozet: 'bg-rose-50 text-rose-700 border-rose-200', etiket: 'Duruşta' },
  bosta: { nokta: 'bg-slate-300', kenar: 'border-l-slate-300', rozet: 'bg-slate-50 text-slate-500 border-slate-200', etiket: 'Boşta' },
}

function yuzde(v: number | null): string {
  return v == null ? '—' : `%${Math.round(v * 100)}`
}

// OEE renk eşiği (görsel): ≥%85 yeşil, ≥%60 amber, <%60 kırmızı, null gri.
function oeeRenk(v: number | null): string {
  if (v == null) return '#94a3b8'
  if (v >= 0.85) return '#10b981'
  if (v >= 0.6) return '#d99b3c'
  return '#e11d48'
}

// ─────────── inline SVG halka gösterge (shadcn'de gauge yok — SVG serbest) ───────────
function Halka({ deger, boyut = 96, kalinlik = 10, etiket }: { deger: number | null; boyut?: number; kalinlik?: number; etiket?: string }) {
  const r = (boyut - kalinlik) / 2
  const cevre = 2 * Math.PI * r
  const oran = deger == null ? 0 : Math.max(0, Math.min(1, deger))
  const renk = oeeRenk(deger)
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: boyut, height: boyut }}>
      <svg width={boyut} height={boyut} className="-rotate-90">
        <circle cx={boyut / 2} cy={boyut / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={kalinlik} />
        <circle
          cx={boyut / 2}
          cy={boyut / 2}
          r={r}
          fill="none"
          stroke={renk}
          strokeWidth={kalinlik}
          strokeLinecap="round"
          strokeDasharray={cevre}
          strokeDashoffset={cevre * (1 - oran)}
        />
      </svg>
      <div className="absolute flex flex-col items-center leading-none">
        <span className="text-lg font-bold" style={{ color: renk }}>{yuzde(deger)}</span>
        {etiket ? <span className="mt-0.5 text-[10px] text-slate-400">{etiket}</span> : null}
      </div>
    </div>
  )
}

// mini bileşen çubuğu (Kullan/Perf/Kalite)
function MiniCubuk({ etiket, deger, notNull }: { etiket: string; deger: number | null; notNull?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-[11px] text-slate-500">{etiket}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        {deger != null ? (
          <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(1, deger)) * 100}%`, background: oeeRenk(deger) }} />
        ) : null}
      </div>
      <span className="w-16 shrink-0 text-right text-[11px] font-medium text-slate-600">{deger != null ? yuzde(deger) : (notNull ?? '—')}</span>
    </div>
  )
}

export function OeePanoClient() {
  const [pano, setPano] = useState<Pano | null>(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)
  const [filtre, setFiltre] = useState<Filtre>('tumu')
  const [arama, setArama] = useState('')
  const [secili, setSecili] = useState<Tezgah | null>(null)

  const cek = useCallback(async () => {
    try {
      const res = await fetch('/api/ipro/oee-pano', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const d = (await res.json()) as Pano & { ok: boolean }
      setPano(d)
      setHata(null)
    } catch (e) {
      setHata((e as Error)?.message ?? 'Veri alınamadı')
    } finally {
      setYukleniyor(false)
    }
  }, [])

  useEffect(() => {
    cek()
    const t = setInterval(cek, POLL_MS)
    return () => clearInterval(t)
  }, [cek])

  const gosterilen = useMemo(() => {
    if (!pano) return []
    const q = arama.trim().toLocaleLowerCase('tr')
    return pano.tezgahlar.filter((t) => {
      if (filtre === 'calisiyor' && t.durum !== 'calisiyor') return false
      if (filtre === 'durusta' && t.durum !== 'durusta') return false
      if (filtre === 'aktif' && !t.calisan) return false
      if (q && !`${t.kod} ${t.ad} ${t.hat ?? ''}`.toLocaleLowerCase('tr').includes(q)) return false
      return true
    })
  }, [pano, filtre, arama])

  // seçili kartı taze veriyle senkron tut (poll sonrası dialog güncel kalsın)
  const seciliCanli = useMemo(
    () => (secili && pano ? pano.tezgahlar.find((t) => t.id === secili.id) ?? secili : secili),
    [secili, pano],
  )

  return (
    <div className="space-y-4">
      {/* üst şerit — sayaçlar + filtre + arama */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-white px-4 py-3">
        {pano ? (
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <Sayac etiket="Tezgah" deger={pano.ozet.toplam} />
            <Sayac etiket="Çalışıyor" deger={pano.ozet.calisiyor} renk="text-emerald-600" />
            <Sayac etiket="Duruşta" deger={pano.ozet.durusta} renk="text-rose-600" />
            <Sayac etiket="Boşta" deger={pano.ozet.bosta} renk="text-slate-400" />
            <Sayac etiket="Aktif operatör" deger={pano.ozet.aktifOperator} />
          </div>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-lg border p-0.5">
            {(['tumu', 'calisiyor', 'durusta', 'aktif'] as Filtre[]).map((f) => (
              <button
                key={f}
                onClick={() => setFiltre(f)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${filtre === f ? 'bg-[#1B4F72] text-white' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                {f === 'tumu' ? 'Tümü' : f === 'calisiyor' ? 'Çalışıyor' : f === 'durusta' ? 'Duruşta' : 'Aktif iş'}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input value={arama} onChange={(e) => setArama(e.target.value)} placeholder="Ara…" className="h-8 w-40 pl-7 text-xs" />
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={cek} title="Yenile">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {hata ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">Veri alınamadı: {hata}</div> : null}
      {yukleniyor && !pano ? <div className="py-12 text-center text-sm text-slate-400">Yükleniyor…</div> : null}

      {/* tezgah kartları grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {gosterilen.map((t) => (
          <TezgahKarti key={t.id} t={t} esik={pano!.esik} onClick={() => setSecili(t)} />
        ))}
      </div>
      {pano && gosterilen.length === 0 ? <div className="py-12 text-center text-sm text-slate-400">Eşleşen tezgah yok.</div> : null}

      {/* detay dialog */}
      <Dialog open={!!secili} onOpenChange={(o) => !o && setSecili(null)}>
        <DialogContent className="max-w-2xl">
          {seciliCanli ? <Detay t={seciliCanli} esik={pano?.esik ?? 50} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Sayac({ etiket, deger, renk }: { etiket: string; deger: number; renk?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-lg font-bold ${renk ?? 'text-slate-700'}`}>{deger}</span>
      <span className="text-xs text-slate-400">{etiket}</span>
    </div>
  )
}

function TezgahKarti({ t, esik, onClick }: { t: Tezgah; esik: number; onClick: () => void }) {
  const stil = DURUM_STIL[t.durum]
  const c = t.canliOee
  return (
    <Card
      onClick={onClick}
      className={`cursor-pointer border-l-4 p-3 transition hover:shadow-md ${stil.kenar}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 shrink-0 rounded-full ${stil.nokta}`} />
            <span className="truncate font-semibold text-slate-800">{t.kod}</span>
            {t.sinyalli ? <Signal className="h-3 w-3 shrink-0 text-slate-300" /> : null}
          </div>
          <div className="truncate text-[11px] text-slate-400">{t.ad}</div>
        </div>
        <Badge variant="outline" className={`shrink-0 text-[10px] ${stil.rozet}`}>{stil.etiket}</Badge>
      </div>

      {c ? (
        <div className="mt-2 flex items-center gap-3">
          <Halka deger={c.oeeCanli} boyut={72} kalinlik={8} etiket="OEE" />
          <div className="min-w-0 flex-1 space-y-1">
            <MiniCubuk etiket="Kullan." deger={c.availability} />
            <MiniCubuk etiket="Perf." deger={c.performance} notNull={c.idealGuvenilir ? '—' : `${c.ornekSayisi}/${esik}`} />
            <MiniCubuk etiket="Kalite" deger={null} notNull="iş bitince" />
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
          <Factory className="h-3.5 w-3.5" /> {t.durum === 'durusta' ? 'Duruşta — açık iş yok' : 'Açık iş yok'}
        </div>
      )}

      {t.calisan ? (
        <div className="mt-2 truncate border-t pt-1.5 text-[11px] text-slate-500">
          {t.calisan.ifsOrderNo ?? '—'}/{t.calisan.ifsOperationNo ?? '—'} · {t.calisan.ifsPartNo ?? 'malzeme —'}
        </div>
      ) : null}
    </Card>
  )
}

function Detay({ t, esik }: { t: Tezgah; esik: number }) {
  const c = t.canliOee
  const stil = DURUM_STIL[t.durum]
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${stil.nokta}`} />
          {t.kod} — {t.ad}
          <Badge variant="outline" className={`text-[10px] ${stil.rozet}`}>{stil.etiket}</Badge>
        </DialogTitle>
        <DialogDescription>{t.hat ?? 'Hat —'} · {t.sinyalli ? 'Sinyalli' : 'Sinyalsiz'}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* sol — künye */}
        <div className="space-y-2 text-sm">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Açık İş</h4>
          {t.calisan ? (
            <dl className="space-y-1">
              <Satir k="İş emri" v={`${t.calisan.ifsOrderNo ?? '—'} / op ${t.calisan.ifsOperationNo ?? '—'}`} />
              <Satir k="Malzeme" v={t.calisan.ifsPartNo ?? '—'} />
              <Satir k="Açıklama" v={t.calisan.ifsPartDescription ?? '—'} />
              <Satir k="Operatör" v={`${t.calisan.adSoyad ?? '—'}${t.calisan.sicilNo ? ` (${t.calisan.sicilNo})` : ''}`} />
              <Satir k="Başlangıç" v={new Date(t.calisan.baslatildiAt).toLocaleString('tr-TR')} />
              {c ? <Satir k="Üretilen (canlı)" v={`${c.uretilen} adet`} /> : null}
            </dl>
          ) : (
            <p className="text-slate-400">Açık iş yok — OEE hesaplanmaz.</p>
          )}
          <p className="flex items-center gap-1.5 pt-1 text-[11px] text-slate-400"><User className="h-3 w-3" /> Personel uyumu ayrı raporda.</p>
        </div>

        {/* sağ — 4 halka */}
        <div className="grid grid-cols-2 place-items-center gap-3">
          <Halka deger={c?.oeeCanli ?? null} etiket="OEE" />
          <Halka deger={c?.availability ?? null} etiket="Kullan." />
          <Halka deger={c?.performance ?? null} etiket="Perf." />
          <Halka deger={null} etiket="Kalite" />
        </div>
      </div>

      {/* durum notları */}
      <div className="space-y-1 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
        <p>• <b>Kalite</b> açık işte hesaplanmaz — operatör iyi/hurda'yı iş bitince girer; <b>tam OEE iş kapanınca</b> hesaplanır.</p>
        {c && !c.idealGuvenilir ? (
          <p>• <b>Performans</b> için ideal çevrim henüz güvenilir değil — veri birikiyor (<b>{c.ornekSayisi}/{esik}</b> gözlem).</p>
        ) : null}
        {c && c.durum === 'PLANLI_YOK' ? <p>• Planlı süre 0 (vardiya/tatil dışı) — Kullanılabilirlik hesaplanamıyor.</p> : null}
      </div>
    </>
  )
}

function Satir({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-slate-400">{k}</dt>
      <dd className="truncate text-right font-medium text-slate-700">{v}</dd>
    </div>
  )
}
