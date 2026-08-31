'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ZimmetTuru as PrismaZimmetTuru } from '@/generated/prisma'
import {
  DEFAULT_TESLIM_NOTU,
  varsayilanTeslimNotu as varsayilanTeslimNotuByEnum,
} from '@/lib/zimmet/teslim-notlari'
import {
  ZIMMET_TUR_SECENEKLERI,
  ZIMMET_SECENEK_TO_ENUM,
  YAZILIM_KOK_ADI,
  yazilimKaydi,
  ozelTurKaydi,
} from '@/lib/zimmet/tur'
import { zimmetEksikAlanlar } from '@/lib/zimmet/zorunlu-alanlar'

// Form seçenekleri + Türkçe→enum eşlemesi artık src/lib/zimmet/tur.ts'te -
// Liste ekranının istatistik kartlarıyla AYNI kaynak (tek yerden değişir,
// ikisi sapmaz). "Yazılım" → varsayılan DIGER + turDiger, ama "Office 365"
// özel durumu var (bkz. buildSubmitPayload + tur.ts yazilimKaydi).
//
// SABIT_TUR_SECENEKLERI: dropdown'a sabit gelen 6 tür (5 donanım + "Yazılım").
// "Yazılım" bir ara ZimmetTanim'a taşınıp sabit listeden çıkarılmıştı, ama bu
// DB'deki kök satırın (migration sonrası seed.sql ile eklenen) varlığına tür
// dropdown'unun tamamını bağımlı kılıyordu - seed atlanırsa "Yazılım" hiç
// seçilemiyor, yazılım zimmeti oluşturulamıyordu (Melih'in bulduğu kırılganlık).
// Geri sabit listeye alındı: her ortamda garanti görünür. Alt-dal (hangi
// yazılım) listesi için hâlâ gerçek bir DB kök id'sine ihtiyaç var - o artık
// hem GET /api/zimmet-formu/tanim'in kendi kendini onarmasıyla (bkz. o route)
// hem de burada garanti ediliyor; id bulunamazsa (ör. geçici hata) çağıran
// taraf (ZimmetFormuStep1.tsx, ZimmetListesi.tsx) serbest metne düşer, hata
// vermez. ZIMMET_TUR_TO_ENUM genişletildi: `string` indeksli - artık tür
// DB'den gelen (sabit olmayan) bir isim de olabildiği için (`tur in
// ZIMMET_TUR_TO_ENUM` ile ayrım yapılıyor).
export const SABIT_TUR_SECENEKLERI = ZIMMET_TUR_SECENEKLERI
export const ZIMMET_TUR_TO_ENUM: Record<string, string> = ZIMMET_SECENEK_TO_ENUM

// Verilen (UI) tür adı + alt-dal metninden NİHAİ enum + turDiger'ı türetir -
// sabit 5 donanım türü ise direkt enum eşlemesi, "Yazılım" ise yazilimKaydi
// (Office 365 istisnası dahil), DB'den gelen YENİ bir tür ise ozelTurKaydi
// ("TürAdı" veya "TürAdı · AltDal", bkz. tur.ts). Tek yerden - hem zorunlu
// alan kontrolü hem submit payload'u hem teslim notu önizlemesi BU fonksiyonu
// kullanır, biri unutulup diğeri unutulmasın.
export function turVeTurDigerNihai(
  tur: string,
  altDalMetni: string
): { enumTur: string; turDigerNihai: string | null } {
  if (!tur) return { enumTur: '', turDigerNihai: null }
  if (tur === YAZILIM_KOK_ADI) {
    const y = yazilimKaydi(altDalMetni)
    return { enumTur: y.tur, turDigerNihai: y.turDiger }
  }
  if (tur in ZIMMET_TUR_TO_ENUM) {
    return { enumTur: ZIMMET_TUR_TO_ENUM[tur], turDigerNihai: null }
  }
  const o = ozelTurKaydi(tur, altDalMetni)
  return { enumTur: o.tur, turDigerNihai: o.turDiger }
}

