'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Ban,
  Check,
  Delete,
  HelpCircle,
  Loader2,
  MapPin,
  PackageCheck,
  PackageX,
  RefreshCw,
  RotateCcw,
  Scale,
  ScanLine,
  Search,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useScanner } from '@/lib/depo/use-scanner'
import { barkodIdAday, parseEtiket } from '@/lib/depo/etiket-parse'
import { TERMINAL_ACCENT } from '../../_shared'
import type { BekleyenIs, FifoKaynak, IsEmriBaslik, ToplamaSatiri } from '@/lib/ifs/tuketim'

type KaynakTipi = 'FIFO' | 'REZERV'
type ToplamaSatirDetay = ToplamaSatiri & { fifo: FifoKaynak[]; stokYok: boolean; kaynakTipi: KaynakTipi }
type KartDurum = 'isleniyor' | 'ok' | 'hata'
type SonCikisSatir = { miktar: number; birim: string; lokasyonAdi: string }

// Sapma sebepleri — zorunlu seçim. `key` hem ID hem log/özet metnidir.
const SEBEPLER = [
  { key: 'Kutu hasarlı', Icon: PackageX },
  { key: 'Rafa erişilemiyor', Icon: Ban },
  { key: 'Kutuda miktar yetersiz', Icon: Scale },
  { key: 'Diğer', Icon: HelpCircle },
] as const

const EPS = 1e-9
const BEKLEYEN_BOYUT = 25

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return y && m && d ? `${d}.${m}.${y}` : iso
}
const normLoc = (x: string) => x.trim().toLocaleLowerCase('tr')

// /topla response kirilim'ini kalıcı 'nereden çıktı' satırlarına çevirir (loc→ad, fifo'dan).
function kirilimToSon(
  kirilim: { locationNo?: string; qtyAssigned?: number }[] | undefined,
  fifo: FifoKaynak[],
  birim: string,
  yedek: { miktar: number; lokasyonAdi: string },
): SonCikisSatir[] {
  const ad = (loc: string) => fifo.find((f) => f.locationNo === loc)?.lokasyonAdi ?? loc
  const kir = kirilim ?? []
  if (kir.length) return kir.map((k) => ({ miktar: Number(k.qtyAssigned) || 0, birim, lokasyonAdi: ad(String(k.locationNo ?? '')) }))
  return [{ miktar: yedek.miktar, birim, lokasyonAdi: yedek.lokasyonAdi }]
}

