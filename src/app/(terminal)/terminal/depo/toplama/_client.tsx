'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Ban,
  Check,
  ClipboardList,
  Delete,
  HelpCircle,
  Loader2,
  MapPin,
  PackageCheck,
  PackageX,
  Scale,
  ScanLine,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useScanner } from '@/lib/depo/use-scanner'
import { parseEtiket } from '@/lib/depo/etiket-parse'
import { TERMINAL_ACCENT } from '../../_shared'
import type { FifoKaynak, IsEmriBaslik, ToplamaSatiri } from '@/lib/ifs/tuketim'

type ToplamaSatirDetay = ToplamaSatiri & { fifo: FifoKaynak[]; stokYok: boolean }

// Sapma sebepleri — zorunlu seçim. `key` hem ID hem log/özet metnidir.
const SEBEPLER = [
  { key: 'Kutu hasarlı', Icon: PackageX },
  { key: 'Rafa erişilemiyor', Icon: Ban },
  { key: 'Kutuda miktar yetersiz', Icon: Scale },
  { key: 'Diğer', Icon: HelpCircle },
] as const

const EPS = 1e-9

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return y && m && d ? `${d}.${m}.${y}` : iso
}
const normLoc = (x: string) => x.trim().toLocaleLowerCase('tr')

export function MalzemeToplamaClient() {
  const router = useRouter()
  const [step, setStep] = useState<'IS_EMRI' | 'LISTE' | 'TEYIT'>('IS_EMRI')
  const [baslik, setBaslik] = useState<IsEmriBaslik | null>(null)
  const [satirlar, setSatirlar] = useState<ToplamaSatirDetay[]>([])
  const [loading, setLoading] = useState(false)

  // TEYIT durumu
  const [secilen, setSecilen] = useState<ToplamaSatirDetay | null>(null)
  const [teyitEslesti, setTeyitEslesti] = useState(false)
  const [teyitMiktar, setTeyitMiktar] = useState('')
  const [tamamlaniyor, setTamamlaniyor] = useState(false)
  const [ozet, setOzet] = useState<
    { miktar: string; birim: string; loc: string; sapma?: { lokasyon: string; sebep: string } } | null
  >(null)

  // SAPMA (FIFO dışı) alt-aşaması
  const [sapmaAcik, setSapmaAcik] = useState(false)
  const [sapmaListe, setSapmaListe] = useState<FifoKaynak[]>([])
  const [sapmaLoading, setSapmaLoading] = useState(false)
  const [sapmaSecili, setSapmaSecili] = useState<FifoKaynak | null>(null)
  const [sapmaSebep, setSapmaSebep] = useState<string | null>(null)

  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [errorKey, setErrorKey] = useState(0)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualVal, setManualVal] = useState('')

  const showError = useCallback((msg: string) => {
    setErrorMsg(msg)
    setErrorKey((k) => k + 1)
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(200)
  }, [])
  useEffect(() => {
    if (!errorMsg) return
    const t = setTimeout(() => setErrorMsg(null), 2500)
    return () => clearTimeout(t)
  }, [errorKey, errorMsg])

  const isEmriOkut = useCallback(
    async (ham: string) => {
      const v = ham.trim()
      if (!v) return
      setLoading(true)
      try {
        const res = await fetch(`/api/depo/toplama/${encodeURIComponent(v)}`)
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok) {
          showError(data?.error ?? `İş emri bulunamadı: ${v}`)
          return
        }
        setBaslik(data.baslik as IsEmriBaslik)
        setSatirlar((data.satirlar ?? []) as ToplamaSatirDetay[])
        setStep('LISTE')
      } catch {
        showError('Bağlantı hatası — tekrar deneyin')
      } finally {
        setLoading(false)
      }
    },
    [showError],
  )

  // Malzeme okutma (TEYIT) — beklenen parça ile eşleşme.
  const malzemeOkut = useCallback(
    (ham: string) => {
      if (!secilen) return
      const p = parseEtiket(ham)
      if (p.tip === 'MALZEME' && p.stokKodu === secilen.partNo) {
        setTeyitEslesti(true)
      } else {
        showError(`Bu değil — ${secilen.partNo} olmalı`)
      }
    },
    [secilen, showError],
  )

  // Sapma alternatif listesini getir.
  const sapmaAc = useCallback(async () => {
    if (!secilen) return
    setSapmaAcik(true)
    setSapmaSecili(null)
    setSapmaSebep(null)
    setSapmaLoading(true)
    try {
      const res = await fetch(`/api/depo/parca/${encodeURIComponent(secilen.partNo)}/stok`)
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok) {
        setSapmaListe((data.satirlar ?? []) as FifoKaynak[])
      } else {
        showError(data?.error ?? 'Stok listesi alınamadı')
        setSapmaListe([])
      }
    } catch {
      showError('Bağlantı hatası — tekrar deneyin')
      setSapmaListe([])
    } finally {
      setSapmaLoading(false)
    }
  }, [secilen, showError])

  // Sapma: raf etiketi okut → getRafBilgisi ile çöz, listede eşleşen satırı seç.
  const rafOkut = useCallback(
    async (ham: string) => {
      const v = ham.trim()
      if (!v) return
      const bul = (loc: string) =>
        sapmaListe.find((k) => normLoc(k.locationNo) === normLoc(loc) || normLoc(k.lokasyonAdi) === normLoc(loc))
      let hit = bul(v)
      if (!hit) {
        try {
          const res = await fetch(`/api/depo/raf/${encodeURIComponent(v)}`)
          const data = await res.json().catch(() => null)
          if (res.ok && data?.ok && data.raf) hit = bul(data.raf.locationNo) ?? bul(data.raf.aciklama)
        } catch {
          /* çözülemedi → aşağıda hata */
        }
      }
      if (hit) setSapmaSecili(hit)
      else showError('Bu rafta bu malzeme yok')
    },
    [sapmaListe, showError],
  )

  const handleScan = useCallback(
    (v: string) => {
      if (step === 'IS_EMRI') return void isEmriOkut(v)
      if (step === 'TEYIT' && sapmaAcik && !sapmaSecili) return void rafOkut(v)
      if (step === 'TEYIT') return malzemeOkut(v)
    },
    [step, sapmaAcik, sapmaSecili, isEmriOkut, malzemeOkut, rafOkut],
  )

  const scanAktif =
    (step === 'IS_EMRI' ||
      (step === 'TEYIT' && !teyitEslesti) ||
      (step === 'TEYIT' && sapmaAcik && !sapmaSecili)) &&
    !manualOpen &&
    !loading &&
    !tamamlaniyor &&
    !ozet
  const { inputProps } = useScanner(scanAktif, handleScan)

  // Elle giriş — aktif adıma göre (IS_EMRI → iş emri, TEYIT → malzeme) aynı yoldan.
  const submitManual = () => {
    const v = manualVal
    setManualVal('')
    setManualOpen(false)
    handleScan(v)
  }

  const kalemAc = (s: ToplamaSatirDetay) => {
    setSecilen(s)
    setTeyitEslesti(false)
    setTeyitMiktar(String(s.kalan).replace('.', ','))
    setManualOpen(false)
    setManualVal('')
    setSapmaAcik(false)
    setSapmaSecili(null)
    setSapmaSebep(null)
    setStep('TEYIT')
  }
  const sapmaKapat = () => {
    setSapmaAcik(false)
    setSapmaSecili(null)
    setSapmaSebep(null)
    setErrorMsg(null)
  }
  const teyitKapat = () => {
    setStep('LISTE')
    setSecilen(null)
    setTeyitEslesti(false)
    setTeyitMiktar('')
    setErrorMsg(null)
    setManualOpen(false)
    setSapmaAcik(false)
    setSapmaSecili(null)
    setSapmaSebep(null)
  }
  const geri = () => {
    if (step === 'TEYIT' && sapmaAcik) return sapmaKapat()
    if (step === 'TEYIT') return teyitKapat()
    if (step === 'LISTE') {
      setStep('IS_EMRI')
      setBaslik(null)
      setSatirlar([])
      setErrorMsg(null)
      setManualOpen(false)
      return
    }
    router.push('/terminal/depo')
  }

  // Miktar tuş takımı (ondalık)
  const miktarNum = Number((teyitMiktar || '0').replace(',', '.'))
  const kalan = secilen?.kalan ?? 0
  const miktarGecerli = miktarNum > EPS && miktarNum <= kalan + EPS
  const tamMiktar = Math.abs(miktarNum - kalan) < EPS && miktarNum > 0
  const kismi = miktarGecerli && !tamMiktar
  const pressKey = (k: string) => {
    if (k === '⌫') return setTeyitMiktar((m) => m.slice(0, -1))
    if (k === ',') return setTeyitMiktar((m) => (m.includes(',') ? m : (m || '0') + ','))
    setTeyitMiktar((m) => {
      const next = m === '0' ? k : m + k
      return next.length > 9 ? m : next
    })
  }

  // Ortak gönderim — TAM/KISMI (sapma yok) veya SAPMA (kimlik+sebep).
  const gonder = async (sapmaOpt?: { stokKimlik: FifoKaynak['kimlik']; sebep: string }) => {
    if (tamamlaniyor || !secilen || !baslik || !teyitEslesti || !miktarGecerli) return
    setTamamlaniyor(true)
    try {
      const res = await fetch(`/api/depo/toplama/${encodeURIComponent(baslik.orderNo)}/topla`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          releaseNo: baslik.releaseNo,
          sequenceNo: baslik.sequenceNo,
          lineItemNo: secilen.lineItemNo,
          miktar: miktarNum,
          ...(sapmaOpt ? { sapma: sapmaOpt } : {}),
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        showError(data?.error ?? 'Çıkış başarısız')
        return
      }
      const loc = sapmaOpt
        ? sapmaSecili?.lokasyonAdi ?? sapmaSecili?.locationNo ?? '—'
        : data.kirilim?.[0]?.locationNo ?? secilen.fifo[0]?.locationNo ?? '—'
      setOzet({
        miktar: teyitMiktar,
        birim: secilen.birim,
        loc,
        sapma: sapmaOpt
          ? { lokasyon: sapmaSecili?.lokasyonAdi ?? sapmaSecili?.locationNo ?? '—', sebep: sapmaOpt.sebep }
          : undefined,
      })
    } catch {
      showError('Bağlantı hatası — tekrar deneyin')
    } finally {
      setTamamlaniyor(false)
    }
  }

  const sapmaGonder = () => {
    if (!sapmaSecili || !sapmaSebep) return
    void gonder({ stokKimlik: sapmaSecili.kimlik, sebep: sapmaSebep })
  }

  // Özet ekranı → 1.6sn sonra listeyi tazele.
  useEffect(() => {
    if (!ozet || !baslik) return
    const t = setTimeout(() => {
      setOzet(null)
      setSecilen(null)
      setTeyitEslesti(false)
      setTeyitMiktar('')
      setSapmaAcik(false)
      setSapmaSecili(null)
      setSapmaSebep(null)
      isEmriOkut(baslik.orderNo)
    }, 1600)
    return () => clearTimeout(t)
  }, [ozet, baslik, isEmriOkut])

  const tamamlanan = satirlar.filter((s) => s.kalan === 0).length
  const ilkKaynak = secilen?.fifo[0]
  const kalemIndex = secilen ? satirlar.findIndex((s) => s.lineItemNo === secilen.lineItemNo) : -1

  return (
    <div className="relative flex flex-1 flex-col gap-3 py-2">
      {scanAktif && <input {...inputProps} />}

      {errorMsg && (
        <div className="absolute inset-x-0 top-0 z-20 mx-2 flex items-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-base font-semibold text-white shadow-lg">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Üst bar */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={geri}
          aria-label="Geri"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors active:bg-muted/70"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        {step === 'IS_EMRI' && <h1 className="text-base font-semibold">Malzeme Toplama</h1>}
        {step === 'LISTE' && (
          <div className="flex min-w-0 flex-col leading-tight">
            <h1 className="truncate text-base font-semibold">
              İE {baslik?.orderNo} · {baslik?.urunAdi || baslik?.urunKodu}
            </h1>
            <span className="text-xs text-muted-foreground">
              {satirlar.length} kalem · {tamamlanan} toplandı
            </span>
          </div>
        )}
        {step === 'TEYIT' && secilen && (
          <div className="flex min-w-0 flex-col leading-tight">
            <h1 className="truncate text-base font-semibold">
              {secilen.partNo} · {secilen.kalan} {secilen.birim}
            </h1>
            <span className="truncate text-xs text-muted-foreground">
              İE {baslik?.orderNo} · kalem {kalemIndex + 1}/{satirlar.length}
            </span>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          IFS sorgulanıyor…
        </div>
      )}

      {/* AŞAMA 1 — iş emri okut */}
      {step === 'IS_EMRI' && !loading && (
        <div className="flex flex-col items-center gap-3">
          <div
            className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center"
            style={{ borderColor: TERMINAL_ACCENT, color: TERMINAL_ACCENT }}
          >
            <ClipboardList className="h-12 w-12" />
            <div className="text-lg font-semibold">İş emrini okut</div>
            <div className="text-sm text-muted-foreground">Kağıttaki barkodu okut veya no gir</div>
          </div>
          {manualOpen ? (
            <div className="flex w-full gap-2">
              <input
                autoFocus
                value={manualVal}
                onChange={(e) => setManualVal(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitManual()}
                placeholder="İş emri no (ör. 147)"
                className="h-11 flex-1 rounded-xl border bg-background px-3 text-base outline-none focus:ring-1 focus:ring-ring"
              />
              <button type="button" onClick={submitManual} className="h-11 rounded-xl px-4 text-sm font-semibold text-white" style={{ background: TERMINAL_ACCENT }}>
                Getir
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setManualOpen(true)} className="text-sm text-muted-foreground underline underline-offset-2">
              veya elle gir
            </button>
          )}
        </div>
      )}

      {/* AŞAMA 2 — liste */}
      {step === 'LISTE' && !loading && (
        <div className="flex flex-col gap-3">
          {satirlar.length === 0 && (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Bu iş emrinde malzeme kalemi yok
            </div>
          )}
          {satirlar.map((s) => (
            <KalemKart key={s.lineItemNo} s={s} onSelect={() => kalemAc(s)} />
          ))}
        </div>
      )}

      {/* AŞAMA 3 — TEYIT (normal) */}
      {step === 'TEYIT' && secilen && !ozet && !sapmaAcik && (
        <div className="flex flex-1 flex-col gap-3">
          {/* Büyük GİT bloğu */}
          {ilkKaynak && (
            <div className="rounded-2xl border p-4" style={{ borderColor: TERMINAL_ACCENT }}>
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">GİT →</span>
              <div className="mt-1 flex items-baseline gap-2">
                <MapPin className="h-6 w-6 self-center" style={{ color: TERMINAL_ACCENT }} />
                <span className="text-3xl font-bold leading-none" style={{ color: TERMINAL_ACCENT }}>
                  {ilkKaynak.lokasyonAdi}
                </span>
                <span className="text-sm text-muted-foreground">({ilkKaynak.locationNo})</span>
              </div>
              <div className="mt-1 text-sm">
                {ilkKaynak.alinacak} {secilen.birim}
                {ilkKaynak.lotBatchNo ? ` · lot ${ilkKaynak.lotBatchNo}` : ''}
              </div>
            </div>
          )}

          {/* Malzeme okutma / teyit */}
          {!teyitEslesti ? (
            <div className="flex flex-col items-center gap-3">
              <div
                className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center"
                style={{ borderColor: TERMINAL_ACCENT, color: TERMINAL_ACCENT }}
              >
                <ScanLine className="h-10 w-10" />
                <div className="text-base font-semibold">Kutudaki malzeme etiketini okut</div>
                <div className="text-xs text-muted-foreground">{secilen.partNo}{secilen.partAdi ? ` · ${secilen.partAdi}` : ''}</div>
              </div>
              {manualOpen ? (
                <div className="flex w-full gap-2">
                  <input
                    autoFocus
                    value={manualVal}
                    onChange={(e) => setManualVal(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitManual()}
                    placeholder="Stok kodu (| lot)"
                    className="h-11 flex-1 rounded-xl border bg-background px-3 text-base outline-none focus:ring-1 focus:ring-ring"
                  />
                  <button type="button" onClick={submitManual} className="h-11 rounded-xl px-4 text-sm font-semibold text-white" style={{ background: TERMINAL_ACCENT }}>
                    Onayla
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setManualOpen(true)} className="text-sm text-muted-foreground underline underline-offset-2">
                  veya elle gir
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="flex w-fit items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                <Check className="h-4 w-4" />
                Doğru malzeme · {secilen.partNo}
              </div>

              {/* Miktar bloğu */}
              <div
                className={cn(
                  'rounded-2xl border bg-card py-4 text-center text-5xl font-semibold tabular-nums',
                  kismi && 'border-amber-400',
                )}
              >
                {teyitMiktar || '0'}
                <span className="ml-2 text-2xl text-muted-foreground">{secilen.birim}</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫'].map((k) => (
                  <button key={k} type="button" onClick={() => pressKey(k)} className="flex min-h-12 items-center justify-center rounded-xl border bg-card text-2xl font-semibold transition-colors active:bg-muted">
                    {k === '⌫' ? <Delete className="h-6 w-6" /> : k}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => void gonder()}
                disabled={!miktarGecerli || tamamlaniyor}
                className="mt-1 flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-lg font-semibold text-white transition-all hover:bg-emerald-700 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
              >
                {tamamlaniyor ? <Loader2 className="h-5 w-5 animate-spin" /> : <PackageCheck className="h-6 w-6" />}
                {tamamlaniyor ? 'IFS’e işleniyor…' : 'Topla ve Çık (IFS)'}
              </button>
              {kismi && (
                <p className="text-center text-xs text-muted-foreground">
                  Kısmi toplama: {teyitMiktar} / {kalan} {secilen.birim}
                </p>
              )}

              <div className="flex items-center justify-center pt-1">
                <button
                  type="button"
                  onClick={sapmaAc}
                  className="text-sm underline underline-offset-2"
                  style={{ color: TERMINAL_ACCENT }}
                >
                  Farklı yerden alacağım
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* AŞAMA 3b — SAPMA (FIFO dışı) */}
      {step === 'TEYIT' && secilen && !ozet && sapmaAcik && (
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-base font-semibold">Farklı yerden al</div>
              <div className="text-xs text-muted-foreground">
                {secilen.partNo} · {teyitMiktar || '0'} {secilen.birim}
              </div>
            </div>
          </div>

          {/* a) Alternatif raf listesi */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <ScanLine className="h-4 w-4" /> Rafı seç veya raf etiketini okut
            </div>
            {sapmaLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /> Stok listesi alınıyor…
              </div>
            ) : sapmaListe.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                Bu parça için taşınabilir stok bulunamadı
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {sapmaListe.map((k, i) => {
                  const secili =
                    !!sapmaSecili &&
                    sapmaSecili.locationNo === k.locationNo &&
                    (sapmaSecili.lotBatchNo ?? '') === (k.lotBatchNo ?? '')
                  return (
                    <button
                      key={`${k.locationNo}-${k.lotBatchNo ?? '_'}-${i}`}
                      type="button"
                      onClick={() => setSapmaSecili(k)}
                      className={cn(
                        'flex flex-col gap-1 rounded-2xl border p-3 text-left transition-all active:opacity-70',
                        secili ? 'bg-[#1B4F72]/5 ring-2 ring-[#1B4F72]' : 'bg-card',
                      )}
                      style={{ borderColor: TERMINAL_ACCENT }}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="flex items-baseline gap-1">
                          <MapPin className="h-5 w-5 self-center" style={{ color: TERMINAL_ACCENT }} />
                          <span className="text-xl font-bold" style={{ color: TERMINAL_ACCENT }}>{k.lokasyonAdi}</span>
                          <span className="text-xs text-muted-foreground">({k.locationNo})</span>
                        </span>
                        {i === 0 && (
                          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                            FIFO önerisi
                          </span>
                        )}
                        {secili && <Check className="h-5 w-5 shrink-0" style={{ color: TERMINAL_ACCENT }} />}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">{k.mevcutMiktar} {secilen.birim}</span>
                        {k.lotBatchNo && <span> · lot {k.lotBatchNo}</span>}
                        {k.receiptDate && <span> · giriş {fmtDate(k.receiptDate)}</span>}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* b) Zorunlu sebep */}
          <div className="flex flex-col gap-1">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sebep (zorunlu)</div>
            <div className="grid grid-cols-2 gap-2">
              {SEBEPLER.map(({ key, Icon }) => {
                const secili = sapmaSebep === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSapmaSebep(key)}
                    className={cn(
                      'flex min-h-14 items-center gap-2 rounded-xl border bg-card px-3 py-2 text-left text-sm font-medium transition-colors active:bg-muted',
                      secili ? 'border-transparent text-white' : '',
                    )}
                    style={secili ? { background: TERMINAL_ACCENT } : undefined}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {key}
                  </button>
                )
              })}
            </div>
          </div>

          {/* c) Onay */}
          <button
            type="button"
            onClick={sapmaGonder}
            disabled={!sapmaSecili || !sapmaSebep || !miktarGecerli || tamamlaniyor}
            className="mt-1 flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-lg font-semibold text-white transition-all hover:bg-emerald-700 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
          >
            {tamamlaniyor ? <Loader2 className="h-5 w-5 animate-spin" /> : <PackageCheck className="h-6 w-6" />}
            {tamamlaniyor ? 'IFS’e işleniyor…' : 'Buradan Topla ve Çık'}
          </button>
          {kismi && (
            <p className="text-center text-xs text-muted-foreground">
              Kısmi toplama: {teyitMiktar} / {kalan} {secilen.birim}
            </p>
          )}
          <button type="button" onClick={sapmaKapat} className="text-center text-sm text-muted-foreground underline underline-offset-2">
            Vazgeç — FIFO önerisine dön
          </button>
        </div>
      )}

      {/* Özet ekranı */}
      {ozet && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <Check className="h-11 w-11" />
          </div>
          <div className="text-2xl font-semibold">
            {ozet.miktar} {ozet.birim} çıkıldı
          </div>
          <div className="text-sm text-muted-foreground">Lokasyon: {ozet.loc}</div>
          {ozet.sapma && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-800">
              FIFO dışı: {ozet.sapma.lokasyon} · sebep: {ozet.sapma.sebep}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function KalemKart({ s, onSelect }: { s: ToplamaSatirDetay; onSelect: () => void }) {
  if (s.kalan === 0) {
    return (
      <div className="flex min-h-16 items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-800">
        <Check className="h-6 w-6 shrink-0 text-emerald-600" />
        <div className="min-w-0">
          <div className="font-semibold">{s.partNo}</div>
          <div className="text-sm">{s.gerekli} {s.birim} · toplandı</div>
        </div>
      </div>
    )
  }
  if (s.stokYok) {
    return (
      <div className="flex flex-col gap-1 rounded-2xl border border-red-300 bg-red-50 p-4 text-red-800">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
          <span className="min-w-0 truncate font-semibold">
            {s.partNo}
            {s.partAdi ? ` · ${s.partAdi}` : ''}
          </span>
        </div>
        <div className="text-sm">{s.kalan} {s.birim} gerekli</div>
        <div className="mt-1 text-sm font-semibold">STOKTA YOK — planlamaya bildir</div>
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full flex-col gap-2 rounded-2xl border bg-card p-4 text-left transition-opacity active:opacity-70"
      style={{ borderColor: TERMINAL_ACCENT }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 font-semibold">{s.partNo}</span>
        <span className="shrink-0 text-sm font-semibold" style={{ color: TERMINAL_ACCENT }}>
          {s.kalan} {s.birim}
        </span>
      </div>
      {s.partAdi && <div className="truncate text-xs text-muted-foreground">{s.partAdi}</div>}
      <div className="mt-1 flex flex-col gap-2">
        {s.fifo.map((k, i) => (
          <div key={`${k.locationNo}-${k.lotBatchNo ?? '_'}-${i}`} className="rounded-xl bg-muted/50 p-3">
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">GİT →</span>
              <span className="flex items-baseline gap-1">
                <MapPin className="h-4 w-4 self-center" style={{ color: TERMINAL_ACCENT }} />
                <span className="text-lg font-semibold" style={{ color: TERMINAL_ACCENT }}>{k.lokasyonAdi}</span>
                <span className="text-xs text-muted-foreground">({k.locationNo})</span>
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-sm">
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">{k.alinacak} {s.birim}</span>
              {k.lotBatchNo && <span className="text-muted-foreground"> · lot {k.lotBatchNo}</span>}
              <span className="text-muted-foreground"> · giriş {fmtDate(k.receiptDate)}</span>
            </div>
          </div>
        ))}
      </div>
    </button>
  )
}
