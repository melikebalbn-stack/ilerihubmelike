import 'server-only'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hub.ilerigroup.com'

/**
 * Aksiyon sorumlusu atandığında/değiştiğinde bilgilendirme maili.
 *
 * Personnel'in kendi e-posta alanı yok — User.personnelId üzerinden bağlı
 * hesabın e-postası kullanılır (bkz. User "UserPersonnel" ilişkisi). Bağlı
 * hesap/e-posta yoksa SESSİZCE atlanır (hata fırlatmaz) — kayıt/güncelleme
 * akışını bloklamasın.
 *
 * Çağıran try/catch İÇİNDE tutmalı değil: bu fonksiyonun kendisi hata yutar,
 * ama sendEmail ağ hatası fırlatırsa diye çağıranda da sarmalamak güvenli.
 */
export async function bildirSorumluAtandi(uygunsuzlukId: string, sorumluId: string): Promise<void> {
  try {
    const [personel, kayit] = await Promise.all([
      prisma.personnel.findUnique({
        where: { id: sorumluId },
        select: { adSoyad: true, user: { select: { email: true, name: true } } },
      }),
      prisma.kaliteUygunsuzluk.findUnique({
        where: { id: uygunsuzlukId },
        select: { no: true, mamulUrunKodu: true, isEmriNo: true },
      }),
    ])

    if (!personel?.user?.email || !kayit) {
      console.warn(`[uygunsuzluk-notifications] sorumlu e-postası yok (personnelId=${sorumluId}), bildirim atlandı`)
      return
    }

    const link = `${APP_URL}/kalite/uygunsuzluk/${uygunsuzlukId}`
    const subject = `Uygunsuzluk No ${kayit.no} — aksiyon sorumlusu atandınız`
    const body = `
Sayın ${personel.adSoyad},

"${kayit.mamulUrunKodu}" (İş Emri: ${kayit.isEmriNo}) için açılan Uygunsuzluk No ${kayit.no} kaydında aksiyon sorumlusu olarak atandınız.

Kaydı görüntülemek için: ${link}

--
Bu e-posta otomatik olarak ILERIHub Kalite Yönetim Sistemi tarafından gönderilmiştir.
    `.trim()

    await sendEmail([{ email: personel.user.email, name: personel.user.name ?? personel.adSoyad }], subject, body)
  } catch (e) {
    console.error('[uygunsuzluk-notifications] sorumlu bildirimi gönderilemedi:', e)
  }
}
