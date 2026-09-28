import 'server-only'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { esc, logoAttachments, p, quote, renderEmail } from '@/lib/email-templates/layout'
import { ileriHubUrl } from '@/lib/email-templates/akademi/_base'
import { fmt } from './talep-kurallari'

/**
 * İzin bildirimleri — Hub standart şablonu (renderEmail, modül "İnsan Varlıkları"). Plan §4.3:
 *   talep → onaycıya (yönetici kademesi: 1-3 yönetici; İV kademesi: İV alıcıları)
 *   yönetici onayı → İV · onay/red → çalışan (red gerekçesi maile girer) · İV onayı → çalışan + yönetici
 *   geri çekme / iptal → bekleyen onaycı + çalışan
 * KURAL: YÖNETİCİYE giden mailde İZİN TÜRÜ YOK ("İzin talebi"); tür yalnız çalışanın kendisine ve İV'ye.
 * Mail hatası akışı DURDURMAZ (log). Hatırlatma bu fazda YOK.
 * İV alıcıları: SystemSetting izin_iv_bildirim_eposta (virgüllü) doluysa o; yoksa izin.admin sahibi aktif kullanıcılar.
 */

export interface MailTalep {
  id: string
  personelAd: string
  sicil: string | null
  turAd: string
  baslangic: string
  bitis: string
  gunSayisi: number
}

type Alici = { email: string; name: string }

const tarih = (g: string) => `${g.slice(8, 10)}.${g.slice(5, 7)}.${g.slice(0, 4)}`
const aralik = (t: MailTalep) => (t.baslangic === t.bitis ? tarih(t.baslangic) : `${tarih(t.baslangic)} – ${tarih(t.bitis)}`)

async function kullanicilar(ids: (string | null | undefined)[]): Promise<Alici[]> {
  const temiz = [...new Set(ids.filter((x): x is string => !!x && x !== 'sistem'))]
  if (!temiz.length) return []
  const us = await prisma.user.findMany({ where: { id: { in: temiz }, isActive: true }, select: { email: true, name: true } })
  return us.filter((u) => u.email).map((u) => ({ email: u.email, name: u.name ?? u.email }))
}

export async function ivAlicilari(): Promise<Alici[]> {
  const ayar = await prisma.systemSetting.findUnique({ where: { key: 'izin_iv_bildirim_eposta' }, select: { value: true } })
  const liste = (ayar?.value ?? '').split(',').map((s) => s.trim()).filter((s) => /@/.test(s))
  if (liste.length) return liste.map((email) => ({ email, name: email }))
  const us = await prisma.user.findMany({
    where: {
      isActive: true,
      userRoles: {
        some: {
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          role: { rolePermissions: { some: { permission: { key: 'izin.admin' } } } },
        },
      },
    },
    select: { email: true, name: true },
  })
  return us.filter((u) => u.email).map((u) => ({ email: u.email, name: u.name ?? u.email }))
}

async function gonder(alicilar: Alici[], o: { konu: string; baslik: string; altBaslik?: string; satirlar: { label: string; value: string }[]; govde?: string; sonra?: string; link: string; buton: string }) {
  if (!alicilar.length) return
  try {
    const { html, text } = renderEmail({
      module: 'İnsan Varlıkları',
      title: o.baslik,
      subtitle: o.altBaslik,
      preheader: o.konu,
      bodyHtml: o.govde,
      infoRows: o.satirlar,
      afterHtml: o.sonra,
      cta: { label: o.buton, url: ileriHubUrl(o.link) },
    })
    for (const a of alicilar) {
      const r = await sendEmail([a], o.konu, text, html, logoAttachments())
      if (!r.success) console.warn(`[izin-mail] gönderilemedi (${o.konu}): ${r.error ?? 'bilinmiyor'}`)
    }
  } catch (e) {
    console.error('[izin-mail] hata', e)
  }
}

/** Yöneticiye / ekibe giden satırlar — TÜR YOK. */
export const yoneticiSatirlari = (t: MailTalep) => [
  { label: 'Personel', value: `<strong>${esc(t.personelAd)}</strong>${t.sicil ? ` · ${esc(t.sicil)}` : ''}` },
  { label: 'Tarih', value: esc(aralik(t)) },
  { label: 'Süre', value: `${esc(fmt(t.gunSayisi))} gün` },
]
/** Çalışana ve İV'ye giden satırlar — tür dahil. */
export const tamSatirlar = (t: MailTalep) => [
  { label: 'Personel', value: `<strong>${esc(t.personelAd)}</strong>${t.sicil ? ` · ${esc(t.sicil)}` : ''}` },
  { label: 'Tür', value: esc(t.turAd) },
  { label: 'Tarih', value: esc(aralik(t)) },
  { label: 'Süre', value: `${esc(fmt(t.gunSayisi))} gün` },
]

