'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Delete,
  Loader2,
  MapPin,
  Package,
  PackageCheck,
  Printer,
  ScanLine,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { barkodIdAday, parseEtiket } from '@/lib/depo/etiket-parse'
import { useScanner } from '@/lib/depo/use-scanner'
import type { DepoRafBilgisi, DepoStokKaydi } from '@/lib/ifs/depo-stok'
import type { FifoKaynak } from '@/lib/ifs/tuketim'
import { TERMINAL_ACCENT } from '../../_shared'

// KAYNAK_SECIM: malzeme birden çok rafta bulunduğunda kaynak raf seçimi (hâlâ 1. adım).
type Step = 'KAYNAK_RAF' | 'KAYNAK_SECIM' | 'MALZEME' | 'MIKTAR' | 'HEDEF_RAF' | 'TAMAM'
const STEP_INDEX: Record<Step, number> = {
  KAYNAK_RAF: 1,
  KAYNAK_SECIM: 1,
  MALZEME: 2,
  MIKTAR: 3,
  HEDEF_RAF: 4,
  TAMAM: 4,
}

// FifoKaynak'ta birim alanı yok → terminal genelinde 'ad' fallback (bkz. DepoStokKaydi.birim).
const HIZLI_BIRIM = 'ad'

// Hızlı Taşıma başarı özeti — panel sıfırlansa da yeşil çip + etiket bu snapshot'tan çalışır.
interface HizliSonuc {
  miktar: number
  birim: string
  partNo: string
  lot?: string
  kaynakAdi: string
  hedefAdi: string
}