export interface PersonelHit {
  id: string
  name: string | null
  email: string
  department?: string | null
  jobTitle?: string | null
  // Sicil No — /api/users?source=db zaten döndürüyor (User.employeeId),
  // yeni bir alan/route değişikliği gerekmedi.
  employeeId?: string | null
}

export interface ZimmetFormuStep1Data {
  zimmetSahibiId: string
  departman: string
  unvan: string
  altZimmetSahibi: string
  // Sabit 5 donanım türünden biri, "Yazılım", ya da ZimmetTanim'da tanımlı
  // YENİ bir tür adı olabilir - artık kapalı bir union değil (bkz.
  // TanimCombobox.tsx).
  tur: string
  // Alt-dal seçimi (yazılım adı VEYA yeni bir türün alt-dalı) - nihai
  // enum+turDiger'a turVeTurDigerNihai() ile dönüştürülür.
  turDiger: string
  marka: string
  model: string
  seriNumarasi: string
  aciklama: string
  ozellik: string
  macAdresi: string
  pcAdi: string
  imeiNumarasi: string
}

// Zimmet Sahibi ve Tür HER türde sabit zorunlu (burada). Türe göre DEĞİŞEN
// ek zorunlu alanlar (Seri No/Özellik/IMEI/Hangi yazılım) artık
// src/lib/zimmet/zorunlu-alanlar.ts'te (zimmetEksikAlanlar) - sunucu
// tarafındaki (route.ts, preview-pdf/route.ts, [id]/route.ts PATCH) kontrolle
// AYNI tablo, tek yerden değişir, kontrol çakışmaz/eksik kalmaz. Adım 1→2
// geçişi, önizleme ve imzalama butonları HEPSİ bu tek fonksiyondan geçer.
const ZORUNLU_ALAN_ETIKETLERI = {
  zimmetSahibiId: 'Zimmet sahibi',
  tur: 'Tür',
} as const

export function zimmetEksikZorunluAlanlar(step1: ZimmetFormuStep1Data): string[] {
  const eksik: string[] = []
  if (!step1.zimmetSahibiId.trim()) eksik.push(ZORUNLU_ALAN_ETIKETLERI.zimmetSahibiId)
  if (!step1.tur) eksik.push(ZORUNLU_ALAN_ETIKETLERI.tur)
  // zimmetEksikAlanlar, DIGER için turDiger'ın (nihai) dolu olmasını arıyor -
  // custom bir tür için alt-dal boş bırakılsa bile nihai turDiger EN AZINDAN
  // tür adını içerir (bkz. ozelTurKaydi), yani bu kontrol yanlışlıkla
  // "alt-dal zorunlu" gibi davranmaz - custom türde alt-dal gerçekten
  // opsiyonel kalır.
  const { enumTur, turDigerNihai } = turVeTurDigerNihai(step1.tur, step1.turDiger)
  eksik.push(...zimmetEksikAlanlar(enumTur, { ...step1, turDiger: turDigerNihai ?? '' }))
  return eksik
}

export function zimmetZorunluAlanlarDolu(step1: ZimmetFormuStep1Data): boolean {
  return zimmetEksikZorunluAlanlar(step1).length === 0
}

const INITIAL_STEP1: ZimmetFormuStep1Data = {
  zimmetSahibiId: '',
  departman: '',
  unvan: '',
  altZimmetSahibi: '',
  tur: '',
  turDiger: '',
  marka: '',
  model: '',
  seriNumarasi: '',
  aciklama: '',
  ozellik: '',
  macAdresi: '',
  pcAdi: '',
  imeiNumarasi: '',
}

export const ZIMMET_DURUM_OPTIONS = ['Aktif', 'Pasif'] as const
export type ZimmetDurumu = (typeof ZIMMET_DURUM_OPTIONS)[number]