export async function yoneticiyeTalep(t: MailTalep, yoneticiIdleri: (string | null)[]) {
  await gonder(await kullanicilar(yoneticiIdleri), {
    konu: `İzin talebi onayınızı bekliyor — ${t.personelAd}`,
    baslik: 'İzin talebi onayınızı bekliyor',
    altBaslik: `${t.personelAd} · ${aralik(t)}`,
    satirlar: yoneticiSatirlari(t),
    link: '/izin/onay',
    buton: 'Onay Bekleyenler',
  })
}

export async function iveTalep(t: MailTalep, not?: string) {
  await gonder(await ivAlicilari(), {
    konu: `İzin talebi İV onayında — ${t.personelAd}`,
    baslik: 'İzin talebi İV onayını bekliyor',
    altBaslik: `${t.personelAd} · ${t.turAd}`,
    satirlar: tamSatirlar(t),
    sonra: not ? p(esc(not)) : undefined,
    link: '/izin/onay',
    buton: 'Onay Bekleyenler',
  })
}

export async function calisanaSonuc(t: MailTalep, calisanUserId: string | null, o: { karar: 'ONAY' | 'RED'; kademe: 'YONETICI' | 'IV'; gerekce: string | null }) {
  const onaylandi = o.karar === 'ONAY' && o.kademe === 'IV'
  const baslik = o.karar === 'RED' ? 'İzin talebiniz reddedildi' : onaylandi ? 'İzin talebiniz onaylandı' : 'İzin talebiniz yöneticiniz tarafından onaylandı'
  await gonder(await kullanicilar([calisanUserId]), {
    konu: `${baslik} — ${aralik(t)}`,
    baslik,
    altBaslik: o.karar === 'ONAY' && !onaylandi ? 'Talep İnsan Varlıkları onayına gönderildi' : undefined,
    satirlar: tamSatirlar(t),
    sonra: o.karar === 'RED' && o.gerekce ? quote(esc(o.gerekce), 'Red gerekçesi') : undefined,
    link: '/izin/talebim',
    buton: 'İzinlerim',
  })
}

/** İV onayı sonrası yöneticiye bilgi — TÜR YOK. */
export async function yoneticiyeBilgi(t: MailTalep, yoneticiIdleri: (string | null)[]) {
  await gonder(await kullanicilar(yoneticiIdleri), {
    konu: `Ekibinizden izin onaylandı — ${t.personelAd}`,
    baslik: 'Ekibinizden bir izin onaylandı',
    altBaslik: `${t.personelAd} · ${aralik(t)}`,
    satirlar: yoneticiSatirlari(t),
    link: '/izin/onay?sekme=karar',
    buton: 'İzin Onaylarım',
  })
}

/** Geri çekme / iptal → bekleyen onaycı (yönetici ise türsüz) + çalışan. */
export async function iptalBildir(t: MailTalep, o: { calisanUserId: string | null; bekleyenYoneticiler: (string | null)[]; ivBekliyordu: boolean; neden: string }) {
  const baslik = 'İzin talebi geri çekildi / iptal edildi'
  await gonder(await kullanicilar(o.bekleyenYoneticiler), {
    konu: `${baslik} — ${t.personelAd}`, baslik, altBaslik: t.personelAd, satirlar: yoneticiSatirlari(t), link: '/izin/onay', buton: 'Onay Bekleyenler',
  })
  if (o.ivBekliyordu) {
    await gonder(await ivAlicilari(), { konu: `${baslik} — ${t.personelAd}`, baslik, altBaslik: t.personelAd, satirlar: tamSatirlar(t), sonra: p(esc(o.neden)), link: '/izin/onay', buton: 'Onay Bekleyenler' })
  }
  await gonder(await kullanicilar([o.calisanUserId]), {
    konu: `${baslik} — ${aralik(t)}`, baslik, satirlar: tamSatirlar(t), sonra: p(esc(o.neden)), link: '/izin/talebim', buton: 'İzinlerim',
  })
}
