import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma'
import type { JobApplicationStatus } from '@/generated/prisma'
import { STATUS_LABELS_TR } from '@/lib/recruitment/transitions'
import { yeniBasvuruMaili } from '@/lib/email-templates/hr-basvuru'
import { updateApplicationStatus } from '@/lib/recruitment/stage-log'
import { sendPushToUser } from '@/lib/push-notifications'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'
import { sendEmail } from '@/lib/email'
import { resolveHRRecipients } from '@/lib/hr-notifications'
import {
  verifyConsentedDraft,
  isDraftStatus,
  isDuzeltmeStatus,
  duzeltmeOnayDurumu,
} from '@/lib/job-application/consent-guard'
import { imzaDogrula } from '@/lib/recruitment/basvuru-takip'
import { checkRateLimit } from '@/lib/rate-limit'
import { DRAFT_COOKIE_NAME, verifyDraftToken } from '@/lib/job-application/draft-cookie'
import { maasBeklentisiGecerliMi } from '@/lib/recruitment/salary'
import { basvuruTakipImzasi } from '@/lib/recruitment/basvuru-takip'
import { normalizeMaritalStatus } from '@/lib/job-application/marital-status'
import { SERVER_SCALAR_REQUIRED } from '@/components/job-application/required-fields'
import { alanBuyut } from '@/lib/job-application/buyuk-harf'

// Public form gönderimindeki denetim kayıtlarının aktörü. Oturum YOK (public uç),
// bu yüzden basvuru-sorgula'daki sentinel deseni kullanılır (PUBLIC_BASVURU_SORGULA).
const PUBLIC_FORM_AKTOR = 'PUBLIC_BASVURU_FORM'

/** TC karşılaştırması için normalize: yalnız boşluk ve tire temizlenir.
 *  "123 456 789 01" ve "123-456-789-01" → "12345678901". Başka dönüşüm YOK;
 *  karşılaştırma TAM eşitliktir (kısmi/ilk-hane eşleşmesi kabul edilmez). */
function kimlikNormalize(v: string | null | undefined): string {
  return (v ?? '').replace(/[\s-]/g, '')
}

