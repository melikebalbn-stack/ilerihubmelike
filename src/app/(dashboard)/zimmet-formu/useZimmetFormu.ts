'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export const ZIMMET_TUR_OPTIONS = [
  'Notebook Bilgisayar',
  'Desktop Bilgisayar',
  'Cep Telefonu',
  'El Terminali',
  'Yazıcı',
  'Office 365',
  'Diğer',
] as const

export type ZimmetTuru = (typeof ZIMMET_TUR_OPTIONS)[number]

// Backend (Prisma enum) karşılıkları — UI'daki Türkçe etiketler değişmeden kalır.
// "Yazıcı" için Prisma ZimmetTuru enum'unda karşılık YOK (şemaya dokunulmuyor,
// bkz. görev notu) — "Diğer" ile aynı DIGER kovasına düşer. Gerçek kayıtta
// turGosterim mantığı (tur===DIGER ? turDiger : ...) zaten bunu "Yazıcı" olarak
// göstermeye hazır; turDiger'ın ayrıca doldurulması gerekir (bkz. buildSubmitPayload).
const ZIMMET_TUR_TO_ENUM: Record<ZimmetTuru, string> = {
  'Notebook Bilgisayar': 'NOTEBOOK_BILGISAYAR',
  'Desktop Bilgisayar': 'DESKTOP_BILGISAYAR',
  'Cep Telefonu': 'CEP_TELEFONU',
  'El Terminali': 'EL_TERMINALI',
  Yazıcı: 'DIGER',
  'Office 365': 'OFFICE_365',
  Diğer: 'DIGER',
}

export interface PersonelHit {
  id: string
  name: string | null
  email: string
  department?: string | null
}

export interface ZimmetFormuStep1Data {
  zimmetSahibiId: string
  departman: string
  altZimmetSahibi: string
  tur: ZimmetTuru | ''
  turDiger: string
  marka: string
  model: string
  seriNumarasi: string
  aciklama: string
  ozellik: string
  ram: string
  ipAdresi: string
  parcaNo: string
  lisansBaslangic: string
  lisansBitis: string
  macAdresi: string
  pcAdi: string
  imeiNumarasi: string
}

