'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Factory } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TERMINAL_ACCENT } from '../_shared'

// İzleme panosundaki tezgah detay modal'ının TERMINAL KOPYASI. Kaynak:
// src/components/ipro/izleme/IzlemeClient.tsx → DetayDialog (export edilmemiş,
// private). O dosya izleme panosunun; orijinale dokunmadan buraya kopyalandı.
// Fark: veri terminal ikizi route'undan (/api/terminal/uretim/tezgah/[id]),
// vurgu rengi TERMINAL_ACCENT (hardcode hex yok), IPRO'da tanımsız tezgah için
// ayrı mesaj. Alan yapısı/görsel izleme modal'ıyla birebir.

type Durum = 'calisiyor' | 'durusta' | 'bosta'

type IsSatiri = {
  id: string
  ifsOrderNo: string | null
  ifsOperationNo: number | null
  ifsPartNo: string | null
  ifsPartDescription: string | null
  qtyComplete: number
  qtyScrap: number
  baslatildiAt: string | null
  bitirildiAt: string | null
  operator: string | null
  ifsQtyDue: number | null
  ifsDueDate: string | null
  ifsNeedDate: string | null
  ifsMachRunFactor: number | null
  ifsLaborRunFactor: number | null
  ifsRunTimeCode: string | null
}
type DurusSatiri = {
  id: string
  sebep: string | null
  yorum: string | null
  baslangicAt: string
  bitisAt: string | null
  operator: string | null
}
type Durus = { baslangicAt: string; sebep: string | null }
type Detay = {
  id: string
  kod: string
  ad: string
  masGrupAdi: string | null
  aktif: boolean
  sinyalli: boolean
  durum: Durum
  aktifIs: IsSatiri | null
  durus: Durus | null
  bugunKapanan: IsSatiri[]
  bugunDuruslar: DurusSatiri[]
  sureDagilimi: { calismaDk: number; durusDk: number; bostaDk: number; elapsedDk: number }
  uretim: { gerceklesen: number; planlanan: number | null }
}

/** ms → "1s 12dk" / "12dk" / "45sn". Canlı süre için. */
function sureBicim(ms: number): string {
  const dk = Math.floor(ms / 60000)
  if (dk < 1) return `${Math.floor(ms / 1000)}sn`
  if (dk < 60) return `${dk}dk`
  return `${Math.floor(dk / 60)}s ${dk % 60}dk`
}
function dkBicim(dk: number): string {
  if (dk < 1) return '0dk'
  if (dk < 60) return `${dk}dk`
  return `${Math.floor(dk / 60)}s ${dk % 60}dk`
}
const trTarih2 = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('tr-TR') : '—')

/**
 * Terminal tezgah detay modal'ı. Açık/kapalı = `seciliTezgah` (ResourceId).
 * IPRO karşılığı varsa `iproId` ile terminal route'undan detay çeker; yoksa
 * "IPRO'da tanımlı değil" mesajı gösterir (kart yine tıklanabilir — Melih düzeltecek).
 */
