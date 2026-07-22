'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, RefreshCw, Search, Signal, WifiOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { iproNormalize } from '@/lib/ipro/metin'

const POLL_MS = 5_000

type PlcSaglik = {
  kod: string
  ip: string
  connected: boolean
  lastReadAt: string | null
  lastError: string | null
  backoffMs: number
  sonOkumaYasiMs: number | null
  okumaHatasiToplam: number
  sonHataZamani: string | null
  yenidenBaglanmaSayisi: number
  ardArdaHataSayisi: number
  zorlaKopmaSayisi: number
  baselineTazelemeSayisi: number
}
type Health = {
  sonOkuma: string | null
  pollIntervalMs: number
  bayatlikMs: number
  tezgah: { taze: number; bayat: number; toplam: number }
  plclar: PlcSaglik[]
}
type Pin = {
  kod: number
  plc: string
  tezgahKod: string | null
  curSayac: number
  lastDelta: number
  durusBit: boolean
  sonOkuma: string | null
  bayat: boolean
}
type Cevap = {
  ok: boolean
  pollerErisilebilir: boolean
  hata?: string
  olusturuldu: string
  health: Health | null
  pins: Pin[]
}

type SiralamaAlan = 'kod' | 'plc' | 'tezgahKod' | 'curSayac' | 'lastDelta'

const ms = (n: number | null) => (n == null ? '—' : n < 1000 ? `${n} ms` : `${(n / 1000).toFixed(1)} sn`)
const saat = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('tr-TR') : '—')