const ZIMMET_DURUM_TO_ENUM: Record<ZimmetDurumu, string> = {
  Aktif: 'AKTIF',
  Pasif: 'PASIF',
}

export interface ZimmetFormuStep2Data {
  verilisTarihi: string
  durum: ZimmetDurumu
  teslimNotu: string
}

// Tür seçilince "Teslim koşulları" alanını otomatik dolduran standart metinler
// artık src/lib/zimmet/teslim-notlari.ts'te - sunucu tarafı (pdf/route.ts,
// onayla/imzala sayfaları) ile AYNI metinleri paylaşabilmek için oraya taşındı
// (bkz. o dosyadaki not: Syteline devri kayıtları hiç teslimNotu almıyordu).
// Kullanıcı metni elle değiştirirse bir sonraki tür değişiminde üzerine
// yazılmaz - bu davranış değişmedi.
// "Yazılım" seçiliyken hangi metnin (lisans mı, donanım mı) doğru olduğu
// turDiger'a bağlı - buildSubmitPayload'daki NİHAİ dönüşümle (yazilimKaydi)
// AYNI mantık burada da kullanılıyor, ör. "Office 365" seçilince canlı önizleme
// de OFFICE_365'in lisans metnini göstersin (DB'ye kaydedilmeden önce bile).
function varsayilanTeslimNotu(tur: string, turDiger: string): string {
  if (!tur) return DEFAULT_TESLIM_NOTU
  const { enumTur, turDigerNihai } = turVeTurDigerNihai(tur, turDiger)
  return varsayilanTeslimNotuByEnum(enumTur as PrismaZimmetTuru, turDigerNihai)
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

const INITIAL_STEP2: ZimmetFormuStep2Data = {
  verilisTarihi: todayIsoDate(),
  durum: 'Aktif',
  teslimNotu: DEFAULT_TESLIM_NOTU,
}

export const ZIMMET_FORMU_STEP_TITLES = [
  'Zimmet bilgileri',
  'Teslim koşulları',
  'Önizleme',
  'Çıktı ve imza',
]

export const ZIMMET_FORMU_TOTAL_STEPS = ZIMMET_FORMU_STEP_TITLES.length

export type ZimmetFormuSubmitStatus = 'idle' | 'submitting' | 'success' | 'error'
export type ZimmetFormuPreviewStatus = 'idle' | 'loading' | 'error'

export function useZimmetFormu() {
  const [step, setStep] = useState(0)
  const [step1, setStep1] = useState<ZimmetFormuStep1Data>(INITIAL_STEP1)
  const [step2, setStep2] = useState<ZimmetFormuStep2Data>(INITIAL_STEP2)
  const [personelListesi, setPersonelListesi] = useState<PersonelHit[]>([])
  const [personelYukleniyor, setPersonelYukleniyor] = useState(true)
  const [submitStatus, setSubmitStatus] = useState<ZimmetFormuSubmitStatus>('idle')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [createdZimmetId, setCreatedZimmetId] = useState<string | null>(null)
  const [previewStatus, setPreviewStatus] = useState<ZimmetFormuPreviewStatus>('idle')
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [teslimEdenImzalandi, setTeslimEdenImzalandi] = useState(false)
  const [teslimEdenImzaTarihi, setTeslimEdenImzaTarihi] = useState('')
  const prevTurRef = useRef<string>('')
  const prevTurDigerRef = useRef<string>('')

  // Gerçek kullanıcı listesi — diğer modüllerin (örn. offboarding) kullandığı /api/users?source=db
  useEffect(() => {
    let cancelled = false
    setPersonelYukleniyor(true)
    fetch('/api/users?source=db')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: PersonelHit[]) => {
        if (!cancelled) setPersonelListesi(data)
      })
      .catch(() => {
        if (!cancelled) setPersonelListesi([])
      })
      .finally(() => {
        if (!cancelled) setPersonelYukleniyor(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const setStep1Field = useCallback(
    <K extends keyof ZimmetFormuStep1Data>(field: K, value: ZimmetFormuStep1Data[K]) => {
      setStep1((prev) => ({ ...prev, [field]: value }))
    },
    []
  )

  // Zimmet sahibi seçilince departman + ünvanı gerçek personel listesinden
  // otomatik doldurur. Bölüm değişirse, önceden seçilmiş alt zimmet sahibi
  // farklı bölümdeyse (Alt zimmet sahibi artık aynı bölümle sınırlı olduğu
  // için) temizlenir.
  const selectZimmetSahibi = useCallback(
    (personelId: string) => {
      const personel = personelListesi.find((p) => p.id === personelId)
      const yeniDepartman = personel?.department ?? ''
      setStep1((prev) => {
        const altSahibiPersonel = personelListesi.find((p) => p.name === prev.altZimmetSahibi)
        const altSahibiFarkliBolumde =
          prev.altZimmetSahibi && altSahibiPersonel?.department !== yeniDepartman
        return {
          ...prev,
          zimmetSahibiId: personelId,
          departman: yeniDepartman,
          unvan: personel?.jobTitle ?? '',
          altZimmetSahibi: altSahibiFarkliBolumde ? '' : prev.altZimmetSahibi,
        }
      })
    },
    [personelListesi]
  )

  // Tür değişince "Teslim koşulları" alanını standart metinle doldurur.
  // Kullanıcı metni elle değiştirmişse (önceki varsayılandan farklıysa) dokunmaz.
  // "Yazılım" VEYA yeni bir özel tür seçiliyken turDiger (alt-dal) değişimi de
  // izlenir - lisans/donanım metni ayrımı (Yazılım için) turDiger'a bağlı;
  // sabit 5 donanım türünde alt-dal hiç olmadığı için bu izleme gereksiz.
  useEffect(() => {
    const turDegisti = step1.tur !== prevTurRef.current
    const altDalIzleniyor =
      step1.tur === YAZILIM_KOK_ADI || (!!step1.tur && !(step1.tur in ZIMMET_TUR_TO_ENUM))
    const turDigerDegisti = altDalIzleniyor && step1.turDiger !== prevTurDigerRef.current
    if (!turDegisti && !turDigerDegisti) return
    const oncekiVarsayilan = varsayilanTeslimNotu(prevTurRef.current, prevTurDigerRef.current)
    setStep2((prev) =>
      prev.teslimNotu === '' || prev.teslimNotu === oncekiVarsayilan
        ? { ...prev, teslimNotu: varsayilanTeslimNotu(step1.tur, step1.turDiger) }
        : prev
    )
    prevTurRef.current = step1.tur
    prevTurDigerRef.current = step1.turDiger
  }, [step1.tur, step1.turDiger])

  const setStep2Field = useCallback(
    <K extends keyof ZimmetFormuStep2Data>(field: K, value: ZimmetFormuStep2Data[K]) => {
      setStep2((prev) => ({ ...prev, [field]: value }))
    },
    []
  )

  const goToStep = useCallback((target: number) => {
    setStep(Math.min(Math.max(target, 0), ZIMMET_FORMU_TOTAL_STEPS - 1))
  }, [])

  const nextStep = useCallback(() => {
    setStep((s) => Math.min(s + 1, ZIMMET_FORMU_TOTAL_STEPS - 1))
  }, [])

  const prevStep = useCallback(() => {
    setStep((s) => Math.max(s - 1, 0))
  }, [])

  const imzala = useCallback(() => {
    setTeslimEdenImzalandi(true)
    setTeslimEdenImzaTarihi(new Date().toISOString())
  }, [])

  // handleSubmit ve previewPdf AYNI gövdeyi gönderir — tek yerden üretilir.
  // Tür + alt-dal'ın NİHAİ enum/turDiger hali turVeTurDigerNihai()'den geçer -
  // "Yazılım" için Office 365 istisnası (OFFICE_365 + turDiger:null), YENİ bir
  // özel tür için "TürAdı[· AltDal]" (bkz. tur.ts).
  const buildSubmitPayload = useCallback(() => {
    const { enumTur, turDigerNihai } = turVeTurDigerNihai(step1.tur, step1.turDiger)
    return {
      zimmetSahibiId: step1.zimmetSahibiId,
      altZimmetSahibi: step1.altZimmetSahibi,
      departman: step1.departman,
      tur: enumTur,
      turDiger: turDigerNihai ?? '',
      marka: step1.marka,
      model: step1.model,
      seriNumarasi: step1.seriNumarasi,
      aciklama: step1.aciklama,
      ozellik: step1.ozellik,
      macAdresi: step1.macAdresi,
      pcAdi: step1.pcAdi,
      imeiNumarasi: step1.imeiNumarasi,
      verilisTarihi: step2.verilisTarihi,
      cihazDurumu: ZIMMET_DURUM_TO_ENUM[step2.durum],
      teslimNotu: step2.teslimNotu,
      teslimEdenImzalandi,
      teslimEdenImzaTarihi,
    }
  }, [step1, step2, teslimEdenImzalandi, teslimEdenImzaTarihi])

  const handleSubmit = useCallback(async () => {
    setSubmitStatus('submitting')
    setSubmitError(null)
    try {
      const res = await fetch('/api/zimmet-formu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildSubmitPayload()),
      })

      const data = await res.json().catch(() => ({}) as { error?: string; id?: string })

      if (!res.ok) {
        throw new Error(data.error || 'Form kaydedilemedi')
      }

      setCreatedZimmetId(data.id ?? null)
      setSubmitStatus('success')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Form kaydedilemedi')
      setSubmitStatus('error')
    }
  }, [buildSubmitPayload])

  // Taslak PDF önizleme — kaydetmez, yeni sekmede PDF açar.
  //
  // Sekme, tıklama anında SENKRON açılıyor (await'lerden ÖNCE) - fetch/blob
  // bittikten sonra window.open() çağırmak çoğu tarayıcıda "user activation"
  // süresi dolmuş sayılıp sessizce (hatasız, görünür bir belirti olmadan)
  // engelleniyordu. Boş sekme kullanıcı jesti sayıldığı için hemen açılıyor,
  // içeriği (blob URL) hazır olunca aynı sekmeye yazılıyor.
  const previewPdf = useCallback(async () => {
    setPreviewStatus('loading')
    setPreviewError(null)
    const yeniSekme = window.open('', '_blank')
    try {
      const res = await fetch('/api/zimmet-formu/preview-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildSubmitPayload()),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string })
        throw new Error(data.error || 'Önizleme oluşturulamadı')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      if (yeniSekme) {
        yeniSekme.location.href = url
      } else {
        // Senkron açma da engellenmişse (çok sıkı popup ayarı) - son çare.
        window.open(url, '_blank')
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
      setPreviewStatus('idle')
    } catch (err) {
      yeniSekme?.close()
      setPreviewError(err instanceof Error ? err.message : 'Önizleme oluşturulamadı')
      setPreviewStatus('error')
    }
  }, [buildSubmitPayload])

  return {
    step,
    totalSteps: ZIMMET_FORMU_TOTAL_STEPS,
    stepTitle: ZIMMET_FORMU_STEP_TITLES[step],
    step1,
    setStep1Field,
    selectZimmetSahibi,
    step2,
    setStep2Field,
    personelListesi,
    personelYukleniyor,
    goToStep,
    nextStep,
    prevStep,
    handleSubmit,
    submitStatus,
    submitError,
    createdZimmetId,
    previewPdf,
    previewStatus,
    previewError,
    imzala,
    teslimEdenImzalandi,
    teslimEdenImzaTarihi,
  }
}