export function TezgahDetayModal({
  seciliTezgah,
  iproId,
  onClose,
}: {
  seciliTezgah: string | null
  iproId: string | null
  onClose: () => void
}) {
  const [detay, setDetay] = useState<Detay | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [, tik] = useState(0)

  useEffect(() => {
    if (!seciliTezgah || !iproId) return
    let iptal = false
    setDetay(null)
    setHata(null)
    fetch(`/api/terminal/uretim/tezgah/${iproId}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (iptal) return
        if (d?.ok) setDetay(d)
        else setHata(d?.error ?? 'Detay alınamadı')
      })
      .catch(() => !iptal && setHata('Bağlantı hatası'))
    return () => {
      iptal = true
    }
  }, [seciliTezgah, iproId])

  // Canlı süre için saniyelik tik.
  useEffect(() => {
    const id = setInterval(() => tik((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const acik = !!seciliTezgah
  const tanimsiz = acik && !iproId
  const aktif = detay?.aktifIs
  const aktifSure = aktif?.baslatildiAt ? sureBicim(Date.now() - new Date(aktif.baslatildiAt).getTime()) : '—'
  const durusSure = detay?.durus ? sureBicim(Date.now() - new Date(detay.durus.baslangicAt).getTime()) : null
  const sd = detay?.sureDagilimi
  const toplamDurusDk =
    detay?.bugunDuruslar.reduce((a, d) => {
      const end = d.bitisAt ? new Date(d.bitisAt).getTime() : Date.now()
      return a + Math.max(0, (end - new Date(d.baslangicAt).getTime()) / 60000)
    }, 0) ?? 0
  const planCevrim =
    aktif?.ifsMachRunFactor != null && aktif.ifsMachRunFactor > 0
      ? `${aktif.ifsMachRunFactor} ${aktif.ifsRunTimeCode ?? ''}`.trim()
      : '—'
  const uret = detay?.uretim
  const yuzde = uret && uret.planlanan ? Math.min(100, Math.round((uret.gerceklesen / uret.planlanan) * 100)) : null

  const rozet =
    detay?.durum === 'durusta'
      ? { t: 'DURUŞTA', c: 'bg-red-100 text-red-700' }
      : detay?.durum === 'calisiyor'
        ? { t: 'ÇALIŞIYOR', c: 'bg-emerald-100 text-emerald-700' }
        : { t: 'BOŞTA', c: 'bg-slate-100 text-slate-500' }

  return (
    <Dialog open={acik} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Factory className="h-5 w-5" style={{ color: TERMINAL_ACCENT }} />
            <span>{detay ? detay.kod : (seciliTezgah ?? 'Tezgah')}</span>
            {detay && <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${rozet.c}`}>{rozet.t}</span>}
          </DialogTitle>
          <DialogDescription>
            {tanimsiz
              ? 'IPRO’da tanımlı değil'
              : detay
                ? `${detay.ad}${detay.masGrupAdi ? ` · ${detay.masGrupAdi}` : ''}`
                : 'Yükleniyor…'}
          </DialogDescription>
        </DialogHeader>

        {tanimsiz ? (
          <div className="rounded-xl bg-slate-50 px-4 py-6 text-center">
            <Factory className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">Bu tezgah IPRO’da tanımlı değil.</p>
            <p className="mt-1 text-xs text-slate-400">
              IFS kaynağı ({seciliTezgah}) var ama IPRO karşılığı yok — durum/iş bilgisi okunamıyor.
            </p>
          </div>
        ) : hata ? (
          <p className="py-6 text-center text-sm text-red-600">{hata}</p>
        ) : !detay ? (
          <p className="py-10 text-center text-sm text-slate-400">Yükleniyor…</p>
        ) : (
          <div className="space-y-5">
            {/* Aktif iş / durum */}
            {detay.durum === 'durusta' ? (
              <div className="rounded-xl bg-red-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-red-500">Duruşta</div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-xl font-bold text-red-700">{detay.durus?.sebep ?? 'Duruş'}</span>
                  <span className="font-mono text-lg text-red-600">{durusSure}</span>
                </div>
              </div>
            ) : aktif ? (
              <div>
                <div className="mb-3 flex items-baseline justify-between">
                  <span className="text-lg font-bold text-slate-800">👤 {aktif.operator ?? '—'}</span>
                  <span className="font-mono text-2xl font-semibold text-emerald-600">{aktifSure}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                  <Alan2 e="İş emri" d={`${aktif.ifsOrderNo ?? '—'} · Op ${aktif.ifsOperationNo ?? '—'}`} />
                  <Alan2 e="Malzeme" d={aktif.ifsPartNo ?? '—'} alt={aktif.ifsPartDescription ?? undefined} />
                  <Alan2 e="Planlanan adet" d={aktif.ifsQtyDue != null ? String(aktif.ifsQtyDue) : '—'} />
                  <Alan2 e="Teslim" d={trTarih2(aktif.ifsDueDate)} />
                  <Alan2 e="İhtiyaç" d={trTarih2(aktif.ifsNeedDate)} />
                  <Alan2 e="Planlı çevrim" d={planCevrim} />
                  <Alan2 e="PLC" d={detay.sinyalli ? '📶 Sinyalli' : 'Sinyalsiz'} />
                  <Alan2 e="Başlangıç" d={aktif.baslatildiAt ? new Date(aktif.baslatildiAt).toLocaleTimeString('tr-TR') : '—'} />
                </div>
              </div>
            ) : (
              <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">Boşta — açık iş yok.</p>
            )}

            {/* Üretim ilerleme */}
            <section>
              <SecBaslik>Üretim ilerleme</SecBaslik>
              {uret && uret.planlanan ? (
                <>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="font-semibold text-slate-700">
                      {uret.gerceklesen} / {uret.planlanan}
                    </span>
                    <span className="text-slate-500">%{yuzde}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${yuzde}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-slate-400">bugün kapanan iyi toplamı; poller gelince canlı sayaçla zenginleşir</p>
                </>
              ) : (
                <p className="text-sm text-slate-400">Planlanan adet yok — {uret?.gerceklesen ?? 0} adet üretildi (bugün).</p>
              )}
            </section>

            {/* Çevrim karşılaştırma */}
            <section>
              <SecBaslik>Çevrim (planlı vs ort.)</SecBaslik>
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <span className="text-slate-400">planlı</span> <span className="font-semibold text-slate-700">{planCevrim}</span>
                </div>
                <div className="text-slate-300">|</div>
                <div>
                  <span className="text-slate-400">ort.</span> <span className="font-semibold text-slate-400">—</span>
                </div>
                <span className="ml-auto text-xs text-slate-400">ort. çevrim poller ile</span>
              </div>
            </section>

            {/* Süre dağılımı */}
            {sd && sd.elapsedDk > 0 && (
              <section>
                <SecBaslik>Bugün süre dağılımı ({dkBicim(sd.elapsedDk)})</SecBaslik>
                <div className="flex h-4 overflow-hidden rounded-full bg-slate-100">
                  <StackSeg dk={sd.calismaDk} toplam={sd.elapsedDk} renk="bg-emerald-500" />
                  <StackSeg dk={sd.durusDk} toplam={sd.elapsedDk} renk="bg-red-500" />
                  <StackSeg dk={sd.bostaDk} toplam={sd.elapsedDk} renk="bg-slate-300" />
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-xs">
                  <Lej renk="bg-emerald-500" e="Çalışma" v={dkBicim(sd.calismaDk)} />
                  <Lej renk="bg-red-500" e="Duruş" v={dkBicim(sd.durusDk)} />
                  <Lej renk="bg-slate-300" e="Boşta" v={dkBicim(sd.bostaDk)} />
                </div>
              </section>
            )}

            {/* Göstergeler (mini) */}
            <section>
              <SecBaslik>Göstergeler</SecBaslik>
              <div className="grid grid-cols-4 gap-2">
                <MiniKart e="OEE" />
                <MiniKart e="Perf." />
                <MiniKart e="Kull." />
                <MiniKart e="Kalite" />
              </div>
              <p className="mt-1 text-xs text-slate-400">hesaplama sonra (OEE-HESAP)</p>
            </section>

            {/* PLC sayacı placeholder */}
            <section>
              <SecBaslik>PLC sayacı</SecBaslik>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Ph e="Baskı sayısı" />
                <Ph e="Gerçekleşen (poller)" />
                <Ph e="Ort. çevrim" />
              </div>
              <p className="mt-1 text-xs text-slate-400">poller gelince dolar; sinyalsizde bitir anında girilir</p>
            </section>

            {/* Bugünkü duruşlar */}
            <section>
              <SecBaslik>
                Bugünkü duruşlar ({detay.bugunDuruslar.length}) · toplam {dkBicim(Math.round(toplamDurusDk))}
              </SecBaslik>
              {detay.bugunDuruslar.length === 0 ? (
                <p className="text-sm text-slate-400">Bugün duruş yok.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-2 py-1.5 text-left">Sebep</th>
                        <th className="px-2 py-1.5 text-left">Başlangıç</th>
                        <th className="px-2 py-1.5 text-right">Süre</th>
                        <th className="px-2 py-1.5 text-left">Yorum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detay.bugunDuruslar.map((d) => {
                        const end = d.bitisAt ? new Date(d.bitisAt).getTime() : Date.now()
                        const dk = Math.round(Math.max(0, (end - new Date(d.baslangicAt).getTime()) / 60000))
                        return (
                          <tr key={d.id} className="border-t">
                            <td className="px-2 py-1.5">
                              {d.sebep ?? '—'}
                              {!d.bitisAt && <span className="ml-1 text-red-500">●</span>}
                            </td>
                            <td className="px-2 py-1.5 text-slate-500">
                              {new Date(d.baslangicAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-2 py-1.5 text-right font-medium">{dkBicim(dk)}</td>
                            <td className="max-w-[220px] px-2 py-1.5 text-slate-600" title={d.yorum ?? undefined}>
                              {d.yorum ? <span className="line-clamp-2">{d.yorum}</span> : <span className="text-slate-300">—</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Bugün kapanan işler */}
            <section>
              <SecBaslik>Bugün kapanan işler ({detay.bugunKapanan.length})</SecBaslik>
              {detay.bugunKapanan.length === 0 ? (
                <p className="text-sm text-slate-400">Bugün kapanan iş yok.</p>
              ) : (
                <div className="max-h-56 overflow-y-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-2 py-1.5 text-left">İş / Op</th>
                        <th className="px-2 py-1.5 text-left">Malzeme</th>
                        <th className="px-2 py-1.5 text-right">İyi</th>
                        <th className="px-2 py-1.5 text-right">Hurda</th>
                        <th className="px-2 py-1.5 text-right">Bitiş</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detay.bugunKapanan.map((s) => (
                        <tr key={s.id} className="border-t">
                          <td className="px-2 py-1.5">
                            {s.ifsOrderNo ?? '—'}
                            <span className="text-slate-400">/{s.ifsOperationNo ?? '—'}</span>
                          </td>
                          <td className="max-w-[140px] truncate px-2 py-1.5" title={s.ifsPartNo ?? undefined}>
                            {s.ifsPartDescription ?? s.ifsPartNo ?? '—'}
                          </td>
                          <td className="px-2 py-1.5 text-right font-medium text-emerald-600">{s.qtyComplete}</td>
                          <td className="px-2 py-1.5 text-right text-red-600">{s.qtyScrap}</td>
                          <td className="px-2 py-1.5 text-right text-slate-500">
                            {s.bitirildiAt ? new Date(s.bitirildiAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SecBaslik({ children }: { children: ReactNode }) {
  return <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">{children}</h3>
}
function Alan2({ e, d, alt }: { e: string; d: string; alt?: string }) {
  return (
    <div>
      <div className="text-xs text-slate-400">{e}</div>
      <div className="truncate font-medium text-slate-800" title={alt}>
        {d}
      </div>
      {alt && d !== alt && <div className="truncate text-xs text-slate-500">{alt}</div>}
    </div>
  )
}
function StackSeg({ dk, toplam, renk }: { dk: number; toplam: number; renk: string }) {
  const w = toplam > 0 ? (dk / toplam) * 100 : 0
  if (w <= 0) return null
  return <div className={`${renk} transition-all duration-700`} style={{ width: `${w}%` }} />
}
function Lej({ renk, e, v }: { renk: string; e: string; v: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${renk}`} />
      <span className="text-slate-500">{e}</span>
      <span className="font-medium text-slate-700">{v}</span>
    </span>
  )
}
function MiniKart({ e }: { e: string }) {
  return (
    <div className="rounded-lg border border-slate-200 py-2 text-center">
      <div className="text-lg font-bold text-slate-400">%—</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-400">{e}</div>
    </div>
  )
}
function Ph({ e }: { e: string }) {
  return (
    <div className="rounded-lg bg-slate-50 py-2">
      <div className="text-lg font-bold text-slate-300">—</div>
      <div className="text-[10px] text-slate-400">{e}</div>
    </div>
  )
}