export function StokTasimaClient() {
  const router = useRouter()

  const [step, setStep] = useState<Step>('KAYNAK_RAF')
  const [kaynakRaf, setKaynakRaf] = useState<DepoRafBilgisi | null>(null)
  const [rafStok, setRafStok] = useState<DepoStokKaydi[]>([])
  const [secilenStok, setSecilenStok] = useState<DepoStokKaydi | null>(null)
  const [miktar, setMiktar] = useState('')
  const [hedefRaf, setHedefRaf] = useState<DepoRafBilgisi | null>(null)
  const [loading, setLoading] = useState(false)
  const [tasiniyor, setTasiniyor] = useState(false)
  const [sonucYol, setSonucYol] = useState<'CREATE' | 'UPDATE' | null>(null)
  const [etiketYukleniyor, setEtiketYukleniyor] = useState(false)

  // Malzeme-öncelikli giriş: çoklu raf seçim listesi + otomatik seçim teyidi.
  const [malzemeKaynaklar, setMalzemeKaynaklar] = useState<FifoKaynak[]>([])
  const [malzemeTeyit, setMalzemeTeyit] = useState<string | null>(null)

  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [errorKey, setErrorKey] = useState(0)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualVal, setManualVal] = useState('')

  // ── BÖLÜM 3: Hızlı Taşıma paneli (üstte, tek ekran) + sihirbaz accordion ─────
  // Sihirbaz artık ikincil: kapalıyken scanner Hızlı panelin; açıkken sihirbazın.
  const [sihirbazAcik, setSihirbazAcik] = useState(false)
  const [hAdaylar, setHAdaylar] = useState<FifoKaynak[]>([]) // çoklu lokasyon seçim adayları
  const [hKaynak, setHKaynak] = useState<FifoKaynak | null>(null) // seçili kaynak stok satırı
  const [hPartCip, setHPartCip] = useState<string | null>(null) // '{partNo}{ · lot}'
  const [hMiktar, setHMiktar] = useState('')
  const [hHedef, setHHedef] = useState<DepoRafBilgisi | null>(null)
  const [hLoading, setHLoading] = useState(false)
  const [hTasiniyor, setHTasiniyor] = useState(false)
  const [hSonuc, setHSonuc] = useState<HizliSonuc | null>(null)
  const [hOkutManual, setHOkutManual] = useState(false)
  const [hOkutVal, setHOkutVal] = useState('')
  const [hHedefManual, setHHedefManual] = useState(false)
  const [hHedefVal, setHHedefVal] = useState('')
  const [hEtiketYuk, setHEtiketYuk] = useState(false)

  const isScanStep =
    step === 'KAYNAK_RAF' || step === 'KAYNAK_SECIM' || step === 'MALZEME' || step === 'HEDEF_RAF'

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

  // ── Malzeme kaynağını (FifoKaynak) seç → DepoStokKaydi + kaynakRaf kur, MIKTAR'a geç ─
  const secKaynakStok = useCallback((k: FifoKaynak) => {
    const kaydi: DepoStokKaydi = {
      stokKodu: k.kimlik.partNo,
      stokAdi: '',
      lot: k.lotBatchNo,
      miktar: k.mevcutMiktar,
      birim: 'ad',
      kimlik: k.kimlik,
    }
    setKaynakRaf({ locationNo: k.locationNo, aciklama: k.lokasyonAdi, grup: '' })
    setSecilenStok(kaydi)
    setMiktar('')
    setMalzemeTeyit(
      `${k.kimlik.partNo}${k.lotBatchNo ? ` · ${k.lotBatchNo}` : ''} · ${k.lokasyonAdi || k.locationNo}`,
    )
    setStep('MIKTAR')
  }, [])

  // ── İlk okutma: RAF veya MALZEME çözümleme (API) ─────────────────
  const cozKaynak = useCallback(
    async (kod: string) => {
      setLoading(true)
      try {
        // EL-9b (BÖLÜM 2): salt-sayısal okuma → ÖNCE barkod_id dene. Çözülürse `stoklar`
        // kaynak adayı (tek satır → otomatik kaynak+MIKTAR; çok satır → KAYNAK_SECIM).
        const bId = barkodIdAday(kod)
        if (bId !== null) {
          const bRes = await fetch(`/api/depo/barkod/${bId}`)
          if (bRes.ok) {
            const bData = await bRes.json().catch(() => null)
            const stoklar = bData?.ok ? ((bData.stoklar ?? []) as FifoKaynak[]) : []
            if (stoklar.length > 0) {
              const rafSayisi = new Set(stoklar.map((s) => s.locationNo)).size
              if (rafSayisi === 1) {
                secKaynakStok(stoklar[0])
                return
              }
              setMalzemeKaynaklar(stoklar)
              setStep('KAYNAK_SECIM')
              return
            }
          }
          // 404 / boş → aşağıdaki mevcut raf→malzeme davranışına düş.
        }

        // TODO: çakışan kod politikası — şimdilik raf öncelikli
        const rafRes = await fetch(`/api/depo/raf/${encodeURIComponent(kod)}/stok`)
        const rafData = await rafRes.json().catch(() => null)
        if (rafRes.ok && rafData?.ok) {
          // MEVCUT davranış: kaynakRaf + rafStok set, MALZEME adımına geç.
          setKaynakRaf(rafData.raf as DepoRafBilgisi)
          setRafStok((rafData.stok ?? []) as DepoStokKaydi[])
          setStep('MALZEME')
          return
        }

        // Raf değil → malzeme dene.
        const p = parseEtiket(kod)
        const stokKodu = p.tip === 'MALZEME' && p.stokKodu ? p.stokKodu : kod
        const res = await fetch(`/api/depo/parca/${encodeURIComponent(stokKodu)}/stok`)
        const data = await res.json().catch(() => null)
        const satirlar = res.ok && data?.ok ? ((data.satirlar ?? []) as FifoKaynak[]) : []
        if (satirlar.length === 0) {
          showError(`Ne raf ne malzeme bulundu: ${kod}`)
          return
        }

        const rafSayisi = new Set(satirlar.map((s) => s.locationNo)).size
        if (rafSayisi === 1) {
          // Tek raf → otomatik seç (FIFO ilk satır), MALZEME adımını atla.
          secKaynakStok(satirlar[0])
          return
        }
        // Çoklu raf → seçim listesi (gelen sıra = FIFO).
        setMalzemeKaynaklar(satirlar)
        setStep('KAYNAK_SECIM')
      } catch {
        showError('Bağlantı hatası — tekrar deneyin')
      } finally {
        setLoading(false)
      }
    },
    [showError, secKaynakStok],
  )

  const cozRafHedef = useCallback(
    async (kod: string) => {
      setLoading(true)
      try {
        const res = await fetch(`/api/depo/raf/${encodeURIComponent(kod)}`)
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok) {
          showError(`Raf bulunamadı: ${kod}`)
          return
        }
        const raf = data.raf as DepoRafBilgisi
        if (raf.locationNo === kaynakRaf?.locationNo) {
          showError('Hedef raf kaynakla aynı olamaz')
          return
        }
        setHedefRaf(raf)
      } catch {
        showError('Bağlantı hatası — tekrar deneyin')
      } finally {
        setLoading(false)
      }
    },
    [showError, kaynakRaf],
  )

  const secStok = (kaydi: DepoStokKaydi) => {
    setSecilenStok(kaydi)
    setMiktar('')
    setStep('MIKTAR')
  }

  // ── Okutma dağıtımı ──────────────────────────────────────────────
  const handleValue = useCallback(
    (raw: string) => {
      const val = raw.trim()
      if (!val) return
      if (step === 'KAYNAK_RAF') return void cozKaynak(val)
      if (step === 'KAYNAK_SECIM') {
        // Okunan kodu listedeki locationNo / lokasyonAdi ile eşleştir.
        const low = val.toLowerCase()
        const k = malzemeKaynaklar.find(
          (m) => m.locationNo.toLowerCase() === low || (m.lokasyonAdi ?? '').toLowerCase() === low,
        )
        if (!k) return showError('Bu rafta bu malzeme yok')
        return secKaynakStok(k)
      }
      if (step === 'HEDEF_RAF') return void cozRafHedef(val)
      if (step === 'MALZEME') {
        const p = parseEtiket(val)
        if (p.tip !== 'MALZEME' || !p.stokKodu) return showError('Malzeme okutun')
        const eslesme = rafStok.find(
          (s) => s.stokKodu === p.stokKodu && (p.lot ? s.lot === p.lot : true),
        )
        if (!eslesme) return showError('Bu malzeme bu rafta görünmüyor')
        secStok(eslesme)
      }
    },
    [step, cozKaynak, cozRafHedef, rafStok, showError, malzemeKaynaklar, secKaynakStok],
  )

  // ═══ BÖLÜM 3: Hızlı Taşıma akışı ═══════════════════════════════════
  const hizliOkutSifirla = () => {
    setHAdaylar([])
    setHKaynak(null)
    setHPartCip(null)
    setHMiktar('')
    setHHedef(null)
    setHSonuc(null)
    setHOkutManual(false)
    setHOkutVal('')
    setHHedefManual(false)
    setHHedefVal('')
  }

  // Kaynak stok satırını seç → çip + adet/hedef alanlarını aç.
  const secHizliKaynak = (k: FifoKaynak) => {
    setHKaynak(k)
    setHAdaylar((a) => (a.length ? a : [k]))
    setHMiktar('')
    setHHedef(null)
    setHHedefManual(false)
    setHHedefVal('')
  }

  // a) Okut çözümle: sayısalsa barkod→(404)parça; değilse parseEtiket→parça.
  const cozHizliKaynak = async (kod: string) => {
    setHLoading(true)
    setHSonuc(null)
    try {
      let satirlar: FifoKaynak[] = []
      const bId = barkodIdAday(kod)
      if (bId !== null) {
        const bRes = await fetch(`/api/depo/barkod/${bId}`)
        if (bRes.ok) {
          const bData = await bRes.json().catch(() => null)
          if (bData?.ok) satirlar = (bData.stoklar ?? []) as FifoKaynak[]
        }
        if (satirlar.length === 0) {
          // 404/boş → sayısal değeri malzeme (partNo) olarak dene.
          const pRes = await fetch(`/api/depo/parca/${encodeURIComponent(kod)}/stok`)
          if (pRes.ok) {
            const pData = await pRes.json().catch(() => null)
            if (pData?.ok) satirlar = (pData.satirlar ?? []) as FifoKaynak[]
          }
        }
      } else {
        const p = parseEtiket(kod)
        const stokKodu = p.tip === 'MALZEME' && p.stokKodu ? p.stokKodu : kod
        const pRes = await fetch(`/api/depo/parca/${encodeURIComponent(stokKodu)}/stok`)
        if (pRes.ok) {
          const pData = await pRes.json().catch(() => null)
          if (pData?.ok) satirlar = (pData.satirlar ?? []) as FifoKaynak[]
        }
      }

      if (satirlar.length === 0) {
        showError(`Çözülemedi: ${kod}`)
        return
      }

      const partNo = satirlar[0].kimlik.partNo
      const lotlar = new Set(satirlar.map((s) => s.lotBatchNo ?? ''))
      const tekLot = lotlar.size === 1 ? satirlar[0].lotBatchNo : undefined
      setHPartCip(`${partNo}${tekLot ? ` · ${tekLot}` : ''}`)

      const rafSayisi = new Set(satirlar.map((s) => s.locationNo)).size
      if (rafSayisi === 1) {
        setHAdaylar(satirlar)
        secHizliKaynak(satirlar[0])
      } else {
        // Çok lokasyon → mini kaynak seçim (FIFO sıralı).
        setHAdaylar(satirlar)
        setHKaynak(null)
      }
    } catch {
      showError('Bağlantı hatası — tekrar deneyin')
    } finally {
      setHLoading(false)
    }
  }

  // c) Hedef raf çözümle.
  const cozHizliHedef = async (kod: string) => {
    setHLoading(true)
    try {
      const res = await fetch(`/api/depo/raf/${encodeURIComponent(kod)}`)
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        showError(`Raf bulunamadı: ${kod}`)
        return
      }
      const raf = data.raf as DepoRafBilgisi
      if (raf.locationNo === hKaynak?.locationNo) {
        showError('Hedef kaynakla aynı olamaz')
        return
      }
      setHHedef(raf)
    } catch {
      showError('Bağlantı hatası — tekrar deneyin')
    } finally {
      setHLoading(false)
    }
  }

  const hMax = hKaynak?.mevcutMiktar ?? 0
  const hMiktarNum = Number(hMiktar || '0')
  const hMiktarExceed = hMiktarNum > hMax
  const hMiktarValid = hMiktarNum > 0 && hMiktarNum <= hMax

  const hPressKey = (k: string) => {
    if (k === '⌫') return setHMiktar((m) => m.slice(0, -1))
    if (k === '.') return setHMiktar((m) => (m.includes('.') ? m : m === '' ? '0.' : `${m}.`))
    setHMiktar((m) => {
      const next = m === '0' ? k : m + k
      return next.length > 8 ? m : next
    })
  }

  // Okutma dağıtımı (Hızlı panel): kaynak yoksa okut; adaylar varsa raf seç; kaynak varsa hedef.
  const hizliHandle = (raw: string) => {
    const val = raw.trim()
    if (!val || hLoading || hTasiniyor) return
    if (!hKaynak && hAdaylar.length === 0) return void cozHizliKaynak(val)
    if (!hKaynak) {
      const low = val.toLowerCase()
      const k = hAdaylar.find(
        (m) => m.locationNo.toLowerCase() === low || (m.lokasyonAdi ?? '').toLowerCase() === low,
      )
      if (!k) return showError('Bu rafta bu malzeme yok')
      return secHizliKaynak(k)
    }
    return void cozHizliHedef(val)
  }

  // d) Taşı → başarıda snapshot (yeşil çip + etiket) + panel sıfırla.
  const hizliTasi = async () => {
    if (hTasiniyor || !hKaynak || !hHedef || !hMiktarValid) return
    setHTasiniyor(true)
    try {
      const res = await fetch('/api/depo/stok-tasima', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kimlik: hKaynak.kimlik,
          hedefLocationNo: hHedef.locationNo,
          miktar: hMiktarNum,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        showError(data?.error ?? 'Taşıma başarısız — tekrar deneyin')
        return
      }
      setHSonuc({
        miktar: hMiktarNum,
        birim: HIZLI_BIRIM,
        partNo: hKaynak.kimlik.partNo,
        lot: hKaynak.lotBatchNo,
        kaynakAdi: hKaynak.lokasyonAdi || hKaynak.locationNo,
        hedefAdi: hHedef.aciklama || hHedef.locationNo,
      })
      // Panel sıfırla (hSonuc hariç) → arka arkaya taşıma.
      setHAdaylar([])
      setHKaynak(null)
      setHPartCip(null)
      setHMiktar('')
      setHHedef(null)
      setHOkutManual(false)
      setHOkutVal('')
      setHHedefManual(false)
      setHHedefVal('')
    } catch {
      showError('Bağlantı hatası — tekrar deneyin')
    } finally {
      setHTasiniyor(false)
    }
  }

  const hizliEtiketYazdir = async () => {
    if (hEtiketYuk || !hSonuc) return
    setHEtiketYuk(true)
    try {
      const res = await fetch('/api/depo/etiket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stokKodu: hSonuc.partNo,
          stokAdi: '',
          miktar: hSonuc.miktar,
          birim: hSonuc.birim,
          lot: hSonuc.lot,
          girisTarihi: new Date().toISOString().slice(0, 10),
          kaynakBilgi: `Stok Tasima · ${hSonuc.kaynakAdi} → ${hSonuc.hedefAdi}`,
          lokasyon: hSonuc.hedefAdi,
          kaynakModul: 'Depo El Terminali / Hizli Tasima',
        }),
      })
      if (!res.ok) {
        showError('Etiket üretilemedi')
        return
      }
      const url = URL.createObjectURL(await res.blob())
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch {
      showError('Etiket üretilemedi')
    } finally {
      setHEtiketYuk(false)
    }
  }

  // ── Tek aktif scanner: sihirbaz kapalıyken Hızlı panelin, açıkken sihirbazın ──
  const hizliScanAktif =
    !sihirbazAcik && !hOkutManual && !hHedefManual && !hLoading && !hTasiniyor
  const { inputProps: hizliInputProps } = useScanner(hizliScanAktif, hizliHandle)
  const { inputProps } = useScanner(
    sihirbazAcik && isScanStep && !manualOpen && !loading,
    handleValue,
  )

  const submitManual = () => {
    handleValue(manualVal)
    setManualVal('')
    setManualOpen(false)
  }

  const submitHizliOkut = () => {
    hizliHandle(hOkutVal)
    setHOkutVal('')
    setHOkutManual(false)
  }

  const submitHizliHedef = () => {
    hizliHandle(hHedefVal)
    setHHedefVal('')
    setHHedefManual(false)
  }

  const goBack = () => {
    setErrorMsg(null)
    setManualOpen(false)
    switch (step) {
      case 'KAYNAK_RAF':
        router.push('/terminal/depo')
        break
      case 'KAYNAK_SECIM':
        setMalzemeKaynaklar([])
        setStep('KAYNAK_RAF')
        break
      case 'MALZEME':
        setKaynakRaf(null)
        setRafStok([])
        setStep('KAYNAK_RAF')
        break
      case 'MIKTAR':
        setSecilenStok(null)
        setMiktar('')
        if (malzemeKaynaklar.length > 0) {
          // Çoklu-raf seçiminden gelindi → seçim listesine dön.
          setKaynakRaf(null)
          setMalzemeTeyit(null)
          setStep('KAYNAK_SECIM')
        } else if (malzemeTeyit) {
          // Otomatik-seçilen kaynaktan gelindi → ilk okutmaya dön.
          setKaynakRaf(null)
          setMalzemeTeyit(null)
          setStep('KAYNAK_RAF')
        } else {
          setStep('MALZEME')
        }
        break
      case 'HEDEF_RAF':
        setHedefRaf(null)
        setStep('MIKTAR')
        break
      default:
        break
    }
  }

  const resetAll = () => {
    setStep('KAYNAK_RAF')
    setKaynakRaf(null)
    setRafStok([])
    setSecilenStok(null)
    setMiktar('')
    setHedefRaf(null)
    setErrorMsg(null)
    setManualOpen(false)
    setSonucYol(null)
    setTasiniyor(false)
    setMalzemeKaynaklar([])
    setMalzemeTeyit(null)
  }

  const maxMiktar = secilenStok?.miktar ?? 0
  const miktarNum = Number(miktar || '0')
  const miktarExceed = miktarNum > maxMiktar
  const miktarValid = miktarNum >= 1 && miktarNum <= maxMiktar
  const pressKey = (k: string) => {
    if (k === 'C') return setMiktar('')
    if (k === '⌫') return setMiktar((m) => m.slice(0, -1))
    setMiktar((m) => {
      const next = m === '0' ? k : m + k
      return next.length > 7 ? m : next
    })
  }

  const stoguTasi = async () => {
    // Çifte-dokunma koruması: istek uçuştaysa yok say.
    if (tasiniyor || !secilenStok || !hedefRaf || !kaynakRaf) return
    setTasiniyor(true)
    try {
      const res = await fetch('/api/depo/stok-tasima', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kimlik: secilenStok.kimlik,
          hedefLocationNo: hedefRaf.locationNo,
          miktar: miktarNum,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        // 409'un güncel-miktar mesajı dahil sunucudan geleni göster; adım HEDEF_RAF'ta kalır.
        showError(data?.error ?? 'Taşıma başarısız — tekrar deneyin')
        return
      }
      setSonucYol((data.yol as 'CREATE' | 'UPDATE') ?? null)
      setStep('TAMAM')
    } catch {
      showError('Bağlantı hatası — tekrar deneyin')
    } finally {
      setTasiniyor(false)
    }
  }

  const etiketYazdir = async () => {
    if (etiketYukleniyor || !secilenStok || !kaynakRaf || !hedefRaf) return
    setEtiketYukleniyor(true)
    try {
      const kaynakAd = kaynakRaf.aciklama || kaynakRaf.locationNo
      const hedefAd = hedefRaf.aciklama || hedefRaf.locationNo
      const res = await fetch('/api/depo/etiket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stokKodu: secilenStok.stokKodu,
          stokAdi: secilenStok.stokAdi,
          miktar: miktarNum,
          birim: secilenStok.birim,
          lot: secilenStok.lot,
          girisTarihi: new Date().toISOString().slice(0, 10),
          kaynakBilgi: `Stok Tasima · ${kaynakAd} → ${hedefAd}`,
          lokasyon: hedefAd,
          kaynakModul: 'Depo El Terminali / Stok Tasima',
        }),
      })
      if (!res.ok) {
        showError('Etiket üretilemedi')
        return
      }
      const url = URL.createObjectURL(await res.blob())
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch {
      showError('Etiket üretilemedi')
    } finally {
      setEtiketYukleniyor(false)
    }
  }

  return (
    <div className="relative flex flex-1 flex-col gap-3 py-2">
      {/* Tek aktif scanner: yalnız aktif olan input DOM'da → odak çakışması yok. */}
      {hizliScanAktif && <input {...hizliInputProps} />}
      {sihirbazAcik && isScanStep && <input {...inputProps} />}

      {errorMsg && (
        <div className="absolute inset-x-0 top-0 z-20 mx-2 flex items-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-base font-semibold text-white shadow-lg">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* ═══ BÖLÜM 3: HIZLI TAŞIMA paneli (üstte, tek ekran) ═══ */}
      <section
        className="flex flex-col gap-2.5 rounded-2xl border-2 p-3"
        style={{ borderColor: TERMINAL_ACCENT }}
      >
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5" style={{ color: TERMINAL_ACCENT }} />
          <h2 className="text-base font-semibold" style={{ color: TERMINAL_ACCENT }}>
            Hızlı Taşıma
          </h2>
          {hLoading && (
            <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* a) Okut / kaynak */}
        {!hKaynak && hAdaylar.length === 0 ? (
          <HizliOkutAlani
            label="Barkod ya da malzeme okut"
            placeholder="Barkod veya stok kodu"
            manualOpen={hOkutManual}
            val={hOkutVal}
            setVal={setHOkutVal}
            onOpen={() => setHOkutManual(true)}
            onSubmit={submitHizliOkut}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {hPartCip && (
              <span className="flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-sm font-medium text-emerald-700">
                <Package className="h-4 w-4" />
                {hPartCip}
              </span>
            )}
            {hKaynak ? (
              <span className="flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-sm font-medium text-emerald-700">
                <MapPin className="h-4 w-4" />
                {hKaynak.lokasyonAdi || hKaynak.locationNo} · {hKaynak.mevcutMiktar} {HIZLI_BIRIM}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Kaynak rafını seç ↓</span>
            )}
            <button
              type="button"
              onClick={hizliOkutSifirla}
              className="ml-auto text-xs text-muted-foreground underline underline-offset-2"
            >
              değiştir
            </button>
          </div>
        )}

        {/* çok lokasyon → mini kaynak seçim (FIFO sıralı) */}
        {!hKaynak && hAdaylar.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {hAdaylar.map((k, i) => (
              <button
                key={`${k.locationNo}-${k.lotBatchNo ?? '_'}-${i}`}
                type="button"
                onClick={() => secHizliKaynak(k)}
                className="flex min-h-11 items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2 text-left transition-colors active:bg-muted"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{k.lokasyonAdi || k.locationNo}</div>
                  <div className="text-[11px] text-muted-foreground">
                    ({k.locationNo})
                    {k.lotBatchNo ? ` · Lot ${k.lotBatchNo}` : ''}
                    {k.receiptDate ? ` · ${k.receiptDate.slice(0, 10)}` : ''}
                  </div>
                </div>
                <div className="shrink-0 text-sm font-semibold" style={{ color: TERMINAL_ACCENT }}>
                  {k.mevcutMiktar} {HIZLI_BIRIM}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* b) Adet + c) Hedef + d) Taşı — kaynak seçilince */}
        {hKaynak && (
          <>
            <div
              className={cn(
                'rounded-xl border bg-card py-2 text-center text-3xl font-semibold tabular-nums',
                hMiktarExceed && 'border-red-400 text-red-600',
              )}
            >
              {hMiktar || '0'}
              <span className="ml-1.5 text-lg text-muted-foreground">{HIZLI_BIRIM}</span>
            </div>
            {hMiktarExceed && (
              <p className="text-center text-xs font-medium text-red-600">
                En fazla {hMax} {HIZLI_BIRIM} taşınabilir
              </p>
            )}
            <div className="grid grid-cols-3 gap-1.5">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => hPressKey(key)}
                  className="flex min-h-11 items-center justify-center rounded-xl border bg-card text-xl font-semibold transition-colors active:bg-muted"
                >
                  {key === '⌫' ? <Delete className="h-5 w-5" /> : key}
                </button>
              ))}
            </div>

            {!hHedef ? (
              <HizliOkutAlani
                label="Hedef rafını okut"
                placeholder="Hedef raf kodu"
                manualOpen={hHedefManual}
                val={hHedefVal}
                setVal={setHHedefVal}
                onOpen={() => setHHedefManual(true)}
                onSubmit={submitHizliHedef}
                icon={<MapPin className="h-5 w-5" />}
              />
            ) : (
              <div className="flex items-center gap-2">
                <span
                  className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium text-white"
                  style={{ background: TERMINAL_ACCENT }}
                >
                  <MapPin className="h-4 w-4" />
                  {hHedef.aciklama || hHedef.locationNo} ({hHedef.locationNo})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setHHedef(null)
                    setHHedefManual(false)
                    setHHedefVal('')
                  }}
                  className="ml-auto text-xs text-muted-foreground underline underline-offset-2"
                >
                  değiştir
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={hizliTasi}
              disabled={!hHedef || !hMiktarValid || hTasiniyor}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-base font-semibold text-white transition-all hover:bg-emerald-700 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
            >
              {hTasiniyor ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <PackageCheck className="h-5 w-5" />
              )}
              {hTasiniyor ? 'Taşınıyor…' : 'Taşı'}
            </button>
          </>
        )}

        {/* başarı çipi + etiket (panel sıfırlansa da snapshot'tan) */}
        {hSonuc && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
              <Check className="h-4 w-4 shrink-0" />
              {hSonuc.miktar} {hSonuc.birim} · {hSonuc.kaynakAdi} → {hSonuc.hedefAdi}
            </div>
            <button
              type="button"
              onClick={hizliEtiketYazdir}
              disabled={hEtiketYuk}
              className="flex min-h-10 items-center justify-center gap-2 rounded-xl border bg-card text-sm font-medium transition-colors active:bg-muted/70 disabled:opacity-50"
            >
              {hEtiketYuk ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Printer className="h-4 w-4" />
              )}
              Etiket Yazdır
            </button>
          </div>
        )}
      </section>

      {/* ═══ Adım adım taşıma (sihirbaz, ikincil — accordion) ═══ */}
      <button
        type="button"
        onClick={() => setSihirbazAcik((v) => !v)}
        className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors active:bg-muted/70"
      >
        {sihirbazAcik ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        Adım adım taşıma
      </button>

      {sihirbazAcik && (
      <>
      {/* Üst bar */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={goBack}
          aria-label="Geri"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors active:bg-muted/70"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-lg font-semibold">Stok Taşıma</h1>
        {step !== 'TAMAM' && (
          <span className="rounded-full border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {STEP_INDEX[step]}/4
          </span>
        )}
      </div>

      {kaynakRaf && step !== 'TAMAM' && (
        <div className="flex w-fit items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
          <MapPin className="h-4 w-4" />
          Raf: {kaynakRaf.aciklama || kaynakRaf.locationNo} ({kaynakRaf.locationNo})
        </div>
      )}

      {malzemeTeyit && step !== 'TAMAM' && (
        <div className="flex w-fit items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
          <Package className="h-4 w-4" />
          Malzeme {malzemeTeyit}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          IFS sorgulanıyor…
        </div>
      )}

      {/* KAYNAK_RAF */}
      {step === 'KAYNAK_RAF' && !loading && (
        <ScanPrompt
          icon={<ScanLine className="h-12 w-12" />}
          title="Rafı veya malzemeyi okut"
          hint="Raf etiketi ya da malzeme etiketi okut"
          manualOpen={manualOpen}
          manualVal={manualVal}
          setManualVal={setManualVal}
          onManualOpen={() => setManualOpen(true)}
          onManualSubmit={submitManual}
          manualPlaceholder="Raf kodu veya stok kodu"
        />
      )}

      {/* KAYNAK_SECIM — malzeme birden çok rafta: kaynak raf seçim listesi (FIFO sıralı) */}
      {step === 'KAYNAK_SECIM' && !loading && (
        <div className="flex flex-1 flex-col gap-3">
          <ScanPrompt
            icon={<MapPin className="h-12 w-12" />}
            title="Kaynak rafı seç"
            hint="Malzemenin bulunduğu rafı seç ya da raf etiketi okut"
            manualOpen={manualOpen}
            manualVal={manualVal}
            setManualVal={setManualVal}
            onManualOpen={() => setManualOpen(true)}
            onManualSubmit={submitManual}
            manualPlaceholder="Raf kodu"
            compact
          />
          <div className="flex flex-col gap-2">
            {malzemeKaynaklar.map((k, i) => (
              <button
                key={`${k.locationNo}-${k.lotBatchNo ?? '_'}-${i}`}
                type="button"
                onClick={() => secKaynakStok(k)}
                className="flex min-h-14 items-center justify-between gap-3 rounded-xl border bg-card p-3 text-left transition-colors active:bg-muted"
              >
                <div className="min-w-0">
                  <div className="text-lg font-semibold">{k.lokasyonAdi || k.locationNo}</div>
                  <div className="text-xs text-muted-foreground">
                    ({k.locationNo})
                    {k.lotBatchNo ? ` · Lot: ${k.lotBatchNo}` : ''}
                    {k.receiptDate ? ` · ${k.receiptDate.slice(0, 10)}` : ''}
                  </div>
                </div>
                <div className="shrink-0 text-sm font-semibold" style={{ color: TERMINAL_ACCENT }}>
                  {k.mevcutMiktar} ad
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* MALZEME — raf stok listesi (kart) + okutma */}
      {step === 'MALZEME' && !loading && (
        <div className="flex flex-1 flex-col gap-3">
          <ScanPrompt
            icon={<Package className="h-12 w-12" />}
            title="Malzemeyi okut"
            hint="Etiketi okut ya da aşağıdan seç"
            manualOpen={manualOpen}
            manualVal={manualVal}
            setManualVal={setManualVal}
            onManualOpen={() => setManualOpen(true)}
            onManualSubmit={submitManual}
            manualPlaceholder="Stok kodu (| lot)"
            compact
          />
          <div className="flex flex-col gap-2">
            {rafStok.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                Bu rafta taşınabilir stok yok
              </div>
            ) : (
              rafStok.map((s, i) => (
                <button
                  key={`${s.stokKodu}-${s.lot ?? '_'}-${i}`}
                  type="button"
                  onClick={() => secStok(s)}
                  className="flex min-h-14 items-center justify-between gap-3 rounded-xl border bg-card p-3 text-left transition-colors active:bg-muted"
                >
                  <div className="min-w-0">
                    {/* TODO: stokAdi (PartDescription) bu projeksiyonda yok — şimdilik stok kodu */}
                    <div className="font-semibold">{s.stokKodu}</div>
                    {s.lot && <div className="text-xs text-muted-foreground">Lot: {s.lot}</div>}
                  </div>
                  <div className="shrink-0 text-sm font-semibold" style={{ color: TERMINAL_ACCENT }}>
                    {s.miktar} {s.birim}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* MIKTAR */}
      {step === 'MIKTAR' && secilenStok && (
        <div className="flex flex-1 flex-col gap-3">
          <div className="rounded-2xl border bg-card p-4">
            <div className="text-base font-semibold">{secilenStok.stokKodu}</div>
            {secilenStok.lot && <div className="text-xs text-muted-foreground">Lot: {secilenStok.lot}</div>}
            <div className="mt-1 text-sm">
              Taşınabilir:{' '}
              <span className="font-semibold" style={{ color: TERMINAL_ACCENT }}>
                {secilenStok.miktar} {secilenStok.birim}
              </span>
            </div>
          </div>

          <div
            className={cn(
              'rounded-2xl border bg-card py-4 text-center text-5xl font-semibold tabular-nums',
              miktarExceed && 'border-red-400 text-red-600',
            )}
          >
            {miktar || '0'}
            <span className="ml-2 text-2xl text-muted-foreground">{secilenStok.birim}</span>
          </div>
          {miktarExceed && (
            <p className="text-center text-sm font-medium text-red-600">
              En fazla {maxMiktar} {secilenStok.birim} taşınabilir
            </p>
          )}

          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => pressKey(key)}
                className="flex min-h-12 items-center justify-center rounded-xl border bg-card text-2xl font-semibold transition-colors active:bg-muted"
              >
                {key === '⌫' ? <Delete className="h-6 w-6" /> : key}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => miktarValid && setStep('HEDEF_RAF')}
            disabled={!miktarValid}
            className="mt-1 flex min-h-14 items-center justify-center gap-2 rounded-2xl text-lg font-semibold text-white transition-all active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: TERMINAL_ACCENT }}
          >
            Devam
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* HEDEF_RAF */}
      {step === 'HEDEF_RAF' && secilenStok && !loading && (
        <div className="flex flex-1 flex-col gap-3">
          <ScanPrompt
            icon={<MapPin className="h-12 w-12" />}
            title="Hedef rafı okut"
            hint="Malzemenin taşınacağı rafı okutun"
            manualOpen={manualOpen}
            manualVal={manualVal}
            setManualVal={setManualVal}
            onManualOpen={() => setManualOpen(true)}
            onManualSubmit={submitManual}
            manualPlaceholder="Hedef raf kodu"
            compact
          />
          <div className="rounded-2xl border bg-card p-4 text-sm">
            <div className="font-semibold">
              {secilenStok.stokKodu} · {miktar} {secilenStok.birim}
            </div>
            {secilenStok.lot && <div className="text-xs text-muted-foreground">Lot: {secilenStok.lot}</div>}
            <div className="mt-2 flex items-center gap-2 font-medium">
              <span className="rounded-md bg-muted px-2 py-0.5">{kaynakRaf?.locationNo}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span
                className={cn(
                  'rounded-md px-2 py-0.5',
                  hedefRaf ? 'text-white' : 'border border-dashed text-muted-foreground',
                )}
                style={hedefRaf ? { background: TERMINAL_ACCENT } : undefined}
              >
                {hedefRaf ? hedefRaf.locationNo : 'okutun'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={stoguTasi}
            disabled={!hedefRaf || tasiniyor}
            className="mt-auto flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-lg font-semibold text-white transition-all hover:bg-emerald-700 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
          >
            {tasiniyor ? <Loader2 className="h-6 w-6 animate-spin" /> : <PackageCheck className="h-6 w-6" />}
            {tasiniyor ? 'Taşınıyor…' : 'Stoğu Taşı'}
          </button>
        </div>
      )}

      {/* TAMAM — TEST MODU */}
      {step === 'TAMAM' && secilenStok && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <Check className="h-11 w-11" />
          </div>
          <div>
            <div className="text-2xl font-semibold">
              {miktar} {secilenStok.birim} · {secilenStok.stokKodu}
            </div>
            <div className="mt-1 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <span className="rounded-md bg-muted px-2 py-0.5">{kaynakRaf?.locationNo}</span>
              <ArrowRight className="h-4 w-4" />
              <span className="rounded-md bg-muted px-2 py-0.5">{hedefRaf?.locationNo}</span>
            </div>
          </div>

          <div className="w-full rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-800">
            {miktar} {secilenStok.birim} taşındı ·{' '}
            {kaynakRaf?.aciklama || kaynakRaf?.locationNo} →{' '}
            {hedefRaf?.aciklama || hedefRaf?.locationNo}
          </div>
          <div className="-mt-2 text-xs text-muted-foreground">
            IFS kaydı: {sonucYol === 'UPDATE' ? 'mevcut satıra eklendi' : 'yeni satır açıldı'}
          </div>

          <div className="mt-1 flex w-full flex-col gap-2">
            <button
              type="button"
              onClick={etiketYazdir}
              disabled={etiketYukleniyor}
              className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border bg-card text-base font-medium transition-colors active:bg-muted/70 disabled:opacity-50"
            >
              {etiketYukleniyor ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Printer className="h-5 w-5" />
              )}
              {etiketYukleniyor ? 'Hazırlanıyor…' : 'Etiket Yazdır'}
            </button>
            <button
              type="button"
              onClick={resetAll}
              className="flex min-h-14 items-center justify-center gap-2 rounded-2xl text-lg font-semibold text-white active:translate-y-px"
              style={{ background: TERMINAL_ACCENT }}
            >
              Yeni Taşıma
            </button>
            <Link
              href="/terminal/depo"
              className="flex min-h-12 items-center justify-center rounded-2xl border text-base font-medium active:bg-muted/70"
            >
              Depo Menüsü
            </Link>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  )
}

// Hızlı panel kompakt okutma alanı: scanner her zaman aktif (görünmez input); dokun →
// elle giriş açılır. Aynı desen hem kaynak-okut hem hedef-okut için kullanılır.
interface HizliOkutAlaniProps {
  label: string
  placeholder: string
  manualOpen: boolean
  val: string
  setVal: (v: string) => void
  onOpen: () => void
  onSubmit: () => void
  icon?: React.ReactNode
}

function HizliOkutAlani({
  label,
  placeholder,
  manualOpen,
  val,
  setVal,
  onOpen,
  onSubmit,
  icon,
}: HizliOkutAlaniProps) {
  if (manualOpen) {
    return (
      <div className="flex gap-2">
        <input
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
          placeholder={placeholder}
          className="h-10 flex-1 rounded-xl border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="button"
          onClick={onSubmit}
          className="h-10 rounded-xl px-3 text-sm font-semibold text-white"
          style={{ background: TERMINAL_ACCENT }}
        >
          Onayla
        </button>
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed py-2 text-sm font-medium"
      style={{ borderColor: TERMINAL_ACCENT, color: TERMINAL_ACCENT }}
    >
      {icon ?? <ScanLine className="h-5 w-5" />}
      {label}
      <span className="text-xs text-muted-foreground">/ elle</span>
    </button>
  )
}

interface ScanPromptProps {
  icon: React.ReactNode
  title: string
  hint: string
  manualOpen: boolean
  manualVal: string
  setManualVal: (v: string) => void
  onManualOpen: () => void
  onManualSubmit: () => void
  manualPlaceholder: string
  compact?: boolean
}

function ScanPrompt({
  icon,
  title,
  hint,
  manualOpen,
  manualVal,
  setManualVal,
  onManualOpen,
  onManualSubmit,
  manualPlaceholder,
  compact,
}: ScanPromptProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={cn(
          'flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center',
          compact ? 'py-6' : 'py-10',
        )}
        style={{ borderColor: TERMINAL_ACCENT, color: TERMINAL_ACCENT }}
      >
        {icon}
        <div className="text-lg font-semibold">{title}</div>
        <div className="text-sm text-muted-foreground">{hint}</div>
      </div>

      {manualOpen ? (
        <div className="flex w-full gap-2">
          <input
            autoFocus
            value={manualVal}
            onChange={(e) => setManualVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onManualSubmit()}
            placeholder={manualPlaceholder}
            className="h-11 flex-1 rounded-xl border bg-background px-3 text-base outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            type="button"
            onClick={onManualSubmit}
            className="h-11 rounded-xl px-4 text-sm font-semibold text-white"
            style={{ background: TERMINAL_ACCENT }}
          >
            Onayla
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onManualOpen}
          className="text-sm text-muted-foreground underline underline-offset-2"
        >
          veya elle gir
        </button>
      )}
    </div>
  )
}
