'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
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
import { barkodIdAday, parseEtiket, type EtiketKaynak } from '@/lib/depo/etiket-parse'
import { useScanner } from '@/lib/depo/use-scanner'
import type { DepoRafBilgisi, DepoStokKaydi } from '@/lib/ifs/depo-stok'
import type { FifoKaynak } from '@/lib/ifs/tuketim'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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

// Ortak kaynak çözücü sonucu (sihirbaz + Hızlı panel paylaşır).
type KaynakSonuc =
  | { tip: 'raf'; raf: DepoRafBilgisi; stok: DepoStokKaydi[] }
  | { tip: 'stoklar'; satirlar: FifoKaynak[] }
  | { tip: 'barkod-stoksuz'; kod: string } // barkod GEÇERLİ ama taşınabilir stok yok
  | { tip: 'yok'; sorgu: string }

/**
 * Ortak kaynak çözücü — state'e DOKUNMAZ, yalnız fetch + sınıflama.
 * Sıra: barkod → raf (/raf/{kod}/stok) → parça (/parca/{stokKodu}/stok).
 *
 * Barkod dalı GELİŞ YOLUNDAN BAĞIMSIZ: Stok Taşıma'da iş emri kavramı yok → çıplak sayının
 * "barkod mu iş emri mi" belirsizliği burada YOK; barkod bulunamazsa zaten raf→parça'ya düşülür.
 * (Toplama ekranındaki 'elle→barkod denenmez' kuralı oraya özeldir, burayı bağlamaz.)
 * `kaynak` hâlâ parça dalında parseEtiket için kullanılır.
 */