export function MalzemeToplamaClient() {
  const router = useRouter()
  const [step, setStep] = useState<'IS_EMRI' | 'LISTE' | 'TEYIT'>('IS_EMRI')
  const [baslik, setBaslik] = useState<IsEmriBaslik | null>(null)
  const [satirlar, setSatirlar] = useState<ToplamaSatirDetay[]>([])
  const [loading, setLoading] = useState(false)

  // Bekleyen işler listesi (IS_EMRI) — sayfalı + aramalı + kalıcı 'nereden çıktı' (B1).
  const [bekleyen, setBekleyen] = useState<BekleyenIs[] | null>(null)
  const [bekleyenLoading, setBekleyenLoading] = useState(false)
  const [bekleyenToplam, setBekleyenToplam] = useState(0)
  const [bekleyenSayfa, setBekleyenSayfa] = useState(0)
  const [dahaYukleniyor, setDahaYukleniyor] = useState(false)
  const [arama, setArama] = useState('')
  // Malzeme okutma (EL-8c): >1 iş için seçim listesi + LISTE'de vurgulanacak parça.
  const [malzemeIsler, setMalzemeIsler] = useState<BekleyenIs[] | null>(null)
  const [arananPart, setArananPart] = useState('')
  const [vurguPart, setVurguPart] = useState<string | null>(null)
  const [sonCikis, setSonCikis] = useState<Record<number, SonCikisSatir[]>>({})

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

  // Okut-doldur (LISTE) — sıralı yazma kuyruğu + kart durumları + geri bildirim.
  const [kuyruk, setKuyruk] = useState<string[]>([])
  const [isleniyor, setIsleniyor] = useState(false)
  const [kartDurum, setKartDurum] = useState<Record<number, KartDurum>>({})
  const [info, setInfo] = useState<string | null>(null)
  const [infoKey, setInfoKey] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const [toastKey, setToastKey] = useState(0)
  const satirlarRef = useRef<ToplamaSatirDetay[]>([])
  const baslikRef = useRef<IsEmriBaslik | null>(null)
  const kuyrukRef = useRef<string[]>([])
  const isleniyorRef = useRef(false)
  useEffect(() => { satirlarRef.current = satirlar }, [satirlar])
  useEffect(() => { baslikRef.current = baslik }, [baslik])

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

  const showInfo = useCallback((msg: string) => {
    setInfo(msg)
    setInfoKey((k) => k + 1)
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(80)
  }, [])
  useEffect(() => {
    if (!info) return
    const t = setTimeout(() => setInfo(null), 2500)
    return () => clearTimeout(t)
  }, [infoKey, info])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setToastKey((k) => k + 1)
  }, [])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2000)
    return () => clearTimeout(t)
  }, [toastKey, toast])
  // Malzemeden açılan kalemin 2sn vurgusu.
  useEffect(() => {
    if (!vurguPart) return
    const t = setTimeout(() => setVurguPart(null), 2000)
    return () => clearTimeout(t)
  }, [vurguPart])

  const isEmriOkut = useCallback(
    async (ham: string, opts?: { sessiz?: boolean; vurgu?: string }): Promise<boolean> => {
      const v = ham.trim()
      if (!v) return false
      setLoading(true)
      try {
        const res = await fetch(`/api/depo/toplama/${encodeURIComponent(v)}`)
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok) {
          if (!opts?.sessiz) showError(data?.error ?? `İş emri bulunamadı: ${v}`)
          return false
        }
        const yeniBaslik = data.baslik as IsEmriBaslik
        // Farklı emre geçiliyorsa 'nereden çıktı' kırılımını temizle (aynı emirde koru).
        if (yeniBaslik.orderNo !== baslikRef.current?.orderNo) setSonCikis({})
        setBaslik(yeniBaslik)
        setSatirlar((data.satirlar ?? []) as ToplamaSatirDetay[])
        // Okut-doldur durumunu sıfırla.
        setKartDurum({})
        kuyrukRef.current = []
        setKuyruk([])
        isleniyorRef.current = false
        setIsleniyor(false)
        setMalzemeIsler(null) // malzeme seçim modundan çık
        setVurguPart(opts?.vurgu ?? null)
        setStep('LISTE')
        return true
      } catch {
        if (!opts?.sessiz) showError('Bağlantı hatası — tekrar deneyin')
        return false
      } finally {
        setLoading(false)
      }
    },
    [showError],
  )

  // Salt-sayısal okuma → IFS barkod_id çöz (partNo + varsa lot). Çözülemezse null.
  const barkodKimligiGetir = useCallback(async (id: number): Promise<{ partNo: string; lot?: string } | null> => {
    try {
      const res = await fetch(`/api/depo/barkod/${id}`)
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok && data.kimlik?.partNo) {
        const k = data.kimlik
        return { partNo: String(k.partNo), lot: k.lotBatchNo && k.lotBatchNo !== '*' ? String(k.lotBatchNo) : undefined }
      }
      return null
    } catch {
      return null
    }
  }, [])

  // Bir kodu giriş ekranında çöz: önce iş emri, olmazsa MALZEME → bekleyen işler.
  const malzemeIsleriGetir = useCallback(
    async (partNo: string): Promise<BekleyenIs[] | null> => {
      try {
        const res = await fetch(`/api/depo/toplama-bekleyen?part=${encodeURIComponent(partNo)}`)
        const data = await res.json().catch(() => null)
        if (res.ok && data?.ok) return (data.isler ?? []) as BekleyenIs[]
        showError(data?.error ?? 'Malzeme sorgulanamadı')
        return null
      } catch {
        showError('Bağlantı hatası — tekrar deneyin')
        return null
      }
    },
    [showError],
  )
  const girisOkut = useCallback(
    async (ham: string) => {
      const v = ham.trim()
      if (!v) return
      // 1) İş emri olarak dene (sessiz — iş emri no da sayısal, öncelik iş emrinde).
      if (await isEmriOkut(v, { sessiz: true })) return
      // 2) Malzeme olarak çöz → bekleyen işler. Sayısalsa önce barkod_id.
      setLoading(true)
      const bid = barkodIdAday(v)
      const bk = bid ? await barkodKimligiGetir(bid) : null
      const p = parseEtiket(v)
      const partNo = bk ? bk.partNo : p.tip === 'MALZEME' && p.stokKodu ? p.stokKodu : v
      const isler = await malzemeIsleriGetir(partNo)
      setLoading(false)
      if (!isler) return
      if (isler.length === 0) {
        showError(`Bu malzemeyi bekleyen iş yok: ${partNo}`)
        return
      }
      if (isler.length === 1) {
        const is = isler[0]
        showToast(`İE ${is.orderNo} açılıyor · ${partNo} ${is.kalemKalan ?? ''} ${is.kalemBirim ?? ''}`.replace(/\s+/g, ' ').trim())
        await isEmriOkut(is.orderNo, { vurgu: partNo })
        return
      }
      setArananPart(partNo)
      setMalzemeIsler(isler)
    },
    [isEmriOkut, malzemeIsleriGetir, barkodKimligiGetir, showError, showToast],
  )

  // Bekleyen işler — sayfalı + aramalı yükleme. ekle=true → sonraki sayfayı ekler.
  const bekleyenYukle = useCallback(
    async (sayfa = 0, q = '', ekle = false) => {
      if (ekle) setDahaYukleniyor(true)
      else setBekleyenLoading(true)
      try {
        const params = new URLSearchParams({ sayfa: String(sayfa), boyut: String(BEKLEYEN_BOYUT) })
        if (q) params.set('q', q)
        const res = await fetch(`/api/depo/toplama-bekleyen?${params.toString()}`)
        const data = await res.json().catch(() => null)
        if (res.ok && data?.ok) {
          const yeni = (data.isler ?? []) as BekleyenIs[]
          setBekleyen((prev) => (ekle && prev ? [...prev, ...yeni] : yeni))
          setBekleyenToplam(Number(data.toplam) || 0)
          setBekleyenSayfa(sayfa)
        } else {
          if (!ekle) setBekleyen([])
          showError(data?.error ?? 'Bekleyen işler alınamadı')
        }
      } catch {
        if (!ekle) setBekleyen([])
        showError('Bağlantı hatası — tekrar deneyin')
      } finally {
        if (ekle) setDahaYukleniyor(false)
        else setBekleyenLoading(false)
      }
    },
    [showError],
  )
  // IS_EMRI'de sayfa 0'ı yükle; arama 400ms debounce (2 karakterden kısa → arama yok).
  useEffect(() => {
    if (step !== 'IS_EMRI') return
    const q = arama.trim()
    if (q.length === 1) return // <2 karakter → arama yapma, mevcut liste kalsın
    const gecikme = q ? 400 : 0
    const t = setTimeout(() => void bekleyenYukle(0, q, false), gecikme)
    return () => clearTimeout(t)
  }, [step, arama, bekleyenYukle])

  // Malzeme okutma (TEYIT) — beklenen parça ile eşleşme.
  const malzemeOkut = useCallback(
    async (ham: string) => {
      if (!secilen) return
      // Sayısal → önce barkod_id çöz (partNo eşleşmesi; lot teyidi 'doğru yer' katmanının ilk taşı).
      const bid = barkodIdAday(ham)
      if (bid) {
        const k = await barkodKimligiGetir(bid)
        if (k) {
          if (k.partNo === secilen.partNo) {
            setTeyitEslesti(true)
            // BONUS: barkodun lot'u beklenen FIFO lot(lar)ından farklıysa uyar (bloklamaz).
            // TODO (EL-9c): tam 'doğru yer' teyidi (lokasyon + lot) katmanı.
            if (k.lot && secilen.fifo.length && !secilen.fifo.some((f) => f.lotBatchNo === k.lot)) {
              showInfo(`Lot ${k.lot} — beklenen FIFO lotundan farklı`)
            }
          } else {
            showError(`Bu değil — ${secilen.partNo} olmalı`)
          }
          return
        }
        // barkod çözülemedi → aşağıda etiket/partNo denemesine düş.
      }
      const p = parseEtiket(ham)
      if (p.tip === 'MALZEME' && p.stokKodu === secilen.partNo) {
        setTeyitEslesti(true)
      } else {
        showError(`Bu değil — ${secilen.partNo} olmalı`)
      }
    },
    [secilen, showError, showInfo, barkodKimligiGetir],
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

  // Okut-doldur: tek kodu işle (parse → eşleştir → tam miktar otomatik topla).
  // satirlar/baslik ref'ten okunur (kuyruk döngüsünde taze kalsın diye).
  const islem = useCallback(
    async (kod: string) => {
      const p = parseEtiket(kod)
      if (p.tip !== 'MALZEME' || !p.stokKodu) {
        showError(`Bu iş emrinde yok: ${kod}`)
        return
      }
      const sat = satirlarRef.current
      const acik = sat.find((s) => s.kalan > 0 && s.partNo === p.stokKodu)
      if (!acik) {
        const bitmis = sat.find((s) => s.kalan === 0 && s.partNo === p.stokKodu)
        if (bitmis) showInfo(`Zaten toplandı: ${p.stokKodu}`)
        else showError(`Bu iş emrinde yok: ${p.stokKodu}`)
        return
      }
      const b = baslikRef.current
      if (!b) return
      // REZERV kaleminde otomatik miktar = rezerv miktarı (min(atanan,kalan)); değilse kalan.
      const otoMiktar = acik.kaynakTipi === 'REZERV' ? Math.min(acik.atanan, acik.kalan) : acik.kalan
      setKartDurum((m) => ({ ...m, [acik.lineItemNo]: 'isleniyor' }))
      try {
        const res = await fetch(`/api/depo/toplama/${encodeURIComponent(b.orderNo)}/topla`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            releaseNo: b.releaseNo,
            sequenceNo: b.sequenceNo,
            lineItemNo: acik.lineItemNo,
            miktar: otoMiktar,
          }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok) {
          setKartDurum((m) => ({ ...m, [acik.lineItemNo]: 'hata' }))
          showError(data?.error ?? 'Çıkış başarısız')
          return
        }
        const loc = data.kirilim?.[0]?.locationNo ?? acik.fifo[0]?.locationNo ?? '—'
        const yeniKalan = data.satir?.kalan ?? 0
        const yeniCikilan = data.satir?.qtyIssued ?? acik.gerekli
        const yeniAtanan = data.satir?.atanan ?? 0
        // Ref'i de senkron güncelle → döngüdeki sonraki okuma taze görsün.
        // Rezerv tükendiyse kaynakTipi FIFO'ya döner; kalem AÇIK kalır (kısmi ilerleme).
        const guncel = satirlarRef.current.map((s) =>
          s.lineItemNo === acik.lineItemNo
            ? { ...s, kalan: yeniKalan, cikilan: yeniCikilan, atanan: yeniAtanan, kaynakTipi: (yeniAtanan > 0 ? 'REZERV' : 'FIFO') as KaynakTipi }
            : s,
        )
        satirlarRef.current = guncel
        setSatirlar(guncel)
        // Kalıcı 'nereden çıktı' kırılımı (B1).
        const locAd = acik.fifo.find((f) => f.locationNo === loc)?.lokasyonAdi ?? loc
        const son = kirilimToSon(data.kirilim, acik.fifo, acik.birim, { miktar: otoMiktar, lokasyonAdi: locAd })
        setSonCikis((m) => ({ ...m, [acik.lineItemNo]: son }))
        setKartDurum((m) => ({ ...m, [acik.lineItemNo]: 'ok' }))
        showToast(`✓ ${acik.partNo} · ${otoMiktar} ${acik.birim} · ${locAd}`)
      } catch {
        setKartDurum((m) => ({ ...m, [acik.lineItemNo]: 'hata' }))
        showError('Bağlantı hatası — tekrar deneyin')
      }
    },
    [showError, showInfo, showToast],
  )

  // Kuyruğu SIRAYLA boşalt (paralel değil — aynı emirde ETag/yarış riski).
  const drain = useCallback(async () => {
    if (isleniyorRef.current) return
    isleniyorRef.current = true
    setIsleniyor(true)
    while (kuyrukRef.current.length > 0) {
      const kod = kuyrukRef.current[0]
      await islem(kod)
      kuyrukRef.current = kuyrukRef.current.slice(1)
      setKuyruk([...kuyrukRef.current])
    }
    isleniyorRef.current = false
    setIsleniyor(false)
  }, [islem])

  const listeScanEkle = useCallback(
    (kod: string) => {
      const v = kod.trim()
      if (!v) return
      kuyrukRef.current = [...kuyrukRef.current, v]
      setKuyruk([...kuyrukRef.current])
      void drain()
    },
    [drain],
  )

  const handleScan = useCallback(
    (v: string) => {
      if (step === 'IS_EMRI') return void girisOkut(v)
      if (step === 'LISTE') return listeScanEkle(v)
      if (step === 'TEYIT' && sapmaAcik && !sapmaSecili) return void rafOkut(v)
      if (step === 'TEYIT') return void malzemeOkut(v)
    },
    [step, sapmaAcik, sapmaSecili, girisOkut, listeScanEkle, malzemeOkut, rafOkut],
  )

  const tumBitti = step === 'LISTE' && satirlar.length > 0 && satirlar.every((s) => s.kalan === 0)
  const scanAktif =
    (step === 'IS_EMRI' ||
      (step === 'LISTE' && !tumBitti) ||
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
    // REZERV kaleminde varsayılan = rezerv miktarı (min(atanan,kalan)); değilse kalan.
    const varsayilan = s.kaynakTipi === 'REZERV' ? Math.min(s.atanan, s.kalan) : s.kalan
    setTeyitMiktar(String(varsayilan).replace('.', ','))
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
      setBekleyen(null) // dönüşte tazele
      setArama('')
      setMalzemeIsler(null)
      setVurguPart(null)
      setSonCikis({})
      return
    }
    router.push('/terminal/depo')
  }

  // Miktar tuş takımı (ondalık)
  const miktarNum = Number((teyitMiktar || '0').replace(',', '.'))
  const kalan = secilen?.kalan ?? 0
  const atanan = secilen?.atanan ?? 0
  // REZERV kaleminde 'tam' = rezerv miktarı (min(atanan, kalan)); üst sınır da budur.
  const rezervli = secilen?.kaynakTipi === 'REZERV'
  const ustSinir = rezervli ? Math.min(atanan, kalan) : kalan
  const miktarGecerli = miktarNum > EPS && miktarNum <= ustSinir + EPS
  const tamMiktar = Math.abs(miktarNum - ustSinir) < EPS && miktarNum > 0
  const kismi = miktarGecerli && !tamMiktar
  // Rezervli kalemde GERÇEK kısmi (miktar < rezerv) kilitli; miktar === rezerv ise TAM sayılır.
  const kismiKilit = rezervli && kismi
  const rezervAsim = rezervli && miktarNum > ustSinir + EPS
  // Sapma: seçilen kaynağın güncel mevcudu miktarı karşılıyor mu?
  const sapmaMevcut = sapmaSecili?.mevcutMiktar ?? 0
  const sapmaMiktarAsim = !!sapmaSecili && miktarNum > sapmaMevcut + EPS
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
      // Kalıcı 'nereden çıktı' kırılımı (B1) — sapmada tek konum, aksi halde kirilim'den.
      const son: SonCikisSatir[] = sapmaOpt
        ? [{ miktar: miktarNum, birim: secilen.birim, lokasyonAdi: sapmaSecili?.lokasyonAdi ?? sapmaSecili?.locationNo ?? loc }]
        : kirilimToSon(data.kirilim, secilen.fifo, secilen.birim, {
            miktar: miktarNum,
            lokasyonAdi: secilen.fifo.find((f) => f.locationNo === loc)?.lokasyonAdi ?? loc,
          })
      setSonCikis((m) => ({ ...m, [secilen.lineItemNo]: son }))
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
      {!errorMsg && info && (
        <div className="absolute inset-x-0 top-0 z-20 mx-2 flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-base font-semibold text-white shadow-lg">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          {info}
        </div>
      )}
      {!errorMsg && !info && toast && (
        <div className="absolute inset-x-0 top-0 z-20 mx-2 flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white shadow-lg">
          <Check className="h-5 w-5 shrink-0" />
          {toast}
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
              {rezervli
                ? `${secilen.partNo} · ${secilen.kalan} ${secilen.birim} kalan · ${atanan} rezervli`
                : `${secilen.partNo} · ${secilen.kalan} ${secilen.birim}`}
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

      {/* AŞAMA 1 — okutma şeridi (kısayol) + Bekleyen İşler listesi */}
      {step === 'IS_EMRI' && !loading && (
        <div className="flex flex-col gap-3">
          {/* Okutma şeridi (kısayol) */}
          <div
            className="flex items-center gap-3 rounded-2xl border p-3"
            style={{ borderColor: TERMINAL_ACCENT, background: `${TERMINAL_ACCENT}0D` }}
          >
            <ScanLine className="h-6 w-6 shrink-0" style={{ color: TERMINAL_ACCENT }} />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-sm font-semibold" style={{ color: TERMINAL_ACCENT }}>İş emri VEYA malzeme etiketi okut</div>
              <div className="truncate text-xs text-muted-foreground">iş emri açılır ya da malzemeyi bekleyen iş bulunur</div>
            </div>
          </div>
          {manualOpen ? (
            <div className="flex w-full gap-2">
              <input
                autoFocus
                value={manualVal}
                onChange={(e) => setManualVal(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitManual()}
                placeholder="İş emri no ya da stok kodu"
                className="h-11 flex-1 rounded-xl border bg-background px-3 text-base outline-none focus:ring-1 focus:ring-ring"
              />
              <button type="button" onClick={submitManual} className="h-11 rounded-xl px-4 text-sm font-semibold text-white" style={{ background: TERMINAL_ACCENT }}>
                Getir
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setManualOpen(true)} className="self-center text-sm text-muted-foreground underline underline-offset-2">
              veya elle gir
            </button>
          )}

          {/* Malzeme okutuldu → birden çok iş: seçim listesi */}
          {malzemeIsler && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold" style={{ color: TERMINAL_ACCENT }}>
                Bu malzemeyi bekleyen {malzemeIsler.length} iş var
              </h2>
              <div className="-mt-1 text-xs text-muted-foreground">{arananPart}</div>
              {malzemeIsler.map((is) => (
                <BekleyenKart key={`${is.orderNo}-${is.releaseNo}-${is.sequenceNo}`} is={is} onSelect={() => void isEmriOkut(is.orderNo, { vurgu: arananPart })} />
              ))}
              <button
                type="button"
                onClick={() => { setMalzemeIsler(null); setArananPart('') }}
                className="self-center text-sm text-muted-foreground underline underline-offset-2"
              >
                Vazgeç — bekleyen listeye dön
              </button>
            </div>
          )}

          {!malzemeIsler && (<>
          {/* Bekleyen İşler başlığı + sayaç + yenile */}
          <div className="mt-1 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-baseline gap-2">
              <h2 className="text-sm font-semibold text-muted-foreground">Bekleyen İşler</h2>
              {bekleyen && bekleyen.length > 0 && (
                <span className="text-xs text-muted-foreground">{bekleyen.length} / {bekleyenToplam} iş gösteriliyor</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => void bekleyenYukle(0, arama.trim(), false)}
              disabled={bekleyenLoading}
              aria-label="Yenile"
              className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors active:bg-muted/70 disabled:opacity-40"
            >
              <RefreshCw className={cn('h-4 w-4', bekleyenLoading && 'animate-spin')} />
            </button>
          </div>

          {/* Arama — İE no veya ürün kodu (sunucu tarafı) */}
          <div className="flex items-center gap-2 rounded-xl border bg-background px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              placeholder="İE no veya ürün kodu ara"
              className="h-10 flex-1 bg-transparent text-base outline-none"
            />
            {arama && (
              <button type="button" onClick={() => setArama('')} aria-label="Temizle" className="shrink-0 text-muted-foreground active:opacity-60">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {bekleyen === null || bekleyenLoading ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-2xl border bg-muted/40" />
              ))}
            </div>
          ) : bekleyen.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              {arama.trim() ? `Eşleşen iş yok: ${arama.trim()}` : 'Bekleyen toplama işi yok'}
              <button type="button" onClick={() => void bekleyenYukle(0, arama.trim(), false)} className="flex items-center gap-1.5 text-sm underline underline-offset-2" style={{ color: TERMINAL_ACCENT }}>
                <RefreshCw className="h-4 w-4" /> Yenile
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {bekleyen.map((is) => (
                <BekleyenKart key={`${is.orderNo}-${is.releaseNo}-${is.sequenceNo}`} is={is} onSelect={() => void isEmriOkut(is.orderNo)} />
              ))}
              {(bekleyenSayfa + 1) * BEKLEYEN_BOYUT < bekleyenToplam && (
                <button
                  type="button"
                  onClick={() => void bekleyenYukle(bekleyenSayfa + 1, arama.trim(), true)}
                  disabled={dahaYukleniyor}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border text-sm font-semibold transition-colors active:bg-muted/70 disabled:opacity-50"
                  style={{ color: TERMINAL_ACCENT, borderColor: TERMINAL_ACCENT }}
                >
                  {dahaYukleniyor ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Daha fazla göster ({bekleyenToplam - (bekleyenSayfa + 1) * BEKLEYEN_BOYUT})
                </button>
              )}
            </div>
          )}
          </>)}
        </div>
      )}

      {/* AŞAMA 2 — liste (okut-doldur) */}
      {step === 'LISTE' && !loading && !tumBitti && (
        <div className="flex flex-col gap-3">
          {/* Sürekli okutma şeridi */}
          <div
            className="sticky top-0 z-10 flex items-center gap-3 rounded-2xl border p-3"
            style={{ borderColor: TERMINAL_ACCENT, background: `${TERMINAL_ACCENT}0D` }}
          >
            <ScanLine className="h-6 w-6 shrink-0" style={{ color: TERMINAL_ACCENT }} />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-sm font-semibold" style={{ color: TERMINAL_ACCENT }}>
                Malzeme etiketini okut
              </div>
              <div className="truncate text-xs text-muted-foreground">kalem otomatik toplanır</div>
            </div>
            {(isleniyor || kuyruk.length > 0) && (
              <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-medium" style={{ color: TERMINAL_ACCENT }}>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                işleniyor: {Math.max(kuyruk.length, isleniyor ? 1 : 0)}
              </span>
            )}
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
                Ekle
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setManualOpen(true)} className="self-center text-sm text-muted-foreground underline underline-offset-2">
              veya elle gir
            </button>
          )}

          {satirlar.length === 0 && (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Bu iş emrinde malzeme kalemi yok
            </div>
          )}
          {satirlar.map((s) => (
            <KalemKart key={s.lineItemNo} s={s} durum={kartDurum[s.lineItemNo]} sonCikis={sonCikis[s.lineItemNo]} vurgu={!!vurguPart && s.partNo === vurguPart} onSelect={() => kalemAc(s)} />
          ))}
        </div>
      )}

      {/* Tüm kalemler toplandı — tam-ekran özet */}
      {step === 'LISTE' && !loading && tumBitti && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <Check className="h-14 w-14" />
          </div>
          <div className="text-2xl font-semibold">İş emri toplandı</div>
          <div className="text-sm text-muted-foreground">
            İE {baslik?.orderNo} · {satirlar.length} kalem
          </div>
          <button
            type="button"
            onClick={() => {
              setStep('IS_EMRI')
              setBaslik(null)
              setSatirlar([])
              setKartDurum({})
              setErrorMsg(null)
              setManualOpen(false)
              setBekleyen(null) // tazele
              setArama('')
              setMalzemeIsler(null)
              setVurguPart(null)
              setSonCikis({})
            }}
            className="mt-2 flex min-h-14 items-center justify-center gap-2 rounded-2xl px-6 text-lg font-semibold text-white"
            style={{ background: TERMINAL_ACCENT }}
          >
            <RotateCcw className="h-5 w-5" />
            Yeni İş Emri
          </button>
        </div>
      )}

      {/* AŞAMA 3 — TEYIT (normal) */}
      {step === 'TEYIT' && secilen && !ozet && !sapmaAcik && (
        <div className="flex flex-1 flex-col gap-3">
          {/* Büyük GİT bloğu */}
          {ilkKaynak && (
            <div className="rounded-2xl border p-4" style={{ borderColor: TERMINAL_ACCENT }}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">GİT →</span>
                {rezervli && (
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ background: TERMINAL_ACCENT }}>
                    REZERVLİ
                  </span>
                )}
              </div>
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
                  rezervAsim && 'border-red-400',
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
                disabled={!miktarGecerli || kismiKilit || tamamlaniyor}
                className="mt-1 flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-lg font-semibold text-white transition-all hover:bg-emerald-700 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
              >
                {tamamlaniyor ? <Loader2 className="h-5 w-5 animate-spin" /> : <PackageCheck className="h-6 w-6" />}
                {tamamlaniyor ? 'IFS’e işleniyor…' : 'Topla ve Çık (IFS)'}
              </button>
              {rezervAsim ? (
                <p className="text-center text-xs font-medium text-red-600">
                  Rezervin {ustSinir} {secilen.birim} — fazlası için önce rezerv artırılmalı
                </p>
              ) : kismiKilit ? (
                <p className="text-center text-xs text-amber-700">Rezervli kalemde kısmi toplama yakında</p>
              ) : kismi ? (
                <p className="text-center text-xs text-muted-foreground">
                  Kısmi toplama: {teyitMiktar} / {kalan} {secilen.birim}
                </p>
              ) : null}

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
              <div className="truncate text-base font-semibold">
                {teyitMiktar || '0'} {secilen.birim} ·{' '}
                <span className="font-normal text-muted-foreground">farklı yerden</span>
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {secilen.partNo}
                {secilen.partAdi ? ` · ${secilen.partAdi}` : ''}
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

          {/* Raf-mevcut aşımı uyarısı */}
          {sapmaMiktarAsim && (
            <div className="flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Bu rafta yalnız {sapmaMevcut} {secilen.birim} var — miktarı düşür ya da başka raf seç
            </div>
          )}

          {/* c) Onay */}
          <button
            type="button"
            onClick={sapmaGonder}
            disabled={!sapmaSecili || !sapmaSebep || !miktarGecerli || sapmaMiktarAsim || tamamlaniyor}
            className="mt-1 flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-lg font-semibold text-white transition-all hover:bg-emerald-700 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
          >
            {tamamlaniyor ? <Loader2 className="h-5 w-5 animate-spin" /> : <PackageCheck className="h-6 w-6" />}
            {tamamlaniyor ? 'IFS’e işleniyor…' : 'Buradan Topla ve Çık'}
          </button>
          {kismi && !sapmaMiktarAsim && (
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

function SonCikisSatirlari({ sonCikis }: { sonCikis?: SonCikisSatir[] }) {
  if (!sonCikis?.length) return null
  return (
    <div className="mt-1 flex flex-col gap-0.5">
      {sonCikis.map((c, i) => (
        <div key={i} className="flex items-center gap-1 text-xs text-emerald-700">
          <Check className="h-3.5 w-3.5 shrink-0" />
          {c.miktar} {c.birim} · {c.lokasyonAdi}
        </div>
      ))}
    </div>
  )
}

function KalemKart({ s, durum, sonCikis, vurgu, onSelect }: { s: ToplamaSatirDetay; durum?: KartDurum; sonCikis?: SonCikisSatir[]; vurgu?: boolean; onSelect: () => void }) {
  if (s.kalan === 0) {
    return (
      <div className="flex min-h-16 items-start gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-800">
        <Check className="h-6 w-6 shrink-0 text-emerald-600" />
        <div className="min-w-0">
          <div className="font-semibold">{s.partNo}</div>
          <div className="text-sm">{s.gerekli} {s.birim} · toplandı</div>
          <SonCikisSatirlari sonCikis={sonCikis} />
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
  const hata = durum === 'hata'
  const isleniyor = durum === 'isleniyor'
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (vurgu) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [vurgu])
  return (
    <button
      ref={ref}
      type="button"
      onClick={onSelect}
      aria-busy={isleniyor}
      className={cn(
        'flex w-full flex-col gap-2 rounded-2xl border bg-card p-4 text-left transition-opacity active:opacity-70',
        hata && 'border-red-400 bg-red-50',
        vurgu && 'animate-pulse ring-2 ring-offset-2 ring-[#1B4F72]',
      )}
      style={hata ? undefined : { borderColor: TERMINAL_ACCENT }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 font-semibold">{s.partNo}</span>
          {s.kaynakTipi === 'REZERV' && (
            <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: TERMINAL_ACCENT }}>
              REZERVLİ
            </span>
          )}
        </span>
        {isleniyor ? (
          <Loader2 className="h-5 w-5 shrink-0 animate-spin" style={{ color: TERMINAL_ACCENT }} />
        ) : (
          <span className="shrink-0 text-sm font-semibold" style={{ color: TERMINAL_ACCENT }}>
            {s.kalan} {s.birim}
          </span>
        )}
      </div>
      {s.partAdi && <div className="truncate text-xs text-muted-foreground">{s.partAdi}</div>}
      {s.kaynakTipi === 'REZERV' && (
        <div className="text-xs text-muted-foreground">
          {s.kalan} {s.birim} kalan · {s.atanan} {s.birim} rezervli
        </div>
      )}
      {s.cikilan > 0 && s.kalan > 0 && (
        <div className="text-xs font-medium text-amber-700">
          {s.cikilan}/{s.gerekli} {s.birim} çıkıldı
        </div>
      )}
      <SonCikisSatirlari sonCikis={sonCikis} />
      {hata && <div className="text-xs font-semibold text-red-700">Hata — dokun ve çöz</div>}
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

function BekleyenKart({ is, onSelect }: { is: BekleyenIs; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full flex-col gap-1 rounded-2xl border bg-card p-4 text-left transition-opacity active:opacity-70"
      style={{ borderColor: TERMINAL_ACCENT }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold">İE {is.orderNo}</div>
          <div className="truncate text-xs text-muted-foreground">{is.urunAdi}</div>
        </div>
        <span className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white" style={{ background: TERMINAL_ACCENT }}>
          {is.acikKalem} açık kalem
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
        {is.kalemKalan != null && (
          <span className="font-semibold" style={{ color: TERMINAL_ACCENT }}>
            bu malzemeden {is.kalemKalan} {is.kalemBirim ?? ''} kalan
          </span>
        )}
        {is.ihtiyacTarihi && <span className="text-muted-foreground">termin {fmtDate(is.ihtiyacTarihi)}</span>}
        {is.toplananKalem > 0 && (
          <span className="font-medium text-amber-700">{is.toplananKalem}/{is.kalemSayisi} kalem toplandı</span>
        )}
      </div>
    </button>
  )
}
