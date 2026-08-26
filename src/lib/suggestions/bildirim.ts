// Öneri sistemi bildirimleri — MEVCUT desen (5S aksiyon ataması + hr-notifications).
// Yeni altyapı YOK: uygulama içi bildirim `prisma.notification.create`, mail `sendEmail`,
// şablon `email-templates/oneri.ts`.
//
// ÜÇ NOKTA
//   a) Öneri oluşturuldu  → önerenin LDAP yöneticisine (uygulama içi)
//   b) Yönetici onayladı  → Öneri Kurulu üyelerine (uygulama içi + MAIL)
//   c) Kurul karar verdi  → öneri sahibine (uygulama içi)
//
// HEPSİ BEST-EFFORT: her fonksiyon kendi içinde try/catch'lidir, ASLA fırlatmaz.
// Çağıranlar bunları ana yazma işleminden/transaction'dan SONRA çağırır; bildirim
// başarısız olsa da öneri kaydı geri ALINMAZ (hr-notifications ile aynı ilke).

import { prisma } from '@/lib/prisma'
import { getAllLDAPUsers } from '@/lib/ldap'
import { sendEmail } from '@/lib/email'
import { kurulDegerlendirmesiMaili } from '@/lib/email-templates/oneri'

const LINK = (id: string) => `/suggestions/${id}`

type OneriOzeti = {
  id: string
  suggestionNumber: string
  title: string
  submittedBy: string
  submittedByName: string
  submittedByDept?: string | null
  isAnonymous: boolean
  kategoriAdi?: string | null
}

/** E-postadan aktif kullanıcı id'si (bildirim User.id ister). Bulunamazsa null. */
async function kullaniciIdBul(email: string | null | undefined): Promise<string | null> {
  if (!email) return null
  const u = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' }, isActive: true },
    select: { id: true },
  })
  return u?.id ?? null
}

/**
 * (a) Öneri oluşturuldu → önerenin yöneticisine.
 * Yönetici LDAP `managerDN` zincirinden çözülür (approve ucundaki desenin aynısı).
 * Anonim öneride de yöneticiye gider ama gönderenin adı GEÇMEZ.
 */
export async function bildirYeniOneri(oneri: OneriOzeti): Promise<void> {
  try {
    const ldapUsers = await getAllLDAPUsers()
    const submitter = ldapUsers.find(
      (u) => u.email?.toLowerCase() === oneri.submittedBy.toLowerCase(),
    )
    if (!submitter?.managerDN) return
    const manager = ldapUsers.find(
      (u) => u.distinguishedName.toLowerCase() === submitter.managerDN!.toLowerCase(),
    )
    const managerId = await kullaniciIdBul(manager?.email)
    if (!managerId) return

    const veren = oneri.isAnonymous ? 'Anonim' : oneri.submittedByName
    await prisma.notification.create({
      data: {
        userId: managerId,
        title: 'Astınızdan yeni öneri',
        message: `${veren} yeni bir öneri gönderdi: ${oneri.title} (${oneri.suggestionNumber}). Onayınız bekleniyor.`,
        type: 'INFO',
        link: LINK(oneri.id),
      },
    })
  } catch (err) {
    console.error('[oneri-bildirim] (a) yeni oneri bildirimi basarisiz:', err)
  }
}

/**
 * (b) Yönetici onayladı → Öneri Kurulu üyelerine. Uygulama içi bildirim ZORUNLU,
 * ek olarak MAIL (kurul üyesi sürekli ekranda olmayabilir).
 * Kurul boşsa sessizce çıkar — hata değil, yapılandırma eksikliğidir.
 */
export async function bildirKurulaDustu(
  oneri: OneriOzeti,
  onaylayanAdi: string,
): Promise<void> {
  try {
    const uyeler = await prisma.suggestionBoardMember.findMany({
      where: { isActive: true },
      select: { email: true, name: true },
    })
    if (uyeler.length === 0) return

    const veren = oneri.isAnonymous ? 'Anonim' : oneri.submittedByName
    const mesaj = `Değerlendirmeniz bekleniyor: ${oneri.title} (${oneri.suggestionNumber}). ${onaylayanAdi} onayladı, öneri kurula iletildi.`

    // Uygulama içi — yalnız portalda kullanıcı kaydı olan üyeler için.
    const kullanicilar = await prisma.user.findMany({
      where: {
        isActive: true,
        email: { in: uyeler.map((u) => u.email), mode: 'insensitive' },
      },
      select: { id: true },
    })
    if (kullanicilar.length > 0) {
      await prisma.notification.createMany({
        data: kullanicilar.map((k) => ({
          userId: k.id,
          title: 'Öneri değerlendirmesi bekleniyor',
          message: mesaj,
          type: 'INFO' as const,
          link: LINK(oneri.id),
        })),
      })
    }

    // Mail — portal kaydı olmasa da kurul üyesinin adresine gider.
    const mail = kurulDegerlendirmesiMaili({
      suggestionId: oneri.id,
      suggestionNumber: oneri.suggestionNumber,
      baslik: oneri.title,
      verenAdi: veren,
      bolum: oneri.isAnonymous ? null : oneri.submittedByDept,
      kategori: oneri.kategoriAdi,
      onaylayanAdi,
    })
    await sendEmail(
      uyeler.map((u) => ({ email: u.email, name: u.name })),
      mail.subject,
      mail.text,
      mail.html,
    )
  } catch (err) {
    console.error('[oneri-bildirim] (b) kurul bildirimi basarisiz:', err)
  }
}

/**
 * (c) Kurul karar verdi → öneri sahibine.
 * ANONİM ÖNERİDE ATLANIR: gönderen aranmaz, hata da verilmez (sessiz çıkış).
 */
export async function bildirKarar(
  oneri: OneriOzeti,
  sonucEtiketi: string,
): Promise<void> {
  try {
    if (oneri.isAnonymous) return
    const sahipId = await kullaniciIdBul(oneri.submittedBy)
    if (!sahipId) return

    await prisma.notification.create({
      data: {
        userId: sahipId,
        title: 'Önerinize karar verildi',
        message: `${oneri.title} (${oneri.suggestionNumber}) önerinizin sonucu: ${sonucEtiketi}.`,
        type: 'INFO',
        link: LINK(oneri.id),
      },
    })
  } catch (err) {
    console.error('[oneri-bildirim] (c) karar bildirimi basarisiz:', err)
  }
}