// POST - İş başvurusu kaydet
export async function POST(request: NextRequest) {
  try {
    // AKIŞ GUARD: KVKK onayı + sağlık beyanı tamamlanmadan başvuru gönderilemez.
    // (Adım atlanamaz — consent/health yoksa 403. Mevcut form davranışı korunur.)
    const draftToken = request.cookies.get(DRAFT_COOKIE_NAME)?.value
    const consentedApplicationId = await verifyConsentedDraft(draftToken)

    // ── Faz 1: ADAYA_GERI_GONDERILDI → aday düzeltme gönderimi ──────────────────
    // Taslak cookie'si burada YOKTUR: ilk gönderimde bilerek geçersizleştiriliyor
    // (aşağıdaki FIX 2). Bu yüzden yetki, mevcut public capability deseninden gelir:
    // applicationNumber + takipImzasi = HMAC(applicationId, NEXTAUTH_SECRET) — aynı
    // çift /api/public/basvuru-durum'da da kullanılıyor (basvuru-takip.ts).
    //
    // Neden BAŞLIK (header), gövde/query değil:
    //   · query → imza erişim loglarına düşer (basvuru-durum bilerek POST gövdesi kullanıyor)
    //   · gövde → yetkiyi doğrulamak için multipart body'yi ÖNCE parse etmek gerekirdi;
    //     mevcut sıra (auth → parse) korunsun diye başlık tercih edildi.
    let hedefApplicationId: string | null = consentedApplicationId
    let duzeltmeModu = false

    if (!hedefApplicationId) {
      const basvuruNo = request.headers.get('x-basvuru-no')?.trim()
      const takipImzasi = request.headers.get('x-takip-imzasi')?.trim()
      if (basvuruNo && takipImzasi) {
        // Rate-limit: IP DEĞİL, (no + imza) bazlı — basvuru-durum ile aynı gerekçe
        // (paylaşımlı tablet/NAT tek IP görünür). Gönderim seyrek: 5/dk yeterli.
        const rl = checkRateLimit(`basvuru-duzeltme:${basvuruNo}:${takipImzasi}`, {
          windowMs: 60 * 1000,
          maxAttempts: 5,
        })
        if (!rl.success) {
          return NextResponse.json(
            { error: `Çok fazla istek. ${rl.resetIn} sn sonra tekrar deneyin.` },
            { status: 429 }
          )
        }
        const kayit = await prisma.publicJobApplication.findUnique({
          where: { applicationNumber: basvuruNo },
          select: { id: true, status: true },
        })
        // Sabit-zaman imza doğrulaması (imzaDogrula → timingSafeEqual).
        if (kayit && imzaDogrula(kayit.id, takipImzasi) && isDuzeltmeStatus(kayit.status)) {
          // KVKK/sağlık KORUNUR; yalnız belge revizyonu eskiyse yeniden onay istenir.
          const onay = await duzeltmeOnayDurumu(kayit.id)
          if (!onay.ok) {
            return NextResponse.json({ error: onay.mesaj, kod: onay.kod }, { status: 403 })
          }
          hedefApplicationId = kayit.id
          duzeltmeModu = true
        }
      }
    }

    if (!hedefApplicationId) {
      // FIX 1: cookie+consent geçerli ama başvuru ARTIK taslak değilse (zaten
      // gönderilmiş/işlenmiş) → NET 409. Cookie yeniden kullanımıyla reddedilmiş
      // bir başvurunun yeni formla ezilmesini engeller (İzzet→Yaşar vakası).
      const rawId = verifyDraftToken(draftToken)
      if (rawId) {
        const existing = await prisma.publicJobApplication.findUnique({
          where: { id: rawId },
          select: { status: true },
        })
        if (existing && !isDraftStatus(existing.status)) {
          return NextResponse.json(
            { error: 'Bu başvuru zaten gönderilmiş/işlenmiş' },
            { status: 409 }
          )
        }
      }
      return NextResponse.json(
        { error: 'Önce KVKK onayını tamamlamalısınız.' },
        { status: 403 }
      )
    }
    const healthDone = await prisma.jobApplicationHealth.findUnique({
      where: { applicationId: hedefApplicationId },
      select: { id: true },
    })
    if (!healthDone) {
      return NextResponse.json(
        { error: 'Önce sağlık beyan formunu tamamlamalısınız.' },
        { status: 403 }
      )
    }

    const formData = await request.formData()

    // ── ZORUNLU ALAN KONTROLÜ (merkezi şema — frontend ile AYNI kaynak) ──
    // Manuel validasyon (Zod değil). Düz-metin alanlar SERVER_SCALAR_REQUIRED'dan;
    // yapısal/özel alanlar (foto, beyan, eğitim geçmişi, iş tecrübesi, referans,
    // iletişim tercihi) aşağıda ayrı kontrol edilir.
    const missing: string[] = []
    for (const { key, label } of SERVER_SCALAR_REQUIRED) {
      const v = formData.get(key)
      if (typeof v !== 'string' || !v.trim()) missing.push(label)
    }
    const parseJsonArr = (k: string): unknown[] => {
      try {
        const v = JSON.parse((formData.get(k) as string) || '[]')
        return Array.isArray(v) ? v : []
      } catch {
        return []
      }
    }
    const eduHistory = (() => {
      try {
        return JSON.parse((formData.get('educationHistory') as string) || '{}') as Record<string, { institution?: string }>
      } catch {
        return {}
      }
    })()
    const str = (o: unknown, k: string) => String((o as Record<string, unknown>)?.[k] ?? '').trim()
    if (!Object.values(eduHistory).some((e) => (e?.institution ?? '').trim())) missing.push('Eğitim Geçmişi')
    if (!parseJsonArr('workExperience').some((r) => str(r, 'company') || str(r, 'position'))) missing.push('İş Tecrübeleri')
    if (!parseJsonArr('references').some((r) => str(r, 'name') || str(r, 'company'))) missing.push('Referanslar')
    const prefGsm = formData.get('preferredContactGsm') === 'true'
    const prefEmail = formData.get('preferredContactEmail') === 'true'
    const prefOther = ((formData.get('preferredContactOther') as string) || '').trim()
    if (!prefGsm && !prefEmail && !prefOther) missing.push('Size nasıl ulaşabiliriz?')
    const declAccepted = formData.get('declarationAccepted') === 'true'
    const sig = ((formData.get('digitalSignature') as string) || '').trim()
    if (!declAccepted || !sig) missing.push('Beyan')
    const photoField = formData.get('photo') as File | null
    if (!photoField || photoField.size === 0) missing.push('Fotoğraf')

    if (missing.length > 0) {
      return NextResponse.json({ error: `Eksik zorunlu alanlar: ${missing.join(', ')}` }, { status: 400 })
    }

    // ── KVKK ONAYI ↔ FORM KİMLİĞİ EŞLEŞMESİ ─────────────────────────────────
    // Paylaşımlı tablette bir aday KVKK onayını verip kalkıyor, SONRAKİ aday aynı
    // taslak üzerinden formu dolduruyordu → başvuru, BAŞKASININ imzaladığı onaya
    // bağlı kalıyordu. Prod ölçümü (2026-08-16): 15 başvurunun 2'sinde bu durum var;
    // birinde KVKK imzası ile form beyanı arasında 252 dk vardı (normal ortalama 18 dk).
    //
    // Guard YALNIZ yeni gönderimlere uygulanır — mevcut kayıtlara DOKUNULMAZ.
    // Karşılaştırma boşluk/tire temizliği sonrası TAM eşitlik; kısmi/ilk-hane eşleşmesi YOK.
    //
    // KONUM: zorunlu alan kontrolünün hemen ardında, FOTOĞRAF YAZIMINDAN ÖNCE.
    // Böylece reddedilen gönderimde ne disk'e dosya yazılır ne de DB'ye satır düşer
    // (statü de değişmez — güncelleme aşağıdaki tek transaction'da yapılır).
    //
    // Consent satırı YOKSA buraya HİÇ gelinmez: verifyConsentedDraft (consent-guard.ts)
    // consent yoksa null döner ve yukarıdaki akış guard'ı 403 verir. Düzeltme modunda
    // da duzeltmeOnayDurumu aynı kaydı doğrular. Yani o davranış DEĞİŞMEDİ.
    const formTc = ((formData.get('tcKimlikNo') as string) || '').trim()
    const consentKaydi = await prisma.jobApplicationConsent.findUnique({
      where: { applicationId: hedefApplicationId },
      select: { tcKimlikNo: true },
    })
    if (consentKaydi && kimlikNormalize(formTc) !== kimlikNormalize(consentKaydi.tcKimlikNo)) {
      // Denetim izi — mevcut public desen (basvuru-sorgula/route.ts): JobApplicationAccessLog,
      // sentinel aktör + try/catch (denetim yazımı ana akışı ENGELLEMEZ).
      // NOT: bu satır "yarım kayıt" DEĞİL, bilinçli güvenlik kaydıdır; başvurunun
      // kendi tablolarına (PublicJobApplication/Consent/Health) hiçbir şey yazılmaz.
      try {
        await prisma.jobApplicationAccessLog.create({
          data: {
            applicationId: hedefApplicationId,
            accessedBy: PUBLIC_FORM_AKTOR,
            accessType: 'TC_KVKK_UYUSMAZLIK',
            ipAddress:
              request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
              request.headers.get('x-real-ip') ||
              null,
          },
        })
      } catch {
        // denetim yazılamasa da gönderim REDDEDİLİR (kapı denetime bağlı değil)
      }
      // HTTP 400 — bu route'un diğer validasyon hatalarıyla AYNI kod.
      // `kod`: istemci bu hataya özel "Yeni Başvuru Başlat" yolunu gösterebilsin diye
      // (mevcut desen — duzeltmeOnayDurumu da {error, kod} döndürüyor).
      return NextResponse.json(
        {
          error:
            'Kimlik bilgileriniz KVKK onayindaki bilgilerle uyusmuyor. Lutfen basvuruya bastan baslayin.',
          kod: 'KVKK_TC_UYUSMAZ',
        },
        { status: 400 },
      )
    }

    const fullName = formData.get('fullName') as string

    // IP ve User Agent
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                      request.headers.get('x-real-ip') ||
                      'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Fotoğraf yükleme
    let photoUrl: string | null = null
    const photo = formData.get('photo') as File | null

    if (photo && photo.size > 0) {
      // Dosya boyutu kontrolü (max 5MB)
      if (photo.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'Fotoğraf boyutu 5MB\'dan küçük olmalıdır' }, { status: 400 })
      }

      // Sadece resim dosyaları
      if (!photo.type.startsWith('image/')) {
        return NextResponse.json({ error: 'Sadece resim dosyaları kabul edilmektedir' }, { status: 400 })
      }

      // Upload klasörünü oluştur
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'job-applications')
      if (!existsSync(uploadDir)) {
        await mkdir(uploadDir, { recursive: true })
      }

      // Yıl/ay bazlı alt klasör
      const now = new Date()
      const yearMonth = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`
      const targetDir = path.join(uploadDir, yearMonth)
      if (!existsSync(targetDir)) {
        await mkdir(targetDir, { recursive: true })
      }

      // Güvenli dosya adı oluştur
      const timestamp = Date.now()
      const randomSuffix = Math.random().toString(36).substring(2, 8)
      const ext = path.extname(photo.name) || '.jpg'
      const fileName = `photo_${timestamp}_${randomSuffix}${ext}`

      // Dosyayı kaydet
      const bytes = await photo.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const filePath = path.join(targetDir, fileName)
      await writeFile(filePath, buffer)

      photoUrl = `/api/files/uploads/job-applications/${yearMonth}/${fileName}`
    }

    // BÜYÜK HARF NORMALİZASYONU — ASIL KAPI burasıdır (istemci yalnız görsel).
    // metin(): trim + alan hariç listede değilse toLocaleUpperCase('tr-TR').
    // Hariç liste TEK KAYNAK: src/lib/job-application/buyuk-harf.ts
    const metin = (key: string): string | null => {
      const ham = (formData.get(key) as string)?.trim() || ''
      if (!ham) return null
      return alanBuyut(key, ham)
    }

    // Form verilerini hazırla
    const applicationData = {
      fullName: alanBuyut('fullName', fullName.trim()),
      birthPlace: metin('birthPlace'),
      birthDate: formData.get('birthDate') ? new Date(formData.get('birthDate') as string) : null,
      nationality: metin('nationality'),
      tcKimlikNo: (formData.get('tcKimlikNo') as string)?.trim() || null,
      gender: formData.get('gender') as string || null,
      bloodType: formData.get('bloodType') as string || null,
      militaryStatus: formData.get('militaryStatus') as string || null,
      militaryPostponeDate: formData.get('militaryPostponeDate') ? new Date(formData.get('militaryPostponeDate') as string) : null,
      maritalStatus: normalizeMaritalStatus(formData.get('maritalStatus')),
      numberOfChildren: formData.get('numberOfChildren') ? parseInt(formData.get('numberOfChildren') as string) : null,
      spouseWorking: formData.get('spouseWorking') === 'true' ? true : formData.get('spouseWorking') === 'false' ? false : null,
      spouseOccupation: metin('spouseOccupation'),
      homeAddress: metin('homeAddress'),
      dependents: metin('dependents'),
      mobilePhone: (formData.get('mobilePhone') as string)?.trim() || null,
      workPhone: (formData.get('workPhone') as string)?.trim() || null,
      homePhone: (formData.get('homePhone') as string)?.trim() || null,
      email: (formData.get('email') as string)?.trim() || null,
      // Kaynak artık sözlükten (ReferralSourceDef). Form 'referralSource' alanında kaynak
      // ADINI gönderir; aşağıda ada göre referralSourceId çözülür. Eski enum kolonu yeni
      // kayıtlarda null bırakılır (geriye dönük 20 başvuruda duruyor).
      referralSourceOther: metin('referralSourceOther'),
      memberships: metin('memberships'),
      hasDriverLicense: formData.get('hasDriverLicense') === 'true' ? true : formData.get('hasDriverLicense') === 'false' ? false : null,
      driverLicenseClass: metin('driverLicenseClass'),
      driverLicenseDate: formData.get('driverLicenseDate') ? new Date(formData.get('driverLicenseDate') as string) : null,
      // Adli Sicil ve Hukuki Durum
      hasCriminalRecord: formData.get('hasCriminalRecord') === 'true' ? true : formData.get('hasCriminalRecord') === 'false' ? false : null,
      hasConviction: formData.get('hasConviction') === 'true' ? true : formData.get('hasConviction') === 'false' ? false : null,
      convictionDetails: metin('convictionDetails'),
      hasOngoingCase: formData.get('hasOngoingCase') === 'true' ? true : formData.get('hasOngoingCase') === 'false' ? false : null,
      // Fiziksel Özellikler
      height: formData.get('height') ? parseInt(formData.get('height') as string) : null,
      weight: formData.get('weight') ? parseInt(formData.get('weight') as string) : null,
      shoeSize: (formData.get('shoeSize') as string)?.trim() || null,
      clothingSizeUpper: (formData.get('clothingSizeUpper') as string)?.trim() || null,
      clothingSizeLower: (formData.get('clothingSizeLower') as string)?.trim() || null,
      // Çalışma Koşulları
      hasTravelRestriction: formData.get('hasTravelRestriction') === 'true' ? true : formData.get('hasTravelRestriction') === 'false' ? false : null,
      canWorkShifts: formData.get('canWorkShifts') === 'true' ? true : formData.get('canWorkShifts') === 'false' ? false : null,
      // Hobiler
      hobbies: metin('hobbies'),
      // İş Tercihleri
      availableStartDate: formData.get('availableStartDate') ? new Date(formData.get('availableStartDate') as string) : null,
      expectedSalary: formData.get('expectedSalary') ? parseInt(formData.get('expectedSalary') as string) : null,
      requestedPosition: metin('requestedPosition'),
      previouslyWorkedHere: formData.get('previouslyWorkedHere') === 'true' ? true : formData.get('previouslyWorkedHere') === 'false' ? false : null,
      // Öğrenim Durumu
      educationLevel: formData.get('educationLevel') as string || null,
      // Eğitim Geçmişi
      educationHistory: formData.get('educationHistory') ? JSON.parse(formData.get('educationHistory') as string) : null,
      // Staj, Kurs ve Seminerler
      coursesAndSeminars: formData.get('coursesAndSeminars') ? JSON.parse(formData.get('coursesAndSeminars') as string) : null,
      // Yabancı Dil Bilgisi
      foreignLanguages: formData.get('foreignLanguages') ? JSON.parse(formData.get('foreignLanguages') as string) : null,
      // Bilgisayar Bilgisi
      computerSkills: formData.get('computerSkills') ? JSON.parse(formData.get('computerSkills') as string) : null,
      // İş Tecrübeleri
      workExperience: formData.get('workExperience') ? JSON.parse(formData.get('workExperience') as string) : null,
      // Firma bünyesinde akraba/tanıdık
      hasRelativesInCompany: formData.get('hasRelativesInCompany') === 'true' ? true : formData.get('hasRelativesInCompany') === 'false' ? false : null,
      relativeName: metin('relativeName'),
      // İletişim Tercihi
      preferredContactGsm: formData.get('preferredContactGsm') === 'true' ? true : null,
      preferredContactEmail: formData.get('preferredContactEmail') === 'true' ? true : null,
      preferredContactOther: metin('preferredContactOther'),
      // Son işveren ile temasa geçilebilir mi?
      canContactLastEmployer: formData.get('canContactLastEmployer') === 'true' ? true : formData.get('canContactLastEmployer') === 'false' ? false : null,
      // Referanslar
      references: formData.get('references') ? JSON.parse(formData.get('references') as string) : null,
      // Beyan
      declarationAccepted: formData.get('declarationAccepted') === 'true' ? true : null,
      declarationDate: formData.get('declarationAccepted') === 'true' ? new Date() : null,
      // Dijital İmza
      digitalSignature: (formData.get('digitalSignature') as string)?.trim() || null,
      signatureDate: (formData.get('signatureDate') as string)?.trim() || null,
      photoUrl,
      ipAddress,
      userAgent,
    }

    // Maaş beklentisi SUNUCU doğrulaması (client tek başına yeterli değil) — TEK KAYNAK sınırlar.
    const maasKontrol = maasBeklentisiGecerliMi(applicationData.expectedSalary)
    if (!maasKontrol.ok) {
      return NextResponse.json({ error: maasKontrol.hata }, { status: 400 })
    }

    // Kaynak sözlüğü: form 'referralSource' alanında kaynak ADI gönderir → aktif
    // ReferralSourceDef'e göre referralSourceId çözülür (bulunamazsa null; form bozulmaz).
    const kaynakAdi = (formData.get('referralSource') as string)?.trim()
    if (kaynakAdi) {
      const def = await prisma.referralSourceDef.findFirst({ where: { name: kaynakAdi, isActive: true }, select: { id: true } })
      if (def) (applicationData as Record<string, unknown>).referralSourceId = def.id
    }

    // Taslak birleştirme: KVKK adımında oluşan taslağı (cookie'deki applicationId) tam form
    // alanlarıyla GÜNCELLE + status PENDING (İK inceleme kuyruğu). Yeni kayıt açılmaz —
    // consent+health bu final başvuruyla ilişkili kalır.
    // Tek geçit: status + aşama logu aynı transaction'da (from=HEALTH_PENDING → PENDING).
    // Public form → changedBy null. Diğer form alanları helper'ın data'sında güncellenir.
    //
    // DÜZELTME MODU: aynı çağrı, from=ADAYA_GERI_GONDERILDI → PENDING. Bu geçiş izin
    // MATRİSİNDEN GEÇMEZ — aday bir User değil, TransitionRole alamaz. Public geçişlerin
    // matris dışı olması mevcut desen (ilk kayıt da logInitialStage ile matrissiz yazılıyor).
    // Önceki form hâli SAKLANMAZ: alanlar üzerine yazılır (karar 2).
    const application = await prisma.$transaction((tx) =>
      updateApplicationStatus(tx, {
        applicationId: hedefApplicationId,
        toStatus: 'PENDING',
        note: duzeltmeModu ? 'Aday düzeltme gönderdi' : undefined,
        data: applicationData as Prisma.PublicJobApplicationUpdateInput,
      }),
    )

    // E-posta bildirimi gönder
    try {
      await sendJobApplicationEmail(application)
    } catch (emailError) {
      console.error('E-posta gönderim hatası:', emailError)
      // E-posta hatası başvuruyu engellemez
    }

    // İK departmanındaki kullanıcılara bildirim gönder
    try {
      await sendHRNotifications(application)
    } catch (notificationError) {
      console.error('Bildirim gönderim hatası:', notificationError)
      // Bildirim hatası başvuruyu engellemez
    }

    const res = NextResponse.json({
      success: true,
      applicationNumber: application.applicationNumber,
      // Tablet teşekkür ekranı public durum yoklaması için imza (sır yanıtta DEĞİL, türev).
      takipImzasi: basvuruTakipImzasi(application.id),
      message: 'Başvurunuz başarıyla kaydedildi'
    })
    // FIX 2: final submit tamamlandı → taslak cookie'sini geçersizleştir.
    // Aynı tarayıcıda ikinci bir formun bu (artık PENDING) başvuruyu ezmesini önler.
    res.cookies.set(DRAFT_COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })
    return res
  } catch (error) {
    console.error('İş başvurusu kaydedilirken hata:', error)
    return NextResponse.json({ error: 'Sunucu hatası oluştu' }, { status: 500 })
  }
}

// E-posta gönderme fonksiyonu - Basit bildirim
// Yeni başvuru maili — ORTAK ŞABLON (email-templates/hr-basvuru.ts).
// Eskiden buradaki satır-içi HTML kullanılıyordu; üç bildirim tipi tek iskelete taşındı.
// Ayrıca eski çağrı HTML'i `body` (düz metin) parametresine veriyordu ve sendEmail
// html'i body'den türetiyordu (email.ts:218) — artık text ve html AYRI veriliyor.
async function sendJobApplicationEmail(application: {
  id: string
  applicationNumber: string
  fullName: string
  requestedPosition?: string | null
  status?: JobApplicationStatus
  createdAt?: Date
}) {
  // Hat 1 fix (PR-HR-NOTIF): gerçek İK ekibine email gönder, hardcoded recipient yerine
  const recipients = await resolveHRRecipients()
  if (recipients.length === 0) {
    console.warn('[job-application] HR recipient bulunamadı, email gönderilmedi')
    return
  }
  const mail = yeniBasvuruMaili({
    applicationId: application.id,
    applicationNumber: application.applicationNumber,
    adayAdi: application.fullName,
    pozisyon: application.requestedPosition,
    tarih: application.createdAt,
    durumEtiketi: STATUS_LABELS_TR[application.status ?? 'PENDING'] ?? 'İV Ön İnceleme',
  })
  await sendEmail(
    recipients.map(r => ({ email: r.email, name: r.name })),
    mail.subject,
    mail.text,
    mail.html
  )
}

// İK departmanına bildirim gönderme fonksiyonu (PR-HR-NOTIF: ortak resolver)
async function sendHRNotifications(application: {
  id: string
  applicationNumber: string
  fullName: string
}) {
  const hrUsers = await resolveHRRecipients()

  if (hrUsers.length === 0) {
    console.log('İK kullanıcısı bulunamadı, bildirim gönderilmedi')
    return
  }

  const link = `/strategic-hr/recruitment?tab=job-applications&id=${application.id}`
  const title = 'Yeni İş Başvurusu'
  const message = `${application.fullName} adlı aday iş başvurusu yaptı. (${application.applicationNumber})`

  await prisma.notification.createMany({
    data: hrUsers.map(u => ({
      userId: u.id,
      title,
      message,
      type: 'INFO' as const,
      link,
    })),
  })

  for (const u of hrUsers) {
    sendPushToUser(prisma, u.id, {
      title,
      body: message,
      url: link,
    }).catch(() => {})
  }

  console.log(`${hrUsers.length} İK kullanıcısına bildirim gönderildi`)
}
