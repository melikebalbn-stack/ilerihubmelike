// Bölüm Değişikliği Talep Formu — bildirimler (best-effort).
//
// Talep açılınca → İnsan Varlıkları ekibine (resolveHRRecipients).
// Karar verilince → talebi AÇANA.
// Her iki yönde: kurumsal mail (renderEmail · modül "İnsan Varlıkları") +
// in-app Notification + push. Hata FIRLATMAZ — bildirim gitmediği için talep
// ya da karar geri alınmaz; yalnız loglanır (mesai/kadro deseni).

import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { renderEmail, logoAttachments, p } from '@/lib/email-templates/layout'
import { escapeHtml, ileriHubUrl } from '@/lib/email-templates/akademi/_base'
import { resolveHRRecipients } from '@/lib/hr-notifications'
import { sendPushToUser } from '@/lib/push-notifications'

const KUYRUK_YOLU = '/personnel/bolum-degisiklik-talepleri'
const FORM_YOLU = '/forms/bolum-degisiklik'

type TalepOzet = {
  id: string
  talepNo: string
  mevcutBolum: string
  hedefBolum: string
  transferTarihi: Date | null
  gerekceler: string[]
  acanUserId: string
  durum: string
  redGerekcesi?: string | null
  personnel: { sicilNo: string | null; adSoyad: string }
}

function tarihStr(d: Date | null | undefined): string {
  return d ? new Date(d).toLocaleDateString('tr-TR') : 'İnsan Varlıkları belirleyecek'
}

/** Talep açıldı → İV ekibine. */
export async function talepAcildiBildir(talep: TalepOzet, acanAd: string): Promise<void> {
  try {
    const alicilar = await resolveHRRecipients()
    const link = ileriHubUrl(KUYRUK_YOLU)
    const baslik = `Bölüm değişikliği talebi: ${talep.talepNo}`
    const govde =
      `${talep.personnel.adSoyad} (${talep.personnel.sicilNo ?? '—'}) için ` +
      `${talep.mevcutBolum} → ${talep.hedefBolum} bölüm değişikliği talep edildi.`

    if (alicilar.length > 0) {
      const { html, text } = renderEmail({
        module: 'İnsan Varlıkları',
        title: 'Onayınızı bekleyen bölüm değişikliği talebi',
        subtitle: `${talep.talepNo} · ${escapeHtml(acanAd)}`,
        bodyHtml: p(escapeHtml(govde)),
        infoRows: [
          { label: 'Personel', value: escapeHtml(`${talep.personnel.adSoyad} (${talep.personnel.sicilNo ?? '—'})`) },
          { label: 'Mevcut bölüm', value: escapeHtml(talep.mevcutBolum) },
          { label: 'Hedef bölüm', value: `<strong>${escapeHtml(talep.hedefBolum)}</strong>` },
          { label: 'Talep eden', value: escapeHtml(acanAd) },
          { label: 'Transfer tarihi', value: escapeHtml(tarihStr(talep.transferTarihi)) },
          { label: 'Gerekçe sayısı', value: String(talep.gerekceler.length) },
        ],
        cta: { label: 'Talebi incele', url: link },
        footnote: 'İSG ve doktor onayı alanlarını İnsan Varlıkları doldurur.',
      })
      await sendEmail(alicilar.map((a) => ({ email: a.email, name: a.name })), baslik, text, html, logoAttachments())
    }

    // In-app + push — İV kullanıcıları.
    for (const a of alicilar) {
      await prisma.notification.create({
        data: { userId: a.id, title: baslik, message: govde, type: 'INFO', link: KUYRUK_YOLU },
      })
      await sendPushToUser(prisma, a.id, { title: baslik, body: govde, url: KUYRUK_YOLU })
    }
  } catch (err) {
    console.error('[bolum-talep] talep bildirimi gönderilemedi:', err)
  }
}

/** Karar verildi → talebi açana. */
export async function kararBildir(talep: TalepOzet, kararVerenAd: string): Promise<void> {
  try {
    const onaylandi = talep.durum === 'ONAYLANDI'
    const baslik = `Bölüm değişikliği talebiniz ${onaylandi ? 'onaylandı' : 'reddedildi'}: ${talep.talepNo}`
    const govde = onaylandi
      ? `${talep.personnel.adSoyad} ${talep.hedefBolum} bölümüne aktarıldı (transfer tarihi: ${tarihStr(talep.transferTarihi)}).`
      : `${talep.personnel.adSoyad} için ${talep.hedefBolum} talebiniz reddedildi.`

    const acan = await prisma.user.findUnique({
      where: { id: talep.acanUserId },
      select: { id: true, email: true, name: true },
    })

    if (acan?.email) {
      const { html, text } = renderEmail({
        module: 'İnsan Varlıkları',
        title: onaylandi ? 'Bölüm değişikliği talebiniz onaylandı' : 'Bölüm değişikliği talebiniz reddedildi',
        subtitle: `${talep.talepNo} · ${escapeHtml(kararVerenAd)}`,
        bodyHtml: p(escapeHtml(govde)),
        infoRows: [
          { label: 'Personel', value: escapeHtml(`${talep.personnel.adSoyad} (${talep.personnel.sicilNo ?? '—'})`) },
          { label: 'Bölüm', value: escapeHtml(`${talep.mevcutBolum} → ${talep.hedefBolum}`) },
          { label: 'Karar', value: onaylandi ? '<strong>Onaylandı</strong>' : '<strong>Reddedildi</strong>' },
          { label: 'Transfer tarihi', value: escapeHtml(tarihStr(talep.transferTarihi)) },
          ...(talep.redGerekcesi ? [{ label: 'Red gerekçesi', value: escapeHtml(talep.redGerekcesi) }] : []),
        ],
        cta: { label: 'Taleplerimi görüntüle', url: ileriHubUrl(FORM_YOLU) },
      })
      await sendEmail([{ email: acan.email, name: acan.name ?? acan.email }], baslik, text, html, logoAttachments())
    }

    if (acan) {
      await prisma.notification.create({
        data: {
          userId: acan.id,
          title: baslik,
          message: govde + (talep.redGerekcesi ? ` Gerekçe: ${talep.redGerekcesi}` : ''),
          type: onaylandi ? 'SUCCESS' : 'WARNING',
          link: FORM_YOLU,
        },
      })
      await sendPushToUser(prisma, acan.id, { title: baslik, body: govde, url: FORM_YOLU })
    }
  } catch (err) {
    console.error('[bolum-talep] karar bildirimi gönderilemedi:', err)
  }
}
