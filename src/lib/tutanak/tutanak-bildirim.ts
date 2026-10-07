/**
 * IV-FR-03 Tutanak Formu — bildirimler (best-effort, HATA FIRLATMAZ).
 *
 * Kanallar MEVCUT altyapı: kurumsal mail (renderEmail · modül "İnsan Varlıkları")
 * + in-app Notification + web push. Yeni şablon/altyapı kurulmadı.
 *
 * Bildirim gitmediği için onay akışı GERİ ALINMAZ — yalnız loglanır (bölüm-talep
 * ve deneme bildirimleriyle aynı sözleşme).
 *
 * GİZLİLİK: tutanak kişi hakkında disiplin verisidir. Mail gövdesinde AÇIKLAMA
 * METNİ GEÇMEZ; yalnız tutanak no, personel, sebep ve bağlantı gönderilir —
 * ayrıntıyı görmek için Hub'a girmek (ve yetki kapısından geçmek) gerekir.
 * Hakkında tutanak tutulan kişiye HİÇBİR kanaldan bildirim gitmez.
 */

import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { renderEmail, logoAttachments, p } from '@/lib/email-templates/layout'
import { escapeHtml, ileriHubUrl } from '@/lib/email-templates/akademi/_base'
import { resolveHRRecipients } from '@/lib/hr-notifications'
import { sendPushToUser } from '@/lib/push-notifications'
import { SEBEP_ETIKETLERI } from './tutanak-durum'
import type { TutanakSebep } from '@/generated/prisma'

export type TutanakBildirimOzeti = {
  id: string
  tutanakNo: string
  tutanakTarihi: Date | string
  adSoyadSnapshot: string
  sicilSnapshot: string | null
  bolumSnapshot: string
  sebep: TutanakSebep
}

type Alici = { userId: string; email: string; name: string }

const YOL = (id: string) => `/tutanak/${id}`

function tarihTR(d: Date | string): string {
  const t = typeof d === 'string' ? new Date(d) : d
  return Number.isNaN(t.getTime()) ? '-' : t.toLocaleDateString('tr-TR')
}

/** personnelId → aktif User (mail + in-app + push için). E-postasız personel null döner. */
export async function personelinKullanicisi(personnelId: string | null): Promise<Alici | null> {
  if (!personnelId) return null
  const u = await prisma.user.findFirst({
    where: { personnelId, isActive: true },
    select: { id: true, email: true, name: true, personnel: { select: { adSoyad: true } } },
  })
  if (!u?.email) return null
  return { userId: u.id, email: u.email, name: u.name || u.personnel?.adSoyad || u.email }
}

export async function userIdIleAlici(userId: string | null): Promise<Alici | null> {
  if (!userId) return null
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, isActive: true },
  })
  if (!u?.email || !u.isActive) return null
  return { userId: u.id, email: u.email, name: u.name || u.email }
}

function bilgiSatirlari(t: TutanakBildirimOzeti) {
  return [
    { label: 'Tutanak No', value: escapeHtml(t.tutanakNo) },
    { label: 'Personel', value: escapeHtml(`${t.adSoyadSnapshot} (${t.sicilSnapshot ?? '—'})`) },
    { label: 'Bölüm', value: escapeHtml(t.bolumSnapshot) },
    { label: 'Sebep', value: escapeHtml(SEBEP_ETIKETLERI[t.sebep]) },
    { label: 'Tutanak tarihi', value: escapeHtml(tarihTR(t.tutanakTarihi)) },
  ]
}

/**
 * Tek bir alıcıya üç kanal. `ctaEtiketi` null ise mailde düğme olmaz (yalnız
 * bilgilendirme). Hata yutulur; sonuç teşhis için döner.
 */
async function gonder(
  alici: Alici,
  t: TutanakBildirimOzeti,
  icerik: { baslik: string; govde: string; ctaEtiketi: string | null; dipnot?: string },
): Promise<{ mail: boolean; inApp: boolean; push: number }> {
  const sonuc = { mail: false, inApp: false, push: 0 }
  const link = YOL(t.id)
  try {
    const { html, text } = renderEmail({
      module: 'İnsan Varlıkları',
      title: icerik.baslik,
      subtitle: `${t.tutanakNo} · ${escapeHtml(t.adSoyadSnapshot)}`,
      bodyHtml: p(escapeHtml(icerik.govde)),
      infoRows: bilgiSatirlari(t),
      cta: icerik.ctaEtiketi ? { label: icerik.ctaEtiketi, url: ileriHubUrl(link) } : undefined,
      footnote:
        icerik.dipnot ??
        'Tutanak ayrıntısı yalnız ILERIHub üzerinden görüntülenir. Bu kayıt gizlidir.',
    })
    await sendEmail([{ email: alici.email, name: alici.name }], icerik.baslik, text, html, logoAttachments())
    sonuc.mail = true
  } catch (err) {
    console.error('[tutanak-bildirim] mail başarısız:', err)
  }
  try {
    await prisma.notification.create({
      data: { userId: alici.userId, title: icerik.baslik, message: icerik.govde, type: 'INFO', link },
    })
    sonuc.inApp = true
  } catch (err) {
    console.error('[tutanak-bildirim] in-app başarısız:', err)
  }
  try {
    sonuc.push = await sendPushToUser(prisma, alici.userId, {
      title: icerik.baslik,
      body: icerik.govde,
      url: link,
      tag: `tutanak-${t.id}`,
    })
  } catch (err) {
    console.error('[tutanak-bildirim] push başarısız:', err)
  }
  return sonuc
}

