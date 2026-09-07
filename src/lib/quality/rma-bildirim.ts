/**
 * RMA/SMA sorumlu atama bildirimi (KAL-KYT-16 revizyonu).
 *
 * Sorumlu atandığında 3 kanaldan haber verilir — zimmet/notifications.ts deseni
 * birebir: kanal izolasyonu için Promise.allSettled, fire-and-forget.
 *   1. E-posta (sendEmail)
 *   2. In-app Notification (prisma.notification.create, "link" alanı)
 *   3. Push (sendPushToUser)
 *
 * SORUMLU → USER: RmaKayit.sorumluId zaten Personnel.id olduğu için sicilNo
 * hop'una gerek yok; Personnel.user (1-1 "UserPersonnel") doğrudan kullanılıyor.
 * Emsal: visit-reports/aksiyon-bildirimi.ts (orada sicil→Personnel→User zinciri var).
 *
 * User'ı olmayan personel (portal hesabı yok) SESSİZCE atlanır — hata değil,
 * beklenen durum; yalnız log yazılır. Bildirim YALNIZ sorumlu DEĞİŞTİĞİNDE
 * gönderilir (POST'ta dolu geldiyse, PATCH'te eski ≠ yeni) — çağıran karar verir.
 */
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { sendPushToUser } from '@/lib/push-notifications'

export type RmaBildirimKaydi = {
  id: string
  no: number
  tip: string
  musteriAdi: string | null
  termin: Date | null
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function terminMetni(d: Date | null): string {
  if (!d) return 'termin yok'
  return `termin: ${d.toLocaleDateString('tr-TR')}`
}

async function sendSorumluEmail(
  alici: { email: string; name: string },
  kayit: RmaBildirimKaydi,
): Promise<void> {
  const subject = `[ILERIHub] ${kayit.tip} No ${kayit.no} kaydına sorumlu olarak atandınız`
  const govde =
    `${kayit.tip} No ${kayit.no}\n` +
    `Müşteri: ${kayit.musteriAdi ?? '—'}\n` +
    `${terminMetni(kayit.termin)}`
  const body = `Merhaba ${alici.name},\n\nBir RMA/SMA iade kaydına sorumlu olarak atandınız.\n\n${govde}\n\nKök neden ve aksiyon alanlarını doldurmak için ILERIHub'a giriş yapabilirsiniz.`
  const html = `
    <p>Merhaba ${esc(alici.name)},</p>
    <p>Bir RMA/SMA iade kaydına <strong>sorumlu</strong> olarak atandınız.</p>
    <ul>
      <li><strong>Kayıt:</strong> ${esc(kayit.tip)} No ${kayit.no}</li>
      <li><strong>Müşteri:</strong> ${esc(kayit.musteriAdi ?? '—')}</li>
      <li><strong>Termin:</strong> ${esc(terminMetni(kayit.termin))}</li>
    </ul>
    <p>Kök neden ve aksiyon alanlarını doldurmak için ILERIHub'a giriş yapabilirsiniz.</p>
  `
  await sendEmail([{ name: alici.name, email: alici.email }], subject, body, html)
}

async function sendSorumluPush(userId: string, kayit: RmaBildirimKaydi): Promise<void> {
  const subCount = await prisma.pushSubscription.count({ where: { userId } })
  if (subCount === 0) {
    console.warn(`[rma-notify] user ${userId} push subscription yok, push atlanıyor`)
    return
  }
  await sendPushToUser(prisma, userId, {
    title: 'RMA/SMA sorumluluğu atandı',
    body: `${kayit.tip} No ${kayit.no} — ${kayit.musteriAdi ?? '—'}`,
    url: `/kalite/rma/${kayit.id}`,
    tag: `rma-sorumlu-${kayit.id}`,
    data: { rmaKayitId: kayit.id },
  })
}

/**
 * Sorumluya atama bildirimi gönderir. Fire-and-forget: çağıran `await` ETMEMELİ
 * ve hata durumunda isteği başarısız SAYMAMALI (kanal hataları burada yutulur).
 */
export async function sorumluAtamaBildirimiGonder(
  kayit: RmaBildirimKaydi,
  sorumluPersonnelId: string,
): Promise<void> {
  const startedAt = Date.now()
  try {
    const personel = await prisma.personnel.findUnique({
      where: { id: sorumluPersonnelId },
      select: {
        adSoyad: true,
        user: { select: { id: true, email: true, name: true } },
      },
    })

    if (!personel) {
      console.warn(`[rma-notify] sorumlu personel bulunamadı (${sorumluPersonnelId}), bildirim atlandı`)
      return
    }
    const user = personel.user
    if (!user) {
      console.warn(
        `[rma-notify] "${personel.adSoyad}" personelinin portal hesabı yok, bildirim atlandı (RMA ${kayit.no})`,
      )
      return
    }

    const ad = user.name ?? personel.adSoyad
    const mesaj = `${kayit.tip} No ${kayit.no} (${kayit.musteriAdi ?? '—'}) kaydına sorumlu olarak atandınız — ${terminMetni(kayit.termin)}`

    console.log(`[rma-notify] dispatch started for RMA ${kayit.no} → ${user.email}`)

    // User.email şemada NOT NULL (@unique) → ayrı boş-kontrolü gerekmiyor.
    const kanallar: Promise<unknown>[] = [
      sendSorumluEmail({ email: user.email, name: ad }, kayit),
      prisma.notification.create({
        data: {
          userId: user.id,
          title: 'RMA/SMA sorumluluğu atandı',
          message: mesaj,
          type: 'INFO',
          link: `/kalite/rma/${kayit.id}`,
        },
      }),
      sendSorumluPush(user.id, kayit),
    ]

    const results = await Promise.allSettled(kanallar)
    const channelNames = ['email', 'in-app', 'push'] as const
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`[rma-notify] channel ${channelNames[i]} failed:`, r.reason)
      }
    })
    console.log(`[rma-notify] dispatch finished for RMA ${kayit.no} in ${Date.now() - startedAt}ms`)
  } catch (err) {
    // Bildirim, kaydın kendisini ASLA başarısız etmez.
    console.error('[rma-notify] bildirim gönderilemedi:', err)
  }
}
