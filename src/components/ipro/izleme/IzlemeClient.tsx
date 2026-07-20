'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Activity, AlertTriangle, Factory, Maximize, Minimize, RefreshCw, Search, Signal } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const POLL_MS = 10_000

type Calisan = {
  adSoyad: string | null
  sicilNo: string | null
  ifsOrderNo: string | null
  ifsOperationNo: number | null
  baslatildiAt: string
}
type Tezgah = {
  id: string
  kod: string
  ad: string
  masGrupAdi: string | null
  aktif: boolean
  sinyalli: boolean
  calisan: Calisan | null
}
type Pano = {
  olusturuldu: string
  tezgahlar: Tezgah[]
  ozet: { kapananIs: number; toplamIyi: number; toplamHurda: number; aktifOperator: number }
  kuyruk: { bekleyen: number; enEskiBeklemeAt: string | null; hataliKayit: number }
}

/** ms → "1s 12dk" / "12dk" / "45sn". Canlı süre için. */
function sureBicim(ms: number): string {
  const dk = Math.floor(ms / 60000)
  if (dk < 1) return `${Math.floor(ms / 1000)}sn`
  if (dk < 60) return `${dk}dk`
  return `${Math.floor(dk / 60)}s ${dk % 60}dk`
}

export function IzlemeClient() {
  const [pano, setPano] = useState<Pano | null>(null)
  const [ilkYukleme, setIlkYukleme] = useState(true)
  const [hata, setHata] = useState(false)
  const [arama, setArama] = useState('')
  const [grup, setGrup] = useState<string>('hepsi')
  const [tvModu, setTvModu] = useState(false)
  // Süre etiketlerini her saniye tazelemek için (fetch'ten bağımsız).
  const [, tik] = useState(0)

  const yukle = useCallback(async () => {
    try {
      const res = await fetch('/api/ipro/izleme', { cache: 'no-store' })
      const data = await res.json()
      if (res.ok && data?.ok) {
        setPano(data)
        setHata(false)
      } else {
        setHata(true)
      }
    } catch {
      setHata(true) // ağ hatası — poller ölmesin, bir sonraki tik'te tekrar dener
    } finally {
      setIlkYukleme(false)
    }
  }, [])

  // Polling — sekme gizliyken durur (gereksiz istek + pil).
  useEffect(() => {
    void yukle()
    let id: ReturnType<typeof setInterval> | null = null
    const baslat = () => {
      if (id) return
      id = setInterval(() => void yukle(), POLL_MS)
    }
    const durdur = () => {
      if (id) {
        clearInterval(id)
        id = null
      }
    }
    const gorunurluk = () => (document.hidden ? durdur() : (void yukle(), baslat()))
    baslat()
    document.addEventListener('visibilitychange', gorunurluk)
    return () => {
      durdur()
      document.removeEventListener('visibilitychange', gorunurluk)
    }
  }, [yukle])

  // Süre sayaçları için saniyelik tik.
  useEffect(() => {
    const id = setInterval(() => tik((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const gruplar = useMemo(() => {
    const set = new Set<string>()
    pano?.tezgahlar.forEach((t) => set.add(t.masGrupAdi ?? '(grupsuz)'))
    return [...set].sort((a, b) => a.localeCompare(b, 'tr'))
  }, [pano])

  const gosterilen = useMemo(() => {
    if (!pano) return []
    const q = arama.trim().toLocaleLowerCase('tr')
    return pano.tezgahlar.filter((t) => {
      if (grup !== 'hepsi' && (t.masGrupAdi ?? '(grupsuz)') !== grup) return false
      if (!q) return true
      return (
        t.kod.toLocaleLowerCase('tr').includes(q) ||
        t.ad.toLocaleLowerCase('tr').includes(q) ||
        (t.calisan?.adSoyad ?? '').toLocaleLowerCase('tr').includes(q)
      )
    })
  }, [pano, arama, grup])

  const calisanSayisi = gosterilen.filter((t) => t.calisan).length

  return (
    <div className={tvModu ? 'ipro-izleme-tv fixed inset-0 z-50 overflow-auto bg-slate-950 p-6 text-slate-100' : ''}>
      {/* Gün özeti şeridi */}
      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl bg-slate-900 px-5 py-4 text-slate-100">
        <Activity className="h-6 w-6 text-emerald-400" />
        <Ozet etiket="Kapanan iş" deger={pano?.ozet.kapananIs ?? 0} />
        <Ozet etiket="İyi" deger={pano?.ozet.toplamIyi ?? 0} renk="text-emerald-300" />
        <Ozet etiket="Hurda" deger={pano?.ozet.toplamHurda ?? 0} renk="text-red-300" />
        <Ozet etiket="Aktif operatör" deger={pano?.ozet.aktifOperator ?? 0} />
        <div className="ml-auto flex items-center gap-2 text-sm text-slate-400">
          {hata && <span className="text-amber-400">bağlantı hatası — yeniden deneniyor</span>}
          <RefreshCw className="h-4 w-4" />
          {pano ? new Date(pano.olusturuldu).toLocaleTimeString('tr-TR') : '—'}
          <Button variant="ghost" size="sm" onClick={() => setTvModu((v) => !v)} title="TV modu">
            {tvModu ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Araç çubuğu — TV modunda gizli */}
      {!tvModu && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input value={arama} onChange={(e) => setArama(e.target.value)} placeholder="Tezgah, ad veya operatör ara…" className="pl-8" />
          </div>
          <div className="flex flex-wrap gap-1">
            <Button variant={grup === 'hepsi' ? 'default' : 'outline'} size="sm" onClick={() => setGrup('hepsi')}>
              Hepsi
            </Button>
            {gruplar.map((g) => (
              <Button key={g} variant={grup === g ? 'default' : 'outline'} size="sm" onClick={() => setGrup(g)}>
                {g}
              </Button>
            ))}
          </div>
          <Badge variant="outline">
            {calisanSayisi} çalışıyor / {gosterilen.length}
          </Badge>
        </div>
      )}

      {/* Grid */}
      {ilkYukleme ? (
        <p className="py-16 text-center text-sm text-slate-500">Yükleniyor…</p>
      ) : gosterilen.length === 0 ? (
        <div className="py-16 text-center text-slate-500">
          <Factory className="mx-auto mb-3 h-10 w-10 opacity-40" />
          <p>Filtreye uyan tezgah yok.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {gosterilen.map((t) => (
            <Kart key={t.id} tezgah={t} tv={tvModu} />
          ))}
        </div>
      )}

      {/* IFS kuyruk sağlığı — köşe şeridi, TV modunda gizli */}
      {!tvModu && pano && (
        <div className="mt-6 flex flex-wrap items-center gap-4 rounded-xl border px-5 py-3 text-sm">
          <AlertTriangle className={`h-4 w-4 ${pano.kuyruk.bekleyen > 0 || pano.kuyruk.hataliKayit > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
          <span className="font-medium text-slate-600">IFS kuyruğu</span>
          <span>bekleyen: <strong>{pano.kuyruk.bekleyen}</strong></span>
          <span>en eski: {pano.kuyruk.enEskiBeklemeAt ? new Date(pano.kuyruk.enEskiBeklemeAt).toLocaleString('tr-TR') : '—'}</span>
          <span className={pano.kuyruk.hataliKayit > 0 ? 'text-red-600' : ''}>hata: <strong>{pano.kuyruk.hataliKayit}</strong></span>
          <span className="ml-auto text-xs text-slate-400">planlama için değil — kuyruk erken uyarısı</span>
        </div>
      )}
    </div>
  )
}

function Ozet({ etiket, deger, renk = '' }: { etiket: string; deger: number; renk?: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`text-2xl font-bold ${renk}`}>{deger}</span>
      <span className="text-sm text-slate-400">{etiket}</span>
    </div>
  )
}

function Kart({ tezgah, tv }: { tezgah: Tezgah; tv: boolean }) {
  const c = tezgah.calisan
  const calisiyor = !!c
  const sure = c ? sureBicim(Date.now() - new Date(c.baslatildiAt).getTime()) : null

  return (
    <div
      className={[
        'rounded-xl border p-3 transition-colors',
        calisiyor
          ? 'border-emerald-500/60 bg-emerald-50 dark:bg-emerald-950/40'
          : tv
            ? 'border-slate-700 bg-slate-900'
            : 'border-slate-200 bg-slate-50',
      ].join(' ')}
    >
      <div className="flex items-center justify-between">
        <span className={`text-lg font-bold ${tv && !calisiyor ? 'text-slate-300' : ''}`}>{tezgah.kod}</span>
        <span className="flex items-center gap-1">
          {tezgah.sinyalli && <Signal className="h-3.5 w-3.5 text-slate-400" />}
          <span className={`h-2.5 w-2.5 rounded-full ${calisiyor ? 'bg-emerald-500' : 'bg-slate-300'}`} />
        </span>
      </div>
      <p className={`truncate text-xs ${tv && !calisiyor ? 'text-slate-500' : 'text-slate-400'}`}>{tezgah.ad}</p>

      {calisiyor ? (
        <div className="mt-2 space-y-0.5">
          <p className="truncate text-sm font-medium">{c!.adSoyad ?? c!.sicilNo ?? '—'}</p>
          <p className="text-xs text-slate-500">
            {c!.ifsOrderNo ? `${c!.ifsOrderNo}/${c!.ifsOperationNo ?? '—'}` : 'iş bilgisi yok'}
          </p>
          <p className="text-xs font-semibold text-emerald-600">{sure}</p>
        </div>
      ) : (
        <p className={`mt-2 text-sm ${tv ? 'text-slate-600' : 'text-slate-400'}`}>boşta</p>
      )}
    </div>
  )
}
