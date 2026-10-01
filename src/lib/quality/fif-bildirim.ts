/**
 * FİF (KAL-FR-10) bildirimleri — TEK KANAL KATMANI.
 *
 * Her bildirim üç BAĞIMSIZ kanal (Promise.allSettled — biri patlarsa diğerleri ve
 * durum geçişi etkilenmez):
 *  · in-app  — Notification.link → /kalite/fif/{id} (zilden tıklanınca sayfaya gider)
 *  · push    — Avans deseni: pushSubscription.count, sonra `sendPushToUser` doğrudan
 *              (createNotificationWithPush KULLANILMAZ — bug'lı)
 *  · mail    — hub/main yöntemi aynen: renderEmail (Kalite şablonu + "FİF'i aç") +
 *              sendEmail + logo; sentetik bluecollar adreste mail ATLANIR.
 * Durum geçişi, satır işlemleri (kapat / ek termin / etkinlik / müdüre bilgi) ve iki
 * cron (hatırlatma, eskalasyon) hep `fifKullaniciyaBildir`'den geçer.
 */
import { prisma } from '@/lib/prisma'
import { sendPushToUser } from '@/lib/push-notifications'
import { sendEmail } from '@/lib/email'
import { sentetikMailMi } from '@/lib/bluecollar-email'
import { renderEmail, p, esc, logoAttachments } from '@/lib/email-templates/layout'
import { acaninBolumMuduru, kssKoltukKullanicilari } from '@/lib/quality/fif-zincir'
import { fifEtiket } from '@/lib/quality/fif-durum-etiket'
import { FifDurum, type NotificationType } from '@/generated/prisma'

const BASE_URL = process.env.NEXTAUTH_URL || 'https://hub.ilerigroup.com'

type Alici = { userId: string; ad: string }

/** User id → Alici. Aktif değilse null. (E-posta şartı YOK — mail kanalı kendisi bakar.) */
async function aliciCoz(userId: string | null | undefined): Promise<Alici | null> {
  if (!userId) return null
  const u = await prisma.user.findFirst({
    where: { id: userId, isActive: true },
    select: { id: true, name: true, email: true, personnel: { select: { adSoyad: true } } },
  })
  if (!u) return null
  return { userId: u.id, ad: u.name || u.personnel?.adSoyad || u.email || u.id }
}

/** Sorumlu bölüm müdürünün User'ı (izleme/sorumlu bölüm bildirimi için). */
async function bolumMudurAlicisi(bolumId: string | null): Promise<Alici | null> {
  if (!bolumId) return null
  const dept = await prisma.departmentDefinition.findUnique({ where: { id: bolumId }, select: { mudurId: true } })
  if (!dept?.mudurId) return null
  const u = await prisma.user.findFirst({ where: { personnelId: dept.mudurId, isActive: true }, select: { id: true } })
  return u ? aliciCoz(u.id) : null
}

/** fif.manage sahipleri (KSS hiç yoksa ETKINLIK bildirimi için fallback). */
async function manageAlicilari(): Promise<Alici[]> {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      userRoles: { some: { role: { rolePermissions: { some: { permission: { key: 'fif.manage' } } } } } },
    },
    select: { id: true, name: true, email: true, personnel: { select: { adSoyad: true } } },
  })
  return users.map((u) => ({ userId: u.id, ad: u.name || u.personnel?.adSoyad || u.email || u.id }))
}

/** Push — abonelik yoksa sessizce atlanır. Hata fırlatabilir; çağıran allSettled ile yutar. */
async function fifPushGonder(userId: string, baslik: string, govde: string, link: string): Promise<number> {
  const abonelik = await prisma.pushSubscription.count({ where: { userId } })
  if (abonelik === 0) return 0
  return sendPushToUser(prisma, userId, { title: baslik, body: govde, url: link, data: { link } })
}

/** Mail kanalının sonucu: gitti · atlandı (sentetik adres) · yok (aktif kullanıcı/e-posta yok). */
export type FifMailSonuc = 'gitti' | 'atlandi' | 'yok'

/**
 * Mail — hub/main yöntemi. Alıcı aktif değil / e-postası yoksa 'yok'; sentetik
 * bluecollar adresse 'atlandi' (uyarı loglanır). Gönderim başarısızsa HATA fırlatır;
 * çağıran allSettled ile yutar (diğer kanallar etkilenmez).
 */