export function SinyalClient() {
  const [veri, setVeri] = useState<Cevap | null>(null)
  const [ilkYukleme, setIlkYukleme] = useState(true)
  const [agHatasi, setAgHatasi] = useState(false)
  const [arama, setArama] = useState('')
  const [plcFiltre, setPlcFiltre] = useState<string>('hepsi')
  const [yalnizBayat, setYalnizBayat] = useState(false)
  const [yalnizHareketli, setYalnizHareketli] = useState(false)
  const [siralama, setSiralama] = useState<{ alan: SiralamaAlan; artan: boolean }>({ alan: 'kod', artan: true })

  const yukle = useCallback(async () => {
    try {
      const res = await fetch('/api/ipro/sinyal', { cache: 'no-store' })
      const d = (await res.json()) as Cevap
      if (res.ok && d?.ok) {
        setVeri(d)
        setAgHatasi(false)
      } else setAgHatasi(true)
    } catch {
      setAgHatasi(true) // ağ hatası — poller ölmesin, bir sonraki tik'te tekrar dener
    } finally {
      setIlkYukleme(false)
    }
  }, [])

  // Polling — sekme gizliyken DURUR (izleme panosundaki desen).
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

  const plcKodlari = useMemo(() => {
    const s = new Set<string>()
    veri?.pins.forEach((p) => s.add(p.plc))
    return [...s].sort((a, b) => a.localeCompare(b, 'tr'))
  }, [veri])

  const gosterilen = useMemo(() => {
    if (!veri) return []
    const q = iproNormalize(arama.trim())
    const liste = veri.pins.filter((p) => {
      if (plcFiltre !== 'hepsi' && p.plc !== plcFiltre) return false
      if (yalnizBayat && !p.bayat) return false
      if (yalnizHareketli && p.lastDelta <= 0) return false
      if (!q) return true
      // Aksan katlamalı arama: "sasi" → "şasi" de bulur.
      return (
        iproNormalize(String(p.kod)).includes(q) ||
        iproNormalize(p.plc).includes(q) ||
        iproNormalize(p.tezgahKod ?? '').includes(q)
      )
    })
    const { alan, artan } = siralama
    const yon = artan ? 1 : -1
    return [...liste].sort((a, b) => {
      const av = a[alan]
      const bv = b[alan]
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * yon
      return String(av ?? '').localeCompare(String(bv ?? ''), 'tr', { numeric: true }) * yon
    })
  }, [veri, arama, plcFiltre, yalnizBayat, yalnizHareketli, siralama])

  const sirala = (alan: SiralamaAlan) =>
    setSiralama((s) => ({ alan, artan: s.alan === alan ? !s.artan : true }))

  const health = veri?.health
  const erisilemez = veri && !veri.pollerErisilebilir

  return (
    <div className="space-y-4">
      {/* Üst şerit: son güncelleme */}
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
        <RefreshCw className="h-4 w-4" />
        <span>Son güncelleme: {veri ? new Date(veri.olusturuldu).toLocaleTimeString('tr-TR') : '—'}</span>
        {agHatasi && <span className="text-amber-600">bağlantı hatası — yeniden deneniyor</span>}
        {health && (
          <span className="ml-auto text-xs">
            poller aralığı {ms(health.pollIntervalMs)} · bayatlık eşiği {ms(health.bayatlikMs)}
          </span>
        )}
      </div>

      {/* Poller erişilemiyor — net durum (boş tablo DEĞİL) */}
      {erisilemez && (
        <div className="rounded-xl border-2 border-red-300 bg-red-50 p-5">
          <div className="flex items-center gap-2 text-lg font-bold text-red-700">
            <WifiOff className="h-5 w-5" /> Poller erişilemiyor
          </div>
          <p className="mt-1 text-sm text-red-600">
            PLC poller servisi (127.0.0.1:3020) yanıt vermiyor. Sinyalli tezgahlarda iş başlatma
            503 verir. Servis durumu: <code className="rounded bg-red-100 px-1">pm2 list</code>
          </p>
          {veri?.hata && <p className="mt-1 font-mono text-xs text-red-500">{veri.hata}</p>}
        </div>
      )}

      {ilkYukleme && <p className="py-10 text-center text-sm text-slate-400">Yükleniyor…</p>}

      {/* Tezgah tazelik özeti — /status'ten düşen tezgah = operatörün gördüğü 503 */}
      {health && (
        <div
          className={`rounded-xl border p-4 ${
            health.tezgah.bayat > 0 ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-600">{health.tezgah.taze}</span>
              <span className="text-sm text-slate-500">taze</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold ${health.tezgah.bayat > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                {health.tezgah.bayat}
              </span>
              <span className="text-sm text-slate-500">bayat</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-600">{health.tezgah.toplam}</span>
              <span className="text-sm text-slate-500">toplam tezgah</span>
            </div>
            {health.tezgah.bayat > 0 && (
              <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
                <AlertTriangle className="h-4 w-4" />
                {health.tezgah.bayat} tezgah /status'ten düştü — o tezgahlarda iş başlatma 503 veriyor
              </div>
            )}
          </div>
        </div>
      )}

      {/* PLC kartları */}
      {health && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {health.plclar.map((p) => (
            <PlcKart key={p.kod} p={p} />
          ))}
        </div>
      )}

      {/* Sayaçların kapsamı — yanlış okumayı önler */}
      {health && (
        <p className="text-xs text-slate-400">
          Hata/bağlantı sayaçları <strong>son poller reload'undan beridir</strong> — bellekte tutulur,
          <code className="mx-1 rounded bg-slate-100 px-1">pm2 reload</code>
          ile sıfırlanır. Sayaçların 0 olması "hiç epizod yaşanmadı" anlamına GELMEZ; yalnız son
          reload'dan bu yana yaşanmadığını gösterir.
        </p>
      )}

      {/* Filtre çubuğu */}
      {veri && veri.pins.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              placeholder="Pin kodu, PLC veya tezgah ara…"
              className="pl-8"
            />
          </div>
          <Button variant={plcFiltre === 'hepsi' ? 'default' : 'outline'} size="sm" onClick={() => setPlcFiltre('hepsi')}>
            Tüm PLC
          </Button>
          {plcKodlari.map((k) => (
            <Button key={k} variant={plcFiltre === k ? 'default' : 'outline'} size="sm" onClick={() => setPlcFiltre(k)}>
              {k}
            </Button>
          ))}
          <Button variant={yalnizBayat ? 'default' : 'outline'} size="sm" onClick={() => setYalnizBayat((v) => !v)}>
            Yalnız bayat
          </Button>
          <Button variant={yalnizHareketli ? 'default' : 'outline'} size="sm" onClick={() => setYalnizHareketli((v) => !v)}>
            Yalnız hareketli
          </Button>
          <Badge variant="outline">{gosterilen.length} pin</Badge>
        </div>
      )}

      {/* Pin tablosu */}
      {veri && veri.pins.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs tabular-nums">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <Th onClick={() => sirala('kod')}>Pin</Th>
                <Th onClick={() => sirala('plc')}>PLC</Th>
                <Th onClick={() => sirala('tezgahKod')}>Tezgah</Th>
                <Th onClick={() => sirala('curSayac')} sag>Sayaç</Th>
                <Th onClick={() => sirala('lastDelta')} sag>Δ</Th>
                <th className="px-2 py-1.5 text-center">Duruş</th>
                <th className="px-2 py-1.5 text-center">Bayat</th>
                <th className="px-2 py-1.5 text-right">Son okuma</th>
              </tr>
            </thead>
            <tbody>
              {gosterilen.map((p) => (
                <tr key={`${p.plc}-${p.kod}`} className={`border-t ${p.bayat ? 'bg-amber-50' : ''}`}>
                  <td className="px-2 py-1.5 font-medium">{p.kod}</td>
                  <td className="px-2 py-1.5 text-slate-500">{p.plc}</td>
                  <td className="px-2 py-1.5">
                    {p.tezgahKod ?? <span className="text-slate-300">— (tezgahsız)</span>}
                  </td>
                  <td className="px-2 py-1.5 text-right font-medium">{p.curSayac}</td>
                  <td className={`px-2 py-1.5 text-right ${p.lastDelta > 0 ? 'font-bold text-emerald-600' : 'text-slate-400'}`}>
                    {p.lastDelta > 0 ? `+${p.lastDelta}` : '0'}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {p.durusBit ? <span className="font-semibold text-red-600">DURUŞ</span> : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {p.bayat ? (
                      <span className="rounded bg-amber-200 px-1.5 py-0.5 font-semibold text-amber-800">bayat</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right text-slate-500">{saat(p.sonOkuma)}</td>
                </tr>
              ))}
              {gosterilen.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-2 py-6 text-center text-slate-400">
                    Filtreye uyan pin yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Th({ children, onClick, sag }: { children: React.ReactNode; onClick: () => void; sag?: boolean }) {
  return (
    <th
      onClick={onClick}
      className={`cursor-pointer select-none px-2 py-1.5 hover:text-slate-900 ${sag ? 'text-right' : 'text-left'}`}
    >
      {children}
    </th>
  )
}

function PlcKart({ p }: { p: PlcSaglik }) {
  const kopuk = !p.connected
  const uyari = !kopuk && (!!p.lastError || p.ardArdaHataSayisi > 0)
  const kenar = kopuk ? 'border-red-400 bg-red-50' : uyari ? 'border-amber-400 bg-amber-50' : 'border-slate-200'

  return (
    <div className={`rounded-xl border p-4 ${kenar}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Signal className={`h-4 w-4 ${kopuk ? 'text-red-500' : 'text-emerald-500'}`} />
          <span className="text-lg font-bold">{p.kod}</span>
          <span className="text-xs text-slate-400">{p.ip}</span>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            kopuk ? 'bg-red-200 text-red-800' : 'bg-emerald-100 text-emerald-700'
          }`}
        >
          {kopuk ? 'KOPUK' : 'bağlı'}
        </span>
      </div>

      {p.lastError && <p className="mt-2 break-words font-mono text-xs text-red-600">{p.lastError}</p>}

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <Alan e="Son okuma yaşı" d={ms(p.sonOkumaYasiMs)} vurgu={(p.sonOkumaYasiMs ?? 0) > 20_000} />
        <Alan e="Backoff" d={ms(p.backoffMs)} />
        <Alan e="Okuma hatası" d={String(p.okumaHatasiToplam)} vurgu={p.okumaHatasiToplam > 0} />
        <Alan e="Son hata" d={saat(p.sonHataZamani)} />
        <Alan e="Ard arda hata" d={String(p.ardArdaHataSayisi)} vurgu={p.ardArdaHataSayisi > 0} />
        <Alan e="Zorla kopma" d={String(p.zorlaKopmaSayisi)} vurgu={p.zorlaKopmaSayisi > 0} />
        <Alan e="Yeniden bağlanma" d={String(p.yenidenBaglanmaSayisi)} vurgu={p.yenidenBaglanmaSayisi > 0} />
        <Alan e="Baseline tazeleme" d={String(p.baselineTazelemeSayisi)} vurgu={p.baselineTazelemeSayisi > 0} />
      </div>
    </div>
  )
}

function Alan({ e, d, vurgu }: { e: string; d: string; vurgu?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-slate-400">{e}</span>
      <span className={`font-medium ${vurgu ? 'text-amber-700' : 'text-slate-700'}`}>{d}</span>
    </div>
  )
}
