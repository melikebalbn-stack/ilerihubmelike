/**
 * FİF (KAL-FR-10) bildirimleri — Faz 2. deneme-bildirim.ts deseni:
 * mail + in-app tek yerden; sentetik bluecollar adresi → mail atlanır, in-app
 * düşer, uyarı loglanır. Tek alıcıya `fifBildirimGonder`, olay bazlı yardımcılar
 * `fifDurumBildir` içinde. Mail patlarsa in-app yine oluşur (best-effort).
 */
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { sentetikMailMi } from '@/lib/bluecollar-email'
import { FifDurum } from '@/generated/prisma'

const BASE_URL = process.env.NEXTAUTH_URL || 'https://hub.ilerigroup.com'

type Alici = { userId: string; email: string; name: string; sentetik: boolean }

/** User id → Alici. Aktif değilse / mailsizse null. */
async function aliciCoz(userId: string | null | undefined): Promise<Alici | null> {
  if (!userId) return null
  const u = await prisma.user.findFirst({
    where: { id: userId, isActive: true },
    select: { id: true, email: true, name: true, personnel: { select: { adSoyad: true } } },
  })
  if (!u?.email) return null
  return { userId: u.id, email: u.email, name: u.name || u.personnel?.adSoyad || u.email, sentetik: sentetikMailMi(u.email) }
}

/** Sorumlu bölüm müdürünün User'ı (izleme/sorumlu bölüm bildirimi için). */
async function bolumMudurAlicisi(bolumId: string | null): Promise<Alici | null> {
  if (!bolumId) return null
  const dept = await prisma.departmentDefinition.findUnique({ where: { id: bolumId }, select: { mudurId: true } })
  if (!dept?.mudurId) return null
  const u = await prisma.user.findFirst({ where: { personnelId: dept.mudurId, isActive: true }, select: { id: true } })
  return u ? aliciCoz(u.id) : null
}

/** fif.manage sahipleri (takip sorumlusu boşsa ETKINLIK bildirimi için fallback). */
async function manageAlicilari(): Promise<Alici[]> {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      userRoles: { some: { role: { rolePermissions: { some: { permission: { key: 'fif.manage' } } } } } },
    },
    select: { id: true, email: true, name: true, personnel: { select: { adSoyad: true } } },
  })
  return users.filter((u) => !!u.email).map((u) => ({
    userId: u.id, email: u.email as string, name: u.name || u.personnel?.adSoyad || (u.email as string),
    sentetik: sentetikMailMi(u.email as string),
  }))
}

export type FifBildirimSonuc = { hedefSayisi: number; mailGiden: number; mailAtlanan: string[]; inApp: number }

/** Tek alıcıya mail+in-app. Sentetik → mail atla, in-app oluştur. */
async function gonder(alici: Alici, konu: string, govde: string, link: string, sonuc: FifBildirimSonuc) {
  sonuc.hedefSayisi++
  const html = `<p>${govde.replace(/\n/g, '<br>')}</p><p><a href="${BASE_URL}${link}">FİF'i aç</a></p>`
  if (alici.sentetik) {
    try {
      await prisma.notification.create({ data: { userId: alici.userId, title: konu, message: govde, type: 'INFO', link } })
      sonuc.inApp++
    } catch (e) { console.error('[fif-bildirim] in-app:', e) }
    sonuc.mailAtlanan.push(alici.email)
    console.warn('[fif-bildirim] sentetik adres — mail atlandi, in-app olusturuldu:', alici.email)
    return
  }
  const [mailRes, inAppRes] = await Promise.allSettled([
    sendEmail([{ name: alici.name, email: alici.email }], konu, govde, html),
    prisma.notification.create({ data: { userId: alici.userId, title: konu, message: govde, type: 'INFO', link } }),
  ])
  if (inAppRes.status === 'fulfilled') sonuc.inApp++
  else console.error('[fif-bildirim] in-app:', inAppRes.reason)
  if (mailRes.status === 'fulfilled' && mailRes.value?.success) sonuc.mailGiden++
  else console.error('[fif-bildirim] mail gonderilemedi:', mailRes.status === 'rejected' ? mailRes.reason : mailRes.value?.error)
}

type FifBildirimGirdi = {
  id: string
  kayitNo: string
  sorumluBolumId: string | null
  hazirlayanUserId: string | null
  createdById: string | null
  yayinlayanOnaylayanUserId: string | null
  sorumluOnaylayanUserId: string | null
  izlemeSorumlusuUserId: string | null
  takipSorumlusuUserId: string | null
}

const KONU = (kayitNo: string, olay: string) => `[FİF ${kayitNo}] ${olay}`

/**
 * Durum geçişi sonrası ilgili tarafı bilgilendir. `yeniDurum` olaya göre alıcı seçer.
 * red/iptal/KAPANDI → hazırlayana.
 */
export async function fifDurumBildir(
  fif: FifBildirimGirdi, yeniDurum: FifDurum, opts: { red?: boolean; iptal?: boolean } = {},
): Promise<FifBildirimSonuc> {
  const sonuc: FifBildirimSonuc = { hedefSayisi: 0, mailGiden: 0, mailAtlanan: [], inApp: 0 }
  const link = `/kalite/fif/${fif.id}`
  const hazirlayan = fif.hazirlayanUserId ?? fif.createdById

  const push = async (a: Alici | null, olay: string, govde: string) => {
    if (a) await gonder(a, KONU(fif.kayitNo, olay), govde, link, sonuc)
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
      await push(await aliciCoz(fif.yayinlayanOnaylayanUserId), 'Onayınız bekleniyor', 'Bir FİF onayınıza sunuldu.')
      break
    case FifDurum.FAALIYET: {
      await push(await aliciCoz(fif.izlemeSorumlusuUserId), 'Faaliyet aşaması', 'FİF faaliyet aşamasına geçti (izleme).')
      const mudur = await bolumMudurAlicisi(fif.sorumluBolumId)
      if (mudur && mudur.userId !== fif.izlemeSorumlusuUserId) await push(mudur, 'Faaliyet aşaması', 'Bölümünüzde bir FİF faaliyet aşamasına geçti.')
      break
    }
    case FifDurum.KAPATMA_BEKLIYOR:
      await push(await aliciCoz(fif.sorumluOnaylayanUserId), 'Kapatma onayı bekleniyor', 'FİF kapatma onayınıza sunuldu.')
      break
    case FifDurum.ETKINLIK: {
      const takip = await aliciCoz(fif.takipSorumlusuUserId)
      if (takip) await push(takip, 'Etkinlik değerlendirmesi', 'FİF etkinlik değerlendirmesi bekleniyor.')
      else for (const m of await manageAlicilari()) await push(m, 'Etkinlik değerlendirmesi', 'Takip sorumlusu atanmamış FİF etkinlik değerlendirmesi bekliyor.')
      break
    }
    case FifDurum.KAPANDI:
      await push(await aliciCoz(hazirlayan), 'Kapandı', 'FİF kapandı (etkinlik onaylandı).')
      break
    default:
      break
  }
  return sonuc
}