async function fifMailGonder(userId: string, baslik: string, govde: string, link: string): Promise<FifMailSonuc> {
  const u = await prisma.user.findFirst({
    where: { id: userId, isActive: true },
    select: { email: true, name: true, personnel: { select: { adSoyad: true } } },
  })
  if (!u?.email) return 'yok'
  if (sentetikMailMi(u.email)) {
    console.warn('[fif-bildirim] sentetik adres — mail atlandi:', u.email)
    return 'atlandi'
  }
  const { html, text } = renderEmail({
    module: 'Kalite',
    title: baslik,
    bodyHtml: p(esc(govde).replace(/\n/g, '<br>')),
    cta: { label: "FİF'i aç", url: `${BASE_URL}${link}` },
  })
  const r = await sendEmail([{ name: u.name || u.personnel?.adSoyad || u.email, email: u.email }], baslik, text, html, logoAttachments())
  if (!r?.success) throw new Error(`mail gonderilemedi: ${r?.error ?? 'bilinmeyen hata'}`)
  return 'gitti'
}

export type FifTekBildirimSonuc = { inApp: boolean; push: number; mail: FifMailSonuc | 'hata' }

/**
 * Tek alıcıya in-app + push + mail (bağımsız kanallar). FİF bildirimlerinin TEK
 * giriş noktası — durum geçişi, satır işlemleri ve cron'lar (hatırlatma/eskalasyon).
 */
export async function fifKullaniciyaBildir(
  userId: string,
  baslik: string,
  govde: string,
  link: string,
  type: NotificationType = 'INFO',
): Promise<FifTekBildirimSonuc> {
  const [inApp, push, mail] = await Promise.allSettled([
    prisma.notification.create({ data: { userId, title: baslik, message: govde, type, link } }),
    fifPushGonder(userId, baslik, govde, link),
    fifMailGonder(userId, baslik, govde, link),
  ])
  if (inApp.status === 'rejected') console.error('[fif-bildirim] in-app:', inApp.reason)
  if (push.status === 'rejected') console.error('[fif-bildirim] push:', push.reason)
  if (mail.status === 'rejected') console.error('[fif-bildirim] mail:', mail.reason)
  return {
    inApp: inApp.status === 'fulfilled',
    push: push.status === 'fulfilled' ? push.value : 0,
    mail: mail.status === 'fulfilled' ? mail.value : 'hata',
  }
}

export type FifBildirimSonuc = { hedefSayisi: number; inApp: number; push: number; mailGiden: number; mailAtlanan: number }

type FifBildirimGirdi = {
  id: string
  /** Paket 3: "Kayda Al"a kadar NULL → başlıkta "Taslak" (fifEtiket). */
  kayitNo: string | null
  /** Geçiş ÖNCESİ durum — "Onaya Gönder" (TASLAK→KSS_KAYIT) müdür bilgisini ayırt eder. */
  durum: FifDurum
  sorumluBolumId: string | null
  hazirlayanUserId: string | null
  createdById: string | null
  yayinlayanOnaylayanUserId: string | null
  izlemeSorumlusuUserId: string | null
  uygunsuzlukTanimi: string | null
  /** Paket 3b-2: KAPANDI bildirimi açan kişiye + faaliyet satırı sorumlularına gider. */
  faaliyetSorumluIdleri?: string[]
}

/** Bildirim başlığı — cron'lar da aynı kalıbı kullanır: `[FİF <no|Taslak>] <olay>`. */
export const fifBildirimKonusu = (fif: { kayitNo: string | null }, olay: string) => `[FİF ${fifEtiket(fif)}] ${olay}`

