import 'server-only'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { renderEmail, p, esc, logoAttachments } from '@/lib/email-templates/layout'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hub.ilerigroup.com'

/**
 * Aksiyon sorumlusu atandığında/değiştiğinde bilgilendirme maili.
 *
 * Personnel'in kendi e-posta alanı yok — User.personnelId üzerinden bağlı
 * hesabın e-postası kullanılır (bkz. User "UserPersonnel" ilişkisi). Bağlı
 * hesap/e-posta yoksa SESSİZCE atlanır (hata fırlatmaz) — kayıt/güncelleme
 * akışını bloklamasın. Hesap pasifse de gönderilmez.
 *
 * Gövde, Hub'ın standart işlem maili şablonuyla (renderEmail, module='Kalite')
 * üretilir — FİF ve RMA bildirimleriyle aynı desen; düz metin gövde elle
 * yazılmaz, şablon html + text'i birlikte döndürür.
 */
export async function bildirSorumluAtandi(uygunsuzlukId: string, sorumluId: string): Promise<void> {
  try {
    const [personel, kayit] = await Promise.all([
      prisma.personnel.findUnique({
        where: { id: sorumluId },
        select: { adSoyad: true, user: { select: { email: true, name: true, isActive: true } } },
      }),
      prisma.kaliteUygunsuzluk.findUnique({
        where: { id: uygunsuzlukId },
        select: { no: true, mamulUrunKodu: true, isEmriNo: true, termin: true },
      }),
    ])

    if (!personel?.user?.email || !personel.user.isActive || !kayit) {
      console.warn(`[uygunsuzluk-notifications] sorumlu e-postası yok/pasif (personnelId=${sorumluId}), bildirim atlandı`)
      return
    }

    const baslik = `Uygunsuzluk No ${kayit.no} — aksiyon sorumlusu atandınız`
    const { html, text } = renderEmail({
      module: 'Kalite',
      title: baslik,
      bodyHtml: p(
        `Sayın ${esc(personel.adSoyad)}, aşağıdaki uygunsuzluk kaydında aksiyon sorumlusu olarak atandınız.`,
      ),
      infoRows: [
        { label: 'Uygunsuzluk No', value: `<strong>${esc(String(kayit.no))}</strong>` },
        { label: 'Mamul ürün kodu', value: esc(kayit.mamulUrunKodu) },
        { label: 'İş emri no', value: esc(kayit.isEmriNo) },
        ...(kayit.termin
          ? [{ label: 'Termin', value: esc(kayit.termin.toLocaleDateString('tr-TR')) }]
          : []),
      ],
      cta: { label: 'Kaydı aç', url: `${APP_URL}/kalite/uygunsuzluk/${uygunsuzlukId}` },
    })

    await sendEmail(
      [{ email: personel.user.email, name: personel.user.name ?? personel.adSoyad }],
      baslik,
      text,
      html,
      logoAttachments(),
    )
  } catch (e) {
    console.error('[uygunsuzluk-notifications] sorumlu bildirimi gönderilemedi:', e)
  }
}

/**
 * Toplantıya katılımcı olarak YENİ eklenen her kişiye bilgilendirme maili.
 * bildirSorumluAtandi ile AYNI desen (renderEmail, isActive kontrolü, sessiz
 * atlama) — yalnız alıcı kitlesi farklı. Zaten katılımcı olan kişi tekrar
 * kaydedilince yeniden maillenmesin diye çağıran yalnız YENİ eklenenleri
 * (önceki listede olmayanları) vermeli.
 */
export async function bildirKatilimciEklendi(uygunsuzlukId: string, personnelId: string): Promise<void> {
  try {
    const [personel, kayit] = await Promise.all([
      prisma.personnel.findUnique({
        where: { id: personnelId },
        select: { adSoyad: true, user: { select: { email: true, name: true, isActive: true } } },
      }),
      prisma.kaliteUygunsuzluk.findUnique({
        where: { id: uygunsuzlukId },
        select: { no: true, mamulUrunKodu: true, isEmriNo: true, termin: true },
      }),
    ])

    if (!personel?.user?.email || !personel.user.isActive || !kayit) {
      console.warn(`[uygunsuzluk-notifications] katılımcı e-postası yok/pasif (personnelId=${personnelId}), bildirim atlandı`)
      return
    }

    const baslik = `Uygunsuzluk No ${kayit.no} — toplantı katılımcısı olarak eklendiniz`
    const { html, text } = renderEmail({
      module: 'Kalite',
      title: baslik,
      bodyHtml: p(
        `Sayın ${esc(personel.adSoyad)}, aşağıdaki uygunsuzluk kaydına toplantı katılımcısı olarak eklendiniz.`,
      ),
      infoRows: [
        { label: 'Uygunsuzluk No', value: `<strong>${esc(String(kayit.no))}</strong>` },
        { label: 'Mamul ürün kodu', value: esc(kayit.mamulUrunKodu) },
        { label: 'İş emri no', value: esc(kayit.isEmriNo) },
        ...(kayit.termin
          ? [{ label: 'Termin', value: esc(kayit.termin.toLocaleDateString('tr-TR')) }]
          : []),
      ],
      cta: { label: 'Kaydı aç', url: `${APP_URL}/kalite/uygunsuzluk/${uygunsuzlukId}` },
    })

    await sendEmail(
      [{ email: personel.user.email, name: personel.user.name ?? personel.adSoyad }],
      baslik,
      text,
      html,
      logoAttachments(),
    )
  } catch (e) {
    console.error('[uygunsuzluk-notifications] katılımcı bildirimi gönderilemedi:', e)
  }
}
