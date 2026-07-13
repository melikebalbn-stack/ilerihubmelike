import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma'
import { updateApplicationStatus } from '@/lib/recruitment/stage-log'
import { sendPushToUser } from '@/lib/push-notifications'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'
import { sendEmail } from '@/lib/email'
import { resolveHRRecipients } from '@/lib/hr-notifications'
import { verifyConsentedDraft } from '@/lib/job-application/consent-guard'
import { DRAFT_COOKIE_NAME } from '@/lib/job-application/draft-cookie'
import { normalizeMaritalStatus } from '@/lib/job-application/marital-status'

// POST - İş başvurusu kaydet
export async function POST(request: NextRequest) {
  try {
    // AKIŞ GUARD: KVKK onayı + sağlık beyanı tamamlanmadan başvuru gönderilemez.
    // (Adım atlanamaz — consent/health yoksa 403. Mevcut form davranışı korunur.)
    const draftToken = request.cookies.get(DRAFT_COOKIE_NAME)?.value
    const consentedApplicationId = await verifyConsentedDraft(draftToken)
    if (!consentedApplicationId) {
      return NextResponse.json(
        { error: 'Önce KVKK onayını tamamlamalısınız.' },
        { status: 403 }
      )
    }
    const healthDone = await prisma.jobApplicationHealth.findUnique({
      where: { applicationId: consentedApplicationId },
      select: { id: true },
    })
    if (!healthDone) {
      return NextResponse.json(
        { error: 'Önce sağlık beyan formunu tamamlamalısınız.' },
        { status: 403 }
      )
    }

    const formData = await request.formData()

    // Zorunlu alan kontrolü
    const fullName = formData.get('fullName') as string
    if (!fullName || !fullName.trim()) {
      return NextResponse.json({ error: 'Ad Soyad zorunludur' }, { status: 400 })
    }

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

    // Form verilerini hazırla
    const applicationData = {
      fullName: fullName.trim(),
      birthPlace: (formData.get('birthPlace') as string)?.trim() || null,
      birthDate: formData.get('birthDate') ? new Date(formData.get('birthDate') as string) : null,
      nationality: (formData.get('nationality') as string)?.trim() || null,
      tcKimlikNo: (formData.get('tcKimlikNo') as string)?.trim() || null,
      gender: formData.get('gender') as string || null,
      bloodType: formData.get('bloodType') as string || null,
      militaryStatus: formData.get('militaryStatus') as string || null,
      militaryPostponeDate: formData.get('militaryPostponeDate') ? new Date(formData.get('militaryPostponeDate') as string) : null,
      maritalStatus: normalizeMaritalStatus(formData.get('maritalStatus')),
      numberOfChildren: formData.get('numberOfChildren') ? parseInt(formData.get('numberOfChildren') as string) : null,
      spouseWorking: formData.get('spouseWorking') === 'true' ? true : formData.get('spouseWorking') === 'false' ? false : null,
      spouseOccupation: (formData.get('spouseOccupation') as string)?.trim() || null,
      homeAddress: (formData.get('homeAddress') as string)?.trim() || null,
      dependents: (formData.get('dependents') as string)?.trim() || null,
      mobilePhone: (formData.get('mobilePhone') as string)?.trim() || null,
      workPhone: (formData.get('workPhone') as string)?.trim() || null,
      homePhone: (formData.get('homePhone') as string)?.trim() || null,
      email: (formData.get('email') as string)?.trim() || null,
      // Kaynak artık sözlükten (ReferralSourceDef). Form 'referralSource' alanında kaynak
      // ADINI gönderir; aşağıda ada göre referralSourceId çözülür. Eski enum kolonu yeni
      // kayıtlarda null bırakılır (geriye dönük 20 başvuruda duruyor).
      referralSourceOther: (formData.get('referralSourceOther') as string)?.trim() || null,
      memberships: (formData.get('memberships') as string)?.trim() || null,
      hasDriverLicense: formData.get('hasDriverLicense') === 'true' ? true : formData.get('hasDriverLicense') === 'false' ? false : null,
      driverLicenseClass: (formData.get('driverLicenseClass') as string)?.trim() || null,
      driverLicenseDate: formData.get('driverLicenseDate') ? new Date(formData.get('driverLicenseDate') as string) : null,
      // Adli Sicil ve Hukuki Durum
      hasCriminalRecord: formData.get('hasCriminalRecord') === 'true' ? true : formData.get('hasCriminalRecord') === 'false' ? false : null,
      hasConviction: formData.get('hasConviction') === 'true' ? true : formData.get('hasConviction') === 'false' ? false : null,
      convictionDetails: (formData.get('convictionDetails') as string)?.trim() || null,
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
      hobbies: (formData.get('hobbies') as string)?.trim() || null,
      // İş Tercihleri
      availableStartDate: formData.get('availableStartDate') ? new Date(formData.get('availableStartDate') as string) : null,
      expectedSalary: formData.get('expectedSalary') ? parseInt(formData.get('expectedSalary') as string) : null,
      requestedPosition: (formData.get('requestedPosition') as string)?.trim() || null,
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
      relativeName: (formData.get('relativeName') as string)?.trim() || null,
      // İletişim Tercihi
      preferredContactGsm: formData.get('preferredContactGsm') === 'true' ? true : null,
      preferredContactEmail: formData.get('preferredContactEmail') === 'true' ? true : null,
      preferredContactOther: (formData.get('preferredContactOther') as string)?.trim() || null,
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
    const application = await prisma.$transaction((tx) =>
      updateApplicationStatus(tx, {
        applicationId: consentedApplicationId,
        toStatus: 'PENDING',
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

    return NextResponse.json({
      success: true,
      applicationNumber: application.applicationNumber,
      message: 'Başvurunuz başarıyla kaydedildi'
    })
  } catch (error) {
    console.error('İş başvurusu kaydedilirken hata:', error)
    return NextResponse.json({ error: 'Sunucu hatası oluştu' }, { status: 500 })
  }
}

// E-posta gönderme fonksiyonu - Basit bildirim
async function sendJobApplicationEmail(application: {
  id: string
  fullName: string
  requestedPosition?: string | null
}) {
  const viewUrl = `https://hub.ilerigroup.com/strategic-hr/recruitment?tab=job-applications&id=${application.id}`

  const emailContent = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;">
<table cellpadding="0" cellspacing="0" border="0" width="400" align="center" style="border:2px solid #1e40af;">
<tr>
<td style="padding:12px 15px;border-bottom:1px solid #e5e7eb;font-family:Arial,sans-serif;">
<span style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">İLERİ GROUP</span><br>
<span style="font-size:16px;font-weight:bold;color:#1e40af;">Yeni İş Başvurusu</span>
</td>
</tr>
<tr>
<td style="padding:15px;font-family:Arial,sans-serif;font-size:13px;color:#374151;line-height:20px;">
<b style="color:#111827;">${application.fullName}</b>${application.requestedPosition ? '<br><span style="color:#6b7280;font-size:12px;">' + application.requestedPosition + ' pozisyonu için</span>' : ''}<br><br>
iş başvurusunda bulundu.
</td>
</tr>
<tr>
<td style="padding:10px 15px;border-top:1px solid #e5e7eb;">
<table cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="border:2px solid #1e40af;padding:8px 16px;">
<a href="${viewUrl}" style="color:#1e40af;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;text-decoration:none;">Başvuruyu İncele &rarr;</a>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="padding:10px 15px;border-top:1px solid #e5e7eb;font-family:Arial,sans-serif;font-size:10px;color:#9ca3af;">İnsan Varlıkları Departmanı</td>
</tr>
</table>
</body>
</html>`

  // Hat 1 fix (PR-HR-NOTIF): gerçek İK ekibine email gönder, hardcoded recipient yerine
  const recipients = await resolveHRRecipients()
  if (recipients.length === 0) {
    console.warn('[job-application] HR recipient bulunamadı, email gönderilmedi')
    return
  }
  await sendEmail(
    recipients.map(r => ({ email: r.email, name: r.name })),
    `Yeni İş Başvurusu - ${application.fullName}`,
    emailContent
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