/** Tespit metninin bildirimde gösterilecek kısa özeti. */
function tespitOzeti(metin: string | null, azami = 120): string {
  const t = (metin ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return '(tespit girilmemiş)'
  return t.length > azami ? `${t.slice(0, azami - 1)}…` : t
}

/**
 * Durum geçişi sonrası ilgili tarafı bilgilendir. `yeniDurum` olaya göre alıcı seçer.
 * red/iptal/KAPANDI → hazırlayana. KSS olayları → KSS koltuklarındaki HERKESE.
 */
export async function fifDurumBildir(
  fif: FifBildirimGirdi, yeniDurum: FifDurum, opts: { red?: boolean; iptal?: boolean } = {},
): Promise<FifBildirimSonuc> {
  const sonuc: FifBildirimSonuc = { hedefSayisi: 0, inApp: 0, push: 0, mailGiden: 0, mailAtlanan: 0 }
  const link = `/kalite/fif/${fif.id}`
  const hazirlayan = fif.hazirlayanUserId ?? fif.createdById

  // Aynı olayda bir kişiye tek bildirim (ör. izleme sorumlusu = müdür).
  const gonderilen = new Set<string>()
  const push = async (a: Alici | null, olay: string, govde: string) => {
    if (!a || gonderilen.has(a.userId)) return
    gonderilen.add(a.userId)
    sonuc.hedefSayisi++
    const r = await fifKullaniciyaBildir(a.userId, fifBildirimKonusu(fif, olay), govde, link)
    if (r.inApp) sonuc.inApp++
    sonuc.push += r.push
    if (r.mail === 'gitti') sonuc.mailGiden++
    else if (r.mail === 'atlandi') sonuc.mailAtlanan++
  }
  const kssHepsine = async (olay: string, govde: string) => {
    for (const k of await kssKoltukKullanicilari(prisma)) await push({ userId: k.userId, ad: k.ad }, olay, govde)
  }

  if (opts.iptal) {
    await push(await aliciCoz(hazirlayan), 'İptal edildi', 'FİF iptal edildi.')
    return sonuc
  }
  if (opts.red) {
    await push(await aliciCoz(hazirlayan), 'Reddedildi', 'FİF reddedildi, düzeltmeniz bekleniyor.')
    return sonuc
  }

  switch (yeniDurum) {
    case FifDurum.ONAY_BEKLIYOR:
      // Paket 2: yeni kayıt bu duruma girmez; eski kayıtlar için korunur.
      await push(await aliciCoz(fif.yayinlayanOnaylayanUserId), 'Onayınız bekleniyor', 'Bir FİF onayınıza sunuldu.')
      break
    case FifDurum.KSS_KAYIT_BEKLIYOR: {
      await kssHepsine('Kaydınız bekleniyor', 'Bir FİF kayda alınmayı ve sorumlu bölüme yönlendirilmeyi bekliyor.')
      // "Onaya Gönder" (TASLAK'tan): açan kişinin bölüm müdürüne BİLGİ (onay değil).
      // Açan kişi müdürün kendisiyse / müdür çözülemezse gönderilmez.
      if (fif.durum === FifDurum.TASLAK) {
        const mudur = await acaninBolumMuduru(prisma, hazirlayan)
        if (mudur) {
          const acan = await aliciCoz(hazirlayan)
          await push(
            { userId: mudur.userId, ad: mudur.ad },
            'Yeni FİF açıldı',
            `${acan?.ad ?? 'Bir kullanıcı'} yeni bir FİF açtı: ${tespitOzeti(fif.uygunsuzlukTanimi)}`,
          )
        }
      }
      break
    }
    case FifDurum.FAALIYET: {
      await push(await aliciCoz(fif.izlemeSorumlusuUserId), 'Faaliyet aşaması', 'FİF faaliyet aşamasına geçti (izleme).')
      await push(await bolumMudurAlicisi(fif.sorumluBolumId), 'Faaliyet aşaması', 'Bölümünüzde bir FİF faaliyet aşamasına geçti.')
      break
    }
    case FifDurum.KAPATMA_BEKLIYOR:
      // FAZ B: kapatmayı YAYINLAYAN (uygunsuzluğu açan) bölüm müdürü onaylar.
      await push(await aliciCoz(fif.yayinlayanOnaylayanUserId), 'Kapatma onayı bekleniyor', 'FİF kapatma onayınıza sunuldu.')
      break
    case FifDurum.KSS_KAPANIS_BEKLIYOR:
      await kssHepsine('Kapanış kontrolü bekleniyor', 'FİF kapanış kontrolü (yayılım + KYS/risk kararı) bekliyor.')
      break
    case FifDurum.ETKINLIK: {
      // Paket 2: takip sorumlusu kalktı; etkinlik değerlendirmesi + kapatma KSS'de.
      const onceki = sonuc.hedefSayisi
      await kssHepsine('Etkinlik değerlendirmesi', 'FİF etkinlik izlemesine geçti; etkinlik değerlendirmesi bekleniyor.')
      if (sonuc.hedefSayisi === onceki) {
        for (const m of await manageAlicilari()) await push(m, 'Etkinlik değerlendirmesi', 'KSS tanımlı olmayan FİF etkinlik değerlendirmesi bekliyor.')
      }
      break
    }
    case FifDurum.KAPANDI:
      await push(await aliciCoz(hazirlayan), 'Kapandı', 'FİF kapandı (etkinlik onaylandı).')
      for (const s of fif.faaliyetSorumluIdleri ?? []) {
        await push(await aliciCoz(s), 'Kapandı', 'Sorumlu olduğunuz faaliyetlerin yer aldığı FİF kapandı (etkinlik onaylandı).')
      }
      break
    default:
      break
  }
  return sonuc
}