/** 1. adım: tüm şahitlere PARALEL onay bildirimi. */
export async function sahitlereBildir(t: TutanakBildirimOzeti, sahitPersonnelIdler: string[]): Promise<number> {
  let gitti = 0
  for (const pid of sahitPersonnelIdler) {
    const a = await personelinKullanicisi(pid)
    if (!a) continue
    await gonder(a, t, {
      baslik: 'Şahit onayınız bekleniyor (tutanak)',
      govde: `${t.adSoyadSnapshot} hakkında tutulan ${t.tutanakNo} numaralı tutanakta şahit olarak onayınız bekleniyor.`,
      ctaEtiketi: 'Tutanağı incele',
    })
    gitti++
  }
  return gitti
}

/** 2. adım: seçilen yöneticiye onay bildirimi. */
export async function yoneticiyeBildir(t: TutanakBildirimOzeti, yoneticiPersonnelId: string): Promise<boolean> {
  const a = await personelinKullanicisi(yoneticiPersonnelId)
  if (!a) return false
  await gonder(a, t, {
    baslik: 'Yönetici onayınız bekleniyor (tutanak)',
    govde: `${t.adSoyadSnapshot} hakkında tutulan ${t.tutanakNo} numaralı tutanağın şahit onayları tamamlandı; yönetici onayı sizde.`,
    ctaEtiketi: 'Tutanağı onayla',
  })
  return true
}

/**
 * 2. adım (eş zamanlı): bilgilendirilen SON yönetici. Onay adımında DEĞİL —
 * mailde "onayla" düğmesi yok, dipnot bunu açıkça söyler.
 */
export async function sonYoneticiyeBildir(t: TutanakBildirimOzeti, sonYoneticiPersonnelId: string): Promise<boolean> {
  const a = await personelinKullanicisi(sonYoneticiPersonnelId)
  if (!a) return false
  await gonder(a, t, {
    baslik: 'Bilginize: tutanak yönetici onayına geçti',
    govde: `${t.adSoyadSnapshot} hakkında ${t.tutanakNo} numaralı tutanak düzenlendi ve yönetici onayına geçti.`,
    ctaEtiketi: 'Tutanağı görüntüle',
    dipnot: 'Bu bildirim yalnız bilgilendirme amaçlıdır; onay adımında yer almıyorsunuz.',
  })
  return true
}

/** 3. adım: İnsan Varlıkları ekibine kapanış bildirimi. */
export async function ivEkibineBildir(t: TutanakBildirimOzeti): Promise<number> {
  const alicilar = await resolveHRRecipients()
  const baslik = 'Tutanak İnsan Varlıkları kapanışı bekliyor'
  const govde = `${t.adSoyadSnapshot} hakkında ${t.tutanakNo} numaralı tutanak yönetici onayından geçti; kapanış İnsan Varlıkları'nda.`
  for (const a of alicilar) {
    await gonder({ userId: a.id, email: a.email, name: a.name }, t, {
      baslik,
      govde,
      ctaEtiketi: 'Tutanağı kapat',
    })
  }
  return alicilar.length
}

/** Ret ya da kapanış: tutanağı AÇANA sonuç bildirimi. */
export async function acanaSonucBildir(
  t: TutanakBildirimOzeti,
  acanUserId: string,
  sonuc: { tur: 'REDDEDILDI' | 'TAMAMLANDI'; kimAd: string; not: string | null },
): Promise<boolean> {
  const a = await userIdIleAlici(acanUserId)
  if (!a) return false
  const reddedildi = sonuc.tur === 'REDDEDILDI'
  await gonder(a, t, {
    baslik: reddedildi ? 'Tutanağınız reddedildi' : 'Tutanağınız tamamlandı',
    govde: reddedildi
      ? `${t.tutanakNo} numaralı tutanak ${sonuc.kimAd} tarafından reddedildi.${sonuc.not ? ` Not: ${sonuc.not}` : ''}`
      : `${t.tutanakNo} numaralı tutanak İnsan Varlıkları tarafından kapatıldı ve tamamlandı.`,
    ctaEtiketi: 'Tutanağı görüntüle',
  })
  return true
}