const INITIAL_STEP1: ZimmetFormuStep1Data = {
  zimmetSahibiId: '',
  departman: '',
  altZimmetSahibi: '',
  tur: '',
  turDiger: '',
  marka: '',
  model: '',
  seriNumarasi: '',
  aciklama: '',
  ozellik: '',
  ram: '',
  ipAdresi: '',
  parcaNo: '',
  lisansBaslangic: '',
  lisansBitis: '',
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

const DEFAULT_TESLIM_NOTU =
  'Cihaz hasarsız teslim edilmiştir, kullanım kurallarına uyulacaktır.'

// Tür seçilince "Teslim koşulları" alanını otomatik dolduran standart metinler.
// Kullanıcı metni elle değiştirirse bir sonraki tür değişiminde üzerine yazılmaz.
const ZIMMET_TESLIM_NOTLARI: Partial<Record<string, string>> = {
  'Notebook Bilgisayar': `Markası, modeli, kullanıcı tanımlı programları liste halinde ve ekipmanları işaretli olarak yazılı olan bir (1) adet Notebook bilgisayar eksiksiz ve sağlam olarak teslim edilmiştir.

İlgili bilgisayar bilgi teknolojileri departmanı tarafından tarafınıza teslim edildikten sonra;

- Bilgi teknolojileri tarafından onaysız veya habersiz olarak yüklenen yazılımlarda 5864 nolu Fikir ve Sanat Eserleri kanunun gereğince,
- Mail msn gibi iletişim programları, Internet forumları, haber yorumları gibi benzer iletişim araçları ile hakaret ve sövme cürümlerinde, yasadışı yayınlarda TCK 125-200-426-427-480-490. Maddeleri gereğince,
- Şirket içi veya şirket dışındaki bilgisayar sistemlerini ve servislerini yetkiniz dışında erişim ve dinleme halinde TCK 525. Madde gereğince;
- Amaç dışı kullanımlarda ve ilgili bilgisayarın (kullanıcı hatasından kaynaklanmayan donanım arızaları haricinde) zarar görmesi durumunda;

İş bu maddelerde yazılı kanun ve durumların ihlali halinde tüm maddi, hukuki ve cezai sorumluluk teslim edilen kullanıcıya aittir. Bu sebeple şirketin uğrayacağı her türlü zararın teslim edilen kullanıcı tarafından tazmin edileceği kayıtsız şartsız kabul ve taahhüt edilmiştir.

Teslim edilen bilgisayar satılamaz, takas edilemez ve bir başka kullanıcıya devredilemez. Bilgisayarlarda lisansı olmayan hiçbir yazılım ve donanımın bulunmadığı kontrol edilerek teslim edilmiştir.`,

  'Desktop Bilgisayar': `Markası, modeli, kullanıcı tanımlı programları liste halinde ve ekipmanları işaretli olarak yazılı olan bir (1) adet Desktop bilgisayar eksiksiz ve sağlam olarak teslim edilmiştir.

İlgili bilgisayar bilgi teknolojileri departmanı tarafından tarafınıza teslim edildikten sonra;

- Bilgi teknolojileri tarafından onaysız veya habersiz olarak yüklenen yazılımlarda 5864 nolu Fikir ve Sanat Eserleri kanunun gereğince,
- Mail msn gibi iletişim programları, Internet forumları, haber yorumları gibi benzer iletişim araçları ile hakaret ve sövme cürümlerinde, yasadışı yayınlarda TCK 125-200-426-427-480-490. Maddeleri gereğince,
- Şirket içi veya şirket dışındaki bilgisayar sistemlerini ve servislerini yetkiniz dışında erişim ve dinleme halinde TCK 525. Madde gereğince;
- Amaç dışı kullanımlarda ve ilgili bilgisayarın (kullanıcı hatasından kaynaklanmayan donanım arızaları haricinde) zarar görmesi durumunda;

İş bu maddelerde yazılı kanun ve durumların ihlali halinde tüm maddi, hukuki ve cezai sorumluluk teslim edilen kullanıcıya aittir. Bu sebeple şirketin uğrayacağı her türlü zararın teslim edilen kullanıcı tarafından tazmin edileceği kayıtsız şartsız kabul ve taahhüt edilmiştir.

Teslim edilen bilgisayar satılamaz, takas edilemez ve bir başka kullanıcıya devredilemez. Bilgisayarlarda lisansı olmayan hiçbir yazılım ve donanımın bulunmadığı kontrol edilerek teslim edilmiştir.`,

  'Cep Telefonu': `1-) Aşağıda marka ve modeli yazılı cep telefonu, batarya ve şarj aleti, hasarsız ve tam olarak teslim edilmiştir.

2-) İş bu belge gereği bu cep telefonu satılmaz, kiralanmaz veya takas edilmez.

3-) Bu telefon ve ekipmanlarının minimum kullanma süresi 3 yıldır. Bu süreden önce üretici firma tarafından belirtilen garanti şartları dışında kalan durumlarda, oluşabilecek maddi ödemelerden kullanıcı sorumludur. ILERI GROUP bu süre içerisinde kullanıcı kaynaklı arızalanan telefonları yenilemekle mükellef değildir.

4-) Kullanıcıya teslim edilen telefon hattında, aşağıda belirtilen dakika ve data aşımı gerçekleşmesi halinde detaylı fatura incelenir. İş dışındaki kullanım tespitlerinde aşım bedeli kullanıcıdan tahsil edilecektir.`,

  'El Terminali': `Tanımı ve özellikleri belirtilen endüstriyel el terminali birim sorumlusu olarak tarafınıza eksiksiz ve sağlam olarak teslim edilmiştir. Teslim edilen ürünler satılamaz, takas edilemez ve bir başka kullanıcıya devir edilemez. Bu ekipmanların minimum kullanım süresi 5 yıldır. Bu süreden önce üretici firma tarafından belirtilen garanti şartları dışında kalan durumlarda, oluşabilecek maddi ödemelerden kullanıcı sorumludur.

- El terminali veya ekipmanları üzerinde oluşabilecek hasar ve arızaları önce birim sorumlusuna, sonrasında Bilgi Teknolojileri departmanına bildirmekle sorumlusunuzdur.
- Hasar ve arıza bildirimi yapılmayan el terminalinin tespit edilmesi durumunda ilgili teknik servis raporuna göre belirlenen bedel, hasar şartları ağır ise, el terminalinin o güne ait sıfır cihaz bedeli zimmetlenen tutanak sahibinden tahsil edilir.
- İşten ayrılma, yıllık izin gibi durumlarda tutanak sahibi el terminalini Bilgi Teknolojileri bölümüne teslim etmek zorundadır.
- Bu sebeplerle şirketin uğrayacağı her türlü zararın teslim edilen kullanıcı tarafından tazmin edileceği kayıtsız şartsız kabul ve taahhüt edilmiştir.
- Birim sorumlusu yukarıda yazılı tüm şartları kabul etmiş sayılmakta olup ihlal durumlarında 5237 sayılı T.C.K. 151-153. maddelerine istinaden tüm sorumlulukları kabul etmiş sayılmaktadır.`,

  'Yazıcı': `Markası, modeli, IP adresi liste halinde ve ekipmanları işaretli olarak yazılı olan bir (1) adet Yazıcı eksiksiz ve sağlam olarak teslim edilmiştir.

İlgili yazıcı bilgi teknolojileri departmanı tarafından tarafınıza teslim edildikten sonra;

- Bilgi teknolojileri tarafından onaysız veya habersiz olarak yüklenen yazılımlarda 5864 nolu Fikir ve Sanat Eserleri kanunun gereğince,
- Mail msn gibi iletişim programları, Internet forumları, haber yorumları gibi benzer iletişim araçları ile hakaret ve sövme cürümlerinde, yasadışı yayınlarda TCK 125-200-426-427-480-490. Maddeleri gereğince,
- Şirket içi veya şirket dışındaki bilgisayar ve yazıcı sistemlerini ve servislerini yetkiniz dışında erişim ve dinleme halinde TCK 525. Madde gereğince;
- Amaç dışı kullanımlarda ve ilgili yazıcının (kullanıcı hatasından kaynaklanmayan donanım arızaları haricinde) zarar görmesi durumunda;

İş bu maddelerde yazılı kanun ve durumların ihlali halinde tüm maddi, hukuki ve cezai sorumluluk teslim edilen kullanıcıya aittir. Bu sebeple şirketin uğrayacağı her türlü zararın teslim edilen kullanıcı tarafından tazmin edileceği kayıtsız şartsız kabul ve taahhüt edilmiştir.

Teslim edilen yazıcı satılamaz, takas edilemez ve bir başka kullanıcıya devredilemez. Yazıcıda lisansı olmayan hiçbir yazılım ve donanımın bulunmadığı kontrol edilerek teslim edilmiştir.`,

  'Mikrofon': `Markası, modeli, seri numarası ve ekipmanları belirtilen bir (1) adet mikrofon bir (1) adet verici, eksiksiz ve sağlam olarak teslim edilmiştir.

İlgili mikrofon, Bilgi Teknolojileri Departmanı tarafından tarafınıza teslim edildikten sonra;

- Bilgi teknolojileri tarafından onaysız veya habersiz olarak yüklenen yazılımlarda 5864 nolu Fikir ve Sanat Eserleri kanunun gereğince,
- Mikrofonun; ses kayıtları, iletişim programları veya internet platformlarında yasa dışı yayınlarda kullanılması, TCK 125, 200, 426, 427, 480, 490. maddeleri gereğince hukuki ve cezai sorumluluk doğuracaktır.
- Şirket içi veya şirket dışındaki sistemlere yetkisiz erişim, ses kayıtlarının izinsiz dinlenmesi ve paylaşılması halinde, TCK 525. madde gereğince sorumluluk teslim edilen kullanıcıya ait olacaktır.
- Mikrofonun amacı dışında kullanılması ve kullanıcı hatasından kaynaklanan arızalar durumunda tüm sorumluluk kullanıcıya aittir.

Yukarıda belirtilen kanun ve kuralların ihlali halinde, meydana gelecek tüm maddi, hukuki ve cezai sorumluluk teslim edilen kullanıcıya ait olup, şirketin uğrayacağı zararlar eksiksiz olarak tazmin edileceği kabul ve taahhüt edilmiştir.

Teslim edilen mikrofon; satılamaz, takas edilemez ve bir başka kullanıcıya devredilemez. Mikrofon, lisansı olmayan herhangi bir yazılım veya donanım içermediği kontrol edilerek teslim edilmiştir.`,

  // NOT: Yüklenen Monitör_Zimmet_formu.docx içeriği, Mikrofon dosyasıyla birebir aynı metni içeriyor
  // (şirketin kendi şablonunda muhtemelen kopyala-yapıştır hatası — Monitör'e özgü ayrı bir metin yok).
  // Bu yüzden Monitör notu KISALTILMIŞ haliyle bırakıldı, YANLIŞLIKLA mikrofon metni kopyalanmadı.
  // Gerçek Monitör tutanağı metni netleşirse Melih üzerinden güncellenmeli.
  'Monitör': 'Teslim edilen monitör hasarsız ve eksiksiz olarak teslim alınmıştır. Amaç dışı kullanım veya kullanıcı hatasından kaynaklanan hasarlarda sorumluluk teslim alan kullanıcıya aittir.',

  'Office 365': 'Bu lisans şirket kullanımı içindir, kişisel amaçla kullanılamaz ve başka bir kullanıcıya devredilemez. Lisans süresi dolduğunda veya kullanıcının görevi sona erdiğinde lisans Bilgi Teknolojileri departmanına iade edilmek/devredilmek zorundadır.',
}

function varsayilanTeslimNotu(tur: ZimmetTuru | ''): string {
  return (tur && ZIMMET_TESLIM_NOTLARI[tur]) || DEFAULT_TESLIM_NOTU
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
  const prevTurRef = useRef<ZimmetTuru | ''>('')

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

  // Zimmet sahibi seçilince departmanı gerçek personel listesinden otomatik doldurur
  const selectZimmetSahibi = useCallback(
    (personelId: string) => {
      const personel = personelListesi.find((p) => p.id === personelId)
      setStep1((prev) => ({
        ...prev,
        zimmetSahibiId: personelId,
        departman: personel?.department ?? '',
      }))
    },
    [personelListesi]
  )

  // Tür değişince "Teslim koşulları" alanını standart metinle doldurur.
  // Kullanıcı metni elle değiştirmişse (önceki türün varsayılanından farklıysa) dokunmaz.
  useEffect(() => {
    if (step1.tur === prevTurRef.current) return
    const oncekiVarsayilan = varsayilanTeslimNotu(prevTurRef.current)
    setStep2((prev) =>
      prev.teslimNotu === '' || prev.teslimNotu === oncekiVarsayilan
        ? { ...prev, teslimNotu: varsayilanTeslimNotu(step1.tur) }
        : prev
    )
    prevTurRef.current = step1.tur
  }, [step1.tur])

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
  const buildSubmitPayload = useCallback(
    () => ({
      zimmetSahibiId: step1.zimmetSahibiId,
      altZimmetSahibi: step1.altZimmetSahibi,
      departman: step1.departman,
      tur: step1.tur ? ZIMMET_TUR_TO_ENUM[step1.tur] : '',
      // "Yazıcı" gerçek enum'da yok (DIGER'e map'leniyor) — turDiger boşsa
      // gerçek kayıtta "Diğer: —" görünmesin diye tür adı otomatik yazılır.
      turDiger: step1.tur === 'Yazıcı' ? step1.turDiger || 'Yazıcı' : step1.turDiger,
      marka: step1.marka,
      model: step1.model,
      seriNumarasi: step1.seriNumarasi,
      aciklama: step1.aciklama,
      ozellik: step1.ozellik,
      ram: step1.ram,
      ipAdresi: step1.ipAdresi,
      parcaNo: step1.parcaNo,
      lisansBaslangic: step1.lisansBaslangic,
      lisansBitis: step1.lisansBitis,
      macAdresi: step1.macAdresi,
      pcAdi: step1.pcAdi,
      imeiNumarasi: step1.imeiNumarasi,
      verilisTarihi: step2.verilisTarihi,
      cihazDurumu: ZIMMET_DURUM_TO_ENUM[step2.durum],
      teslimNotu: step2.teslimNotu,
      teslimEdenImzalandi,
      teslimEdenImzaTarihi,
    }),
    [step1, step2, teslimEdenImzalandi, teslimEdenImzaTarihi]
  )

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
  const previewPdf = useCallback(async () => {
    setPreviewStatus('loading')
    setPreviewError(null)
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
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
      setPreviewStatus('idle')
    } catch (err) {
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