async function cozKaynakCekirdek(giris: string, kaynak: EtiketKaynak): Promise<KaynakSonuc> {
  // 1) Barkod — okutma/elle fark etmez
  const bId = barkodIdAday(giris)
  if (bId !== null) {
    const bRes = await fetch(`/api/depo/barkod/${bId}`)
    if (bRes.ok) {
      const bData = await bRes.json().catch(() => null)
      if (bData?.ok) {
        // Barkod GEÇERLİ → sonucu maskeleme: stok boşsa raf/parça'ya düşme, ayırt et.
        const stoklar = (bData.stoklar ?? []) as FifoKaynak[]
        if (stoklar.length > 0) return { tip: 'stoklar', satirlar: stoklar }
        return { tip: 'barkod-stoksuz', kod: giris }
      }
    }
    // Barkod BULUNAMADI (404/!ok) → aşağıdaki raf/parça yoluna düş
  }
  // 2) Raf
  const rafRes = await fetch(`/api/depo/raf/${encodeURIComponent(giris)}/stok`)
  const rafData = await rafRes.json().catch(() => null)
  if (rafRes.ok && rafData?.ok) {
    return { tip: 'raf', raf: rafData.raf as DepoRafBilgisi, stok: (rafData.stok ?? []) as DepoStokKaydi[] }
  }
  // 3) Parça
  const p = parseEtiket(giris, kaynak)
  const stokKodu = p.stokKodu ?? giris
  const pRes = await fetch(`/api/depo/parca/${encodeURIComponent(stokKodu)}/stok`)
  if (pRes.ok) {
    const pData = await pRes.json().catch(() => null)
    const satirlar = pData?.ok ? ((pData.satirlar ?? []) as FifoKaynak[]) : []
    if (satirlar.length > 0) return { tip: 'stoklar', satirlar }
  }
  return { tip: 'yok', sorgu: giris }
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

  // Malzeme-öncelikli giriş: çoklu raf seçim listesi + otomatik seçim teyidi.
  const [malzemeKaynaklar, setMalzemeKaynaklar] = useState<FifoKaynak[]>([])
  const [malzemeTeyit, setMalzemeTeyit] = useState<string | null>(null)

  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [errorKey, setErrorKey] = useState(0)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualVal, setManualVal] = useState('')

  // ── BÖLÜM 3: Hızlı Taşıma paneli + sihirbaz — TEK görünür panel (tek scanner) ─────
  // tasimaMode: aynı anda YALNIZ biri render edilir → tek scanner, çakışma yok.
  const [tasimaMode, setTasimaMode] = useState<'hizli' | 'sihirbaz'>('hizli')
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
  // Hızlı'da raf→malzeme mini-seçimi (sihirbazın MALZEME adımının karşılığı).
  const [hRaf, setHRaf] = useState<DepoRafBilgisi | null>(null)
  const [hRafStok, setHRafStok] = useState<DepoStokKaydi[]>([])

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
    async (kod: string, kaynak: EtiketKaynak) => {
      setLoading(true)
      try {
        const r = await cozKaynakCekirdek(kod, kaynak)
        if (r.tip === 'raf') {
          // MEVCUT davranış: kaynakRaf + rafStok set, MALZEME adımına geç.
          setKaynakRaf(r.raf)
          setRafStok(r.stok)
          setStep('MALZEME')
          return
        }
        if (r.tip === 'stoklar') {
          const rafSayisi = new Set(r.satirlar.map((s) => s.locationNo)).size
          if (rafSayisi === 1) {
            // Tek raf → otomatik seç (FIFO ilk satır), MIKTAR'a geç.
            secKaynakStok(r.satirlar[0])
            return
          }
          // Çoklu raf → seçim listesi (gelen sıra = FIFO).
          setMalzemeKaynaklar(r.satirlar)
          setStep('KAYNAK_SECIM')
          return
        }
        if (r.tip === 'barkod-stoksuz') {
          showError(`Barkod geçerli ama taşınabilir stok yok: ${r.kod}`)
          return
        }
        // Barkod da her iki yolda deneniyor → kaynak ayrımlı mesaj anlamsız: tek mesaj.
        showError(`Barkod, raf ya da stok kodu bulunamadı: ${r.sorgu}`)
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
    (raw: string, kaynak: EtiketKaynak = 'okutma') => {
      const val = raw.trim()
      if (!val) return
      if (step === 'KAYNAK_RAF') return void cozKaynak(val, kaynak)
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
        const p = parseEtiket(val, kaynak)
        if (!p.stokKodu) return showError('Malzeme okutun')
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
    setHRaf(null)
    setHRafStok([])
  }

  // Kaynak stok satırını seç → çip + adet/hedef alanlarını aç.
  const secHizliKaynak = (k: FifoKaynak) => {
    setHKaynak(k)
    // Seçim yapıldı → çipi SEÇİLEN satırın lot'uyla tazele. (Seçim öncesi çip yalnız
    // tek lot varsa lot yazar; çoklu lotta hangi lot olduğu ancak burada belli olur.)
    setHPartCip(`${k.kimlik.partNo}${k.lotBatchNo ? ` · ${k.lotBatchNo}` : ''}`)
    setHAdaylar((a) => (a.length ? a : [k]))
    setHRaf(null)
    setHRafStok([])
    setHMiktar('')
    setHHedef(null)
    setHHedefManual(false)
    setHHedefVal('')
  }

  // Raf çözülünce o raftaki bir malzemeyi (DepoStokKaydi) seç → FifoKaynak'a çevir → kaynak yap.
  const secRafMalzeme = (raf: DepoRafBilgisi, kaydi: DepoStokKaydi) => {
    const asFifo: FifoKaynak = {
      kimlik: kaydi.kimlik,
      locationNo: raf.locationNo,
      lokasyonAdi: raf.aciklama || raf.locationNo,
      lotBatchNo: kaydi.lot,
      alinacak: kaydi.miktar,
      mevcutMiktar: kaydi.miktar,
      receiptDate: '',
    }
    setHPartCip(`${kaydi.stokKodu}${kaydi.lot ? ` · ${kaydi.lot}` : ''}`)
    secHizliKaynak(asFifo)
  }

  // a) Okut çözümle — ortak çekirdek: barkod→raf→parça. Sonucu Hızlı state'ine işle.
  const cozHizliKaynak = async (kod: string, kaynak: EtiketKaynak) => {
    setHLoading(true)
    setHSonuc(null)
    try {
      const r = await cozKaynakCekirdek(kod, kaynak)
      if (r.tip === 'stoklar') {
        const satirlar = r.satirlar
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
      } else if (r.tip === 'raf') {
        // Raf çözüldü → o raftaki malzemeyi seç (sihirbaz MALZEME adımının Hızlı karşılığı).
        setHRaf(r.raf)
        if (r.stok.length === 1) {
          secRafMalzeme(r.raf, r.stok[0]) // tek malzeme → otomatik seç
        } else {
          setHRafStok(r.stok) // çok malzeme → liste
        }
      } else if (r.tip === 'barkod-stoksuz') {
        showError(`Barkod geçerli ama taşınabilir stok yok: ${r.kod}`)
      } else {
        // Barkod da her iki yolda deneniyor → kaynak ayrımlı mesaj anlamsız: tek mesaj.
        showError(`Barkod, raf ya da stok kodu bulunamadı: ${kod}`)
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

  // Okutma dağıtımı (Hızlı panel): kaynak yoksa çöz/seç; kaynak varsa hedef.
  const hizliHandle = (raw: string, kaynak: EtiketKaynak = 'okutma') => {
    const val = raw.trim()
    if (!val || hLoading || hTasiniyor) return
    if (!hKaynak) {
      // Raf çözüldü → o raftaki malzemeyi okutarak seç.
      if (hRaf && hRafStok.length > 0) {
        const p = parseEtiket(val, kaynak)
        const kod = p.stokKodu ?? val
        const m = hRafStok.find((s) => s.stokKodu === kod)
        if (!m) return showError('Bu rafta bu malzeme yok')
        return secRafMalzeme(hRaf, m)
      }
      // Çoklu lokasyon → raf okutarak seç.
      if (hAdaylar.length > 0) {
        const low = val.toLowerCase()
        const k = hAdaylar.find(
          (m) => m.locationNo.toLowerCase() === low || (m.lokasyonAdi ?? '').toLowerCase() === low,
        )
        if (!k) return showError('Bu rafta bu malzeme yok')
        return secHizliKaynak(k)
      }
      // Hiç aday yok → ilk çözüm.
      return void cozHizliKaynak(val, kaynak)
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
      setHRaf(null)
      setHRafStok([])
    } catch {
      showError('Bağlantı hatası — tekrar deneyin')
    } finally {
      setHTasiniyor(false)
    }
  }


  // ── TEK scanner: yalnız render'daki panel dinler (tasimaMode). Tarama daima 'okutma'. ──
  const dispatchScan = (v: string) => {
    if (tasimaMode === 'hizli') hizliHandle(v, 'okutma')
    else handleValue(v, 'okutma')
  }
  const scanAktif =
    tasimaMode === 'hizli'
      ? !hOkutManual && !hHedefManual && !hLoading && !hTasiniyor
      : isScanStep && !manualOpen && !loading
  const { inputProps } = useScanner(scanAktif, dispatchScan)

  const submitManual = () => {
    handleValue(manualVal, 'elle')
    setManualVal('')
    setManualOpen(false)
  }

  const submitHizliOkut = () => {
    hizliHandle(hOkutVal, 'elle')
    setHOkutVal('')
    setHOkutManual(false)
  }

  const submitHizliHedef = () => {
    hizliHandle(hHedefVal, 'elle')
    setHHedefVal('')
    setHHedefManual(false)
  }

  const goBack = () => {
    setErrorMsg(null)
    setManualOpen(false)
    // Hızlı mod: `step` kullanılmaz → kendi kademeli dalı (toplama'nın geri() mantığı).
    // Seçim varsa önce onu temizle (ekranda kal), başlangıç durumundaysa menüye çık.
    if (tasimaMode === 'hizli') {
      const secimVar =
        hKaynak !== null || hRaf !== null || hRafStok.length > 0 || hAdaylar.length > 0
      if (secimVar) hizliOkutSifirla()
      else router.push('/terminal/depo')
      return
    }
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
      case 'TAMAM':
        // Taşıma bitti → adım geri anlamsız; "Yeni Taşıma" ile aynı: başa dön.
        resetAll()
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


  return (
    <div className="relative flex flex-1 flex-col gap-3 py-2">
      {/* TEK scanner: yalnız aktif panel dinler (tek gizli input). */}
      {scanAktif && <input {...inputProps} />}

      {errorMsg && (
        <div className="absolute inset-x-0 top-0 z-20 mx-2 flex items-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-base font-semibold text-white shadow-lg">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Üst bar — HER İKİ modda ortak (geri + başlık); n/4 çipi yalnız sihirbazda. */}
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
        {tasimaMode === 'sihirbaz' && step !== 'TAMAM' && (
          <span className="rounded-full border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {STEP_INDEX[step]}/4
          </span>
        )}
      </div>

      {/* ═══ HIZLI TAŞIMA paneli — tasimaMode==='hizli' iken TEK görünür ═══ */}
      {tasimaMode === 'hizli' && (
      <section
        className="flex flex-col gap-2.5 rounded-2xl border-2 p-3"
        style={{ borderColor: TERMINAL_ACCENT }}
      >
        <div className="flex items-center gap-2">
          {/* Mod etiketi — ekran başlığı ortak barda (h1); burası sihirbazdaki
              'Adım adım taşıma' etiketinin karşılığı → h1 ile yarışmasın diye küçük. */}
          <Zap className="h-4 w-4" style={{ color: TERMINAL_ACCENT }} />
          <h2 className="text-sm font-semibold" style={{ color: TERMINAL_ACCENT }}>
            Hızlı Taşıma
          </h2>
          {hLoading && (
            <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* a) Kaynak — okutma şeridi (barkod DAHİL) + elle; çözülünce çip / seçim listeleri */}
        {hKaynak ? (
          /* Kaynak seçildi → çip + değiştir */
          <div className="flex flex-wrap items-center gap-2">
            {hPartCip && (
              <span className="flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-sm font-medium text-emerald-700">
                <Package className="h-4 w-4" />
                {hPartCip}
              </span>
            )}
            <span
              className="flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-sm font-medium text-emerald-700"
            >
              <MapPin className="h-4 w-4" />
              {hKaynak.lokasyonAdi || hKaynak.locationNo} · {hKaynak.mevcutMiktar} {HIZLI_BIRIM}
            </span>
            <button
              type="button"
              onClick={hizliOkutSifirla}
              className="ml-auto text-xs text-muted-foreground underline underline-offset-2"
            >
              değiştir
            </button>
          </div>
        ) : hRafStok.length > 0 ? (
          /* Raf çözüldü → o raftaki malzemeyi seç (dokun ya da okut) */
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <MapPin className="h-4 w-4" /> {hRaf?.aciklama || hRaf?.locationNo} — malzeme seç
            </div>
            {hRafStok.map((s, i) => (
              <button
                key={`${s.stokKodu}-${s.lot ?? '_'}-${i}`}
                type="button"
                onClick={() => hRaf && secRafMalzeme(hRaf, s)}
                className="flex min-h-11 items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2 text-left transition-colors active:bg-muted"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{s.stokKodu}</div>
                  {s.lot && <div className="text-[11px] text-muted-foreground">Lot {s.lot}</div>}
                </div>
                <div className="shrink-0 text-sm font-semibold" style={{ color: TERMINAL_ACCENT }}>
                  {s.miktar} {s.birim}
                </div>
              </button>
            ))}
            <button type="button" onClick={hizliOkutSifirla} className="self-center text-xs text-muted-foreground underline underline-offset-2">
              vazgeç
            </button>
          </div>
        ) : hAdaylar.length > 0 ? (
          /* Çoklu lokasyon (aynı malzeme) → raf seç (dokun ya da okut) */
          <div className="flex flex-col gap-1.5">
            {hPartCip && (
              <span className="flex w-fit items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-sm font-medium text-emerald-700">
                <Package className="h-4 w-4" />
                {hPartCip}
              </span>
            )}
            <div className="text-xs font-medium text-muted-foreground">Kaynak rafını seç:</div>
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
            <button type="button" onClick={hizliOkutSifirla} className="self-center text-xs text-muted-foreground underline underline-offset-2">
              vazgeç
            </button>
          </div>
        ) : (
          /* Henüz hiçbir şey → okutma şeridi (kaynak:'okutma') + "veya elle gir" (kaynak:'elle') */
          <div className="flex flex-col gap-2">
            <div
              className="flex items-center gap-3 rounded-xl border p-3"
              style={{ borderColor: TERMINAL_ACCENT, background: `${TERMINAL_ACCENT}0D` }}
            >
              <ScanLine className="h-6 w-6 shrink-0" style={{ color: TERMINAL_ACCENT }} />
              <div className="min-w-0 flex-1 leading-tight">
                <div className="text-sm font-semibold" style={{ color: TERMINAL_ACCENT }}>Barkod ya da malzeme okut</div>
                <div className="truncate text-xs text-muted-foreground">barkod / raf / stok kodu çözülür</div>
              </div>
            </div>
            {hOkutManual ? (
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={hOkutVal}
                  onChange={(e) => setHOkutVal(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitHizliOkut()}
                  placeholder="Raf ya da stok kodu"
                  className="h-10 flex-1 rounded-xl border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
                <button type="button" onClick={submitHizliOkut} className="h-10 rounded-xl px-3 text-sm font-semibold text-white" style={{ background: TERMINAL_ACCENT }}>
                  Onayla
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setHOkutManual(true)} className="self-center text-sm text-muted-foreground underline underline-offset-2">
                veya elle gir
              </button>
            )}
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
            <EtiketYazdirButton
              key={`${hSonuc.partNo}|${hSonuc.hedefAdi}|${hSonuc.miktar}|${hSonuc.kaynakAdi}`}
              payload={{
                stokKodu: hSonuc.partNo,
                stokAdi: '',
                miktar: hSonuc.miktar,
                birim: hSonuc.birim,
                lot: hSonuc.lot,
                girisTarihi: new Date().toISOString().slice(0, 10),
                kaynakBilgi: `Stok Tasima · ${hSonuc.kaynakAdi} → ${hSonuc.hedefAdi}`,
                lokasyon: hSonuc.hedefAdi,
                kaynakModul: 'Depo El Terminali / Hizli Tasima',
              }}
            />
          </div>
        )}

        {/* Sihirbaza geç (yalnız başlangıç okutma durumunda) */}
        {!hKaynak && hAdaylar.length === 0 && hRafStok.length === 0 && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setTasimaMode('sihirbaz')}
            className="self-center gap-2 text-sm text-muted-foreground"
          >
            <ArrowRight className="h-4 w-4" />
            Adım adım taşı
          </Button>
        )}
      </section>
      )}

      {/* ═══ Adım adım taşıma (sihirbaz) — tasimaMode==='sihirbaz' iken TEK görünür ═══ */}
      {tasimaMode === 'sihirbaz' && (
      <div className="flex flex-col gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            resetAll()
            setTasimaMode('hizli')
          }}
          className="self-start gap-2 text-sm text-muted-foreground"
        >
          {/* Zap: mod değiştirme — ortak bardaki ArrowLeft (navigasyon) ile karışmasın. */}
          <Zap className="h-4 w-4" />
          Hızlı taşımaya dön
        </Button>
        <div className="text-sm font-medium text-muted-foreground">Adım adım taşıma</div>

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
            <EtiketYazdirButton
              buyuk
              payload={
                secilenStok && kaynakRaf && hedefRaf
                  ? {
                      stokKodu: secilenStok.stokKodu,
                      stokAdi: secilenStok.stokAdi,
                      miktar: miktarNum,
                      birim: secilenStok.birim,
                      lot: secilenStok.lot,
                      girisTarihi: new Date().toISOString().slice(0, 10),
                      kaynakBilgi: `Stok Tasima · ${kaynakRaf.aciklama || kaynakRaf.locationNo} → ${hedefRaf.aciklama || hedefRaf.locationNo}`,
                      lokasyon: hedefRaf.aciklama || hedefRaf.locationNo,
                      kaynakModul: 'Depo El Terminali / Stok Tasima',
                    }
                  : null
              }
            />
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
      </div>
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

interface EtiketPayload {
  stokKodu: string
  stokAdi: string
  miktar: number
  birim: string
  lot?: string
  girisTarihi: string
  kaynakBilgi: string
  lokasyon: string
  kaynakModul: string
}

/**
 * "Etiket Yazdır" — adet sorusu + kalıcı-barkod uyarısı + tekrar-basma koruması.
 * Her basım route'ta adet kadar AYRI IFS barkodu üretir (kalıcı). payload null ise pasif.
 */
function EtiketYazdirButton({ payload, buyuk }: { payload: EtiketPayload | null; buyuk?: boolean }) {
  const [acik, setAcik] = useState(false)
  const [onayAcik, setOnayAcik] = useState(false)
  const [adet, setAdet] = useState('1')
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  const [basildi, setBasildi] = useState(false)

  const adetNum = Math.min(50, Math.max(1, Math.floor(Number(adet) || 1)))

  const diyaloguAc = () => {
    setHata(null)
    setAdet('1')
    setAcik(true)
  }

  const bas = async () => {
    if (!payload || yukleniyor) return
    setYukleniyor(true)
    setHata(null)
    try {
      const res = await fetch('/api/depo/etiket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, adet: adetNum }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        // Route'un mesajı (üretilen kalıcı ID'ler dahil) olduğu gibi gösterilir.
        setHata(data?.error ?? `Etiket üretilemedi (HTTP ${res.status})`)
        return
      }
      const url = URL.createObjectURL(await res.blob())
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
      setBasildi(true)
      setAcik(false)
    } catch {
      setHata('Bağlantı hatası — tekrar deneyin')
    } finally {
      setYukleniyor(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={!payload}
        onClick={() => (basildi ? setOnayAcik(true) : diyaloguAc())}
        className={cn(
          'w-full gap-2',
          buyuk ? 'min-h-14 rounded-2xl text-base' : 'min-h-10 rounded-xl text-sm',
          basildi && 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-50',
        )}
      >
        {basildi ? <Check className={buyuk ? 'h-5 w-5' : 'h-4 w-4'} /> : <Printer className={buyuk ? 'h-5 w-5' : 'h-4 w-4'} />}
        {basildi ? 'Basıldı' : 'Etiket Yazdır'}
      </Button>

      {/* Basım diyaloğu — adet + kalıcı-barkod uyarısı */}
      <Dialog open={acik} onOpenChange={(o) => { if (!yukleniyor) setAcik(o) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Etiket Yazdır</DialogTitle>
          </DialogHeader>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Kalıcı barkod üretilir</AlertTitle>
            <AlertDescription>
              Her etiket için IFS&apos;te benzersiz barkod numarası üretilir. Bu numaralar kalıcıdır, silinemez.
            </AlertDescription>
          </Alert>
          <div className="flex items-center gap-3">
            <label htmlFor="etiket-adet" className="text-sm font-medium">Adet</label>
            <Input
              id="etiket-adet"
              type="number"
              min={1}
              max={50}
              value={adet}
              onChange={(e) => setAdet(e.target.value)}
              disabled={yukleniyor}
              className="w-24"
            />
            <span className="text-xs text-muted-foreground">1–50</span>
          </div>
          {hata && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="whitespace-pre-wrap break-words">{hata}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAcik(false)} disabled={yukleniyor}>
              Vazgeç
            </Button>
            <Button type="button" onClick={bas} disabled={yukleniyor} className="gap-2">
              {yukleniyor && <Loader2 className="h-4 w-4 animate-spin" />}
              {yukleniyor ? `${adetNum} etiket üretiliyor…` : `${adetNum} etiket bas`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tekrar-basma onayı — kazara ikinci tıklama yeni barkod doğurmasın */}
      <AlertDialog open={onayAcik} onOpenChange={setOnayAcik}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tekrar bas?</AlertDialogTitle>
            <AlertDialogDescription>
              Yeni (kalıcı) barkod numarası üretilecek. Devam edilsin mi?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={diyaloguAc}>Devam</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
