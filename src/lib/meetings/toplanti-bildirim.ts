// Toplantı modülü — bildirim katmanı (davet · karar · tutanak · gecikme).
//
// 28.09.2026 ölçümü: modülde HİÇBİR bildirim yoktu — ne mail, ne in-app, ne push,
// ne cron. `git log --all -S"sendEmail" -- src/app/api/meetings/` hiçbir commit
// döndürmüyordu, yani kod yazılmamıştı (kapalı bayrak değil). Buna rağmen veri
// modeli bir bildirim akışı VARSAYIYORDU: `MeetingAttendee.inviteStatus`
// (19 katılımcının 19'u da PENDING) ve `DecisionStatus.OVERDUE` (hiçbir kod set
// etmiyordu). Bu dosya o boşluğu kapatır.
//
// Desen: src/lib/quality/fif-bildirim.ts ve src/lib/deneme/deneme-bildirim.ts —
// mail + in-app + push tek yerden, sentetik mavi yaka adresinde mail ATLANIR
// ama in-app YİNE oluşur, gövde hub-mail-v1 ortak şablonundan (renderEmail).
//
// BLOKE ETMEZ: çağıranlar bu fonksiyonları COMMIT SONRASI çağırır ve sonucu
// yalnız raporlar; bildirim patlasa da kayıt geçerlidir.

import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { sentetikMailMi } from '@/lib/bluecollar-email'
import { sendPushToUser } from '@/lib/push-notifications'
import {
  renderEmail, p, esc, dataTable, sectionTitle, logoAttachments,
} from '@/lib/email-templates/layout'

const BASE_URL = process.env.NEXTAUTH_URL || 'https://hub.ilerigroup.com'

/** Bildirim alıcısı. `sentetik` → posta kutusu YOK, mail adımı atlanır. */
type Alici = { userId: string; email: string; name: string; sentetik: boolean }

export type GonderimSonuc = { mail: boolean; inApp: boolean }
export type AkisSonuc = {
  /** Bildirim gönderilen alıcı sayısı (mail ya da in-app birine ulaşan). */
  bildirilen: number
  /** User hesabı olmadığı için atlanan katılımcı sayısı (harici/LDAP'sız). */
  atlanan: number
  /** Sentetik adres yüzünden maili ulaşmayanlar (in-app oluşturuldu). */
  mailUlasmayan: string[]
}

const BOS_SONUC: AkisSonuc = { bildirilen: 0, atlanan: 0, mailUlasmayan: [] }

function aliciyaCevir(u: { id: string; email: string | null; name: string | null }): Alici | null {
  if (!u.email) return null
  return { userId: u.id, email: u.email, name: u.name || u.email, sentetik: sentetikMailMi(u.email) }
}

/** Personnel id → aktif User. Hesap yoksa null (harici katılımcı, LDAP'sız mavi yaka). */
async function userIdenAlici(userId: string | null | undefined): Promise<Alici | null> {
  if (!userId) return null
  const u = await prisma.user.findFirst({
    where: { id: userId, isActive: true },
    select: { id: true, email: true, name: true },
  })
  return u ? aliciyaCevir(u) : null
}

/**
 * Tek alıcıya mail + in-app + push. Biri patlarsa diğeri devam eder.
 * Sentetik adreste mail ATLANIR, in-app yine oluşur — kullanıcı sisteme
 * giriyor, orada görür (deneme/fif deseninin aynısı).
 */
async function gonder(
  alici: Alici, konu: string, metin: string, html: string, link: string, inAppBaslik: string,
): Promise<GonderimSonuc> {
  const inAppYaz = async () => {
    await prisma.notification.create({
      data: { userId: alici.userId, title: inAppBaslik, message: konu, type: 'INFO', link },
    })
    // Push in-app'e BAĞLI ve best-effort: aboneliği olmayan/patlayan kullanıcı
    // bildirimi yine de uygulama içinde görür.
    try {
      await sendPushToUser(prisma, alici.userId, { title: inAppBaslik, body: konu, url: link })
    } catch (e) {
      console.warn('[toplanti-bildirim] push:', e)
    }
  }

  if (alici.sentetik) {
    let inApp = false
    try { await inAppYaz(); inApp = true } catch (e) { console.error('[toplanti-bildirim] in-app:', e) }
    console.warn('[toplanti-bildirim] sentetik adres — mail atlandi, in-app olusturuldu:', alici.email)
    return { mail: false, inApp }
  }

  const [mailRes, inAppRes] = await Promise.allSettled([
    sendEmail([{ name: alici.name, email: alici.email }], konu, metin, html, logoAttachments()),
    inAppYaz(),
  ])
  const inApp = inAppRes.status === 'fulfilled'
  if (inAppRes.status === 'rejected') console.error('[toplanti-bildirim] in-app:', inAppRes.reason)
  if (mailRes.status === 'rejected') {
    console.error('[toplanti-bildirim] mail:', mailRes.reason)
    return { mail: false, inApp }
  }
  if (!mailRes.value?.success) {
    console.error('[toplanti-bildirim] mail gonderilemedi:', mailRes.value?.error)
    return { mail: false, inApp }
  }
  return { mail: true, inApp }
}

/** Bir alıcı listesine aynı içeriği dağıtır, sonucu özetler. */
async function dagit(
  alicilar: Alici[], atlanan: number, konu: string, metin: string, html: string, link: string, inAppBaslik: string,
): Promise<AkisSonuc> {
  const sonuc: AkisSonuc = { bildirilen: 0, atlanan, mailUlasmayan: [] }
  for (const a of alicilar) {
    const r = await gonder(a, konu, metin, html, link, inAppBaslik)
    if (r.mail || r.inApp) sonuc.bildirilen++
    if (!r.mail && r.inApp) sonuc.mailUlasmayan.push(a.email)
  }
  return sonuc
}

// ── Ortak biçimlendirme ─────────────────────────────────────────────────────
const tarihTR = (d: Date | null | undefined) => (d ? d.toLocaleDateString('tr-TR') : '—')
const saatTR = (d: Date | null | undefined) =>
  d ? d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : null

const ONCELIK_ETIKET: Record<string, string> = {
  LOW: 'Düşük', MEDIUM: 'Orta', HIGH: 'Yüksek', URGENT: 'Acil',
}

function saatAraligi(baslangic: Date | null, bitis: Date | null): string {
  const b = saatTR(baslangic)
  const s = saatTR(bitis)
  if (b && s) return `${b} – ${s}`
  return b ?? '—'
}

/** Toplantının bildirim alacak katılımcıları + User'ı olmadığı için atlananlar. */
async function toplantiAlicilari(meetingId: string): Promise<{ alicilar: Alici[]; atlanan: number }> {
  const katilimcilar = await prisma.meetingAttendee.findMany({
    where: { meetingId },
    select: { userId: true, user: { select: { id: true, email: true, name: true, isActive: true } } },
  })
  const alicilar: Alici[] = []
  let atlanan = 0
  for (const k of katilimcilar) {
    // Harici katılımcı (userId null) ya da pasif hesap → bildirim gönderilmez.
    if (!k.user || !k.user.isActive) { atlanan++; continue }
    const a = aliciyaCevir(k.user)
    if (a) alicilar.push(a); else atlanan++
  }
  // Aynı kullanıcı iki kez eklenmişse tek bildirim.
  return { alicilar: [...new Map(alicilar.map((a) => [a.userId, a])).values()], atlanan }
}

// ── 1) TOPLANTI DAVETİ ──────────────────────────────────────────────────────

/** Mail gövdesi — ALICIDAN BAĞIMSIZ. Önizleme betiği de bunu çağırır, böylece
 *  önizleme ile kullanıcıya giden gövde arasında sürüklenme olmaz. */
export type MailIcerik = { konu: string; html: string; text: string; link: string; inAppBaslik: string }

export async function davetIcerigi(meetingId: string): Promise<MailIcerik | null> {
  const m = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: {
      id: true, meetingNumber: true, title: true, description: true,
      scheduledDate: true, startTime: true, endTime: true,
      location: true, isOnline: true, onlineLink: true,
      chairman: { select: { name: true } },
      organizer: { select: { name: true } },
      agendaItems: { orderBy: { orderNo: 'asc' }, select: { orderNo: true, title: true, plannedDuration: true } },
    },
  })
  if (!m) return null

  const link = `${BASE_URL}/meetings/${m.id}`
  const gundem = m.agendaItems.length
    ? sectionTitle('Gündem') + dataTable(
        ['#', 'Konu', 'Süre'],
        m.agendaItems.map((g) => [
          String(g.orderNo),
          esc(g.title),
          g.plannedDuration ? `${g.plannedDuration} dk` : '—',
        ]),
        ['left', 'left', 'right'],
      )
    : ''

  const { html, text } = renderEmail({
    module: 'Toplantı',
    title: 'Toplantı daveti',
    subtitle: `${m.meetingNumber} · ${m.title}`,
    preheader: `${m.title} — ${tarihTR(m.scheduledDate)}`,
    bodyHtml: p(
      `<strong>${esc(m.title)}</strong> toplantısına katılımcı olarak eklendiniz.` +
      (m.description ? ` ${esc(m.description)}` : ''),
    ),
    infoRows: [
      { label: 'Tarih', value: esc(tarihTR(m.scheduledDate)) },
      { label: 'Saat', value: esc(saatAraligi(m.startTime, m.endTime)) },
      {
        label: m.isOnline ? 'Çevrim içi' : 'Yer',
        value: m.isOnline
          ? (m.onlineLink ? `<a href="${esc(m.onlineLink)}">${esc(m.onlineLink)}</a>` : 'Bağlantı paylaşılacak')
          : esc(m.location || '—'),
      },
      { label: 'Başkan', value: esc(m.chairman?.name || '—') },
      { label: 'Organizatör', value: esc(m.organizer?.name || '—') },
    ],
    afterHtml: gundem,
    cta: { label: 'Toplantıyı Aç', url: link },
  })

  return {
    konu: `📅 Toplantı Daveti — ${m.title} (${tarihTR(m.scheduledDate)})`,
    html, text, link, inAppBaslik: 'Toplantı daveti',
  }
}

/** Toplantı oluşturulunca katılımcılara davet. Katılımcı yoksa sessizce çıkar. */
export async function toplantiDavetiGonder(meetingId: string): Promise<AkisSonuc> {
  const icerik = await davetIcerigi(meetingId)
  if (!icerik) return BOS_SONUC
  const { alicilar, atlanan } = await toplantiAlicilari(meetingId)
  if (alicilar.length === 0) return { ...BOS_SONUC, atlanan }
  return dagit(alicilar, atlanan, icerik.konu, icerik.text, icerik.html, icerik.link, icerik.inAppBaslik)
}

// ── 2) KARAR BİLDİRİMİ ──────────────────────────────────────────────────────

/**
 * Karar eklenince/güncellenince YALNIZ SORUMLUYA. Sorumlu yoksa bildirim yok —
 * ölçümde 8 kararın hiçbirinde sorumlu dolu değildi (FK hatası yüzünden), o
 * hata düzeldiği için artık dolu gelebilir.
 */
export async function kararIcerigi(
  decisionId: string,
  opts: { guncelleme?: boolean } = {},
): Promise<(MailIcerik & { responsibleId: string | null }) | null> {
  const k = await prisma.meetingDecision.findUnique({
    where: { id: decisionId },
    select: {
      id: true, decisionNumber: true, title: true, description: true,
      priority: true, dueDate: true, status: true, responsibleId: true,
      meeting: { select: { id: true, meetingNumber: true, title: true, scheduledDate: true } },
    },
  })
  if (!k) return null

  const link = `${BASE_URL}/meetings/${k.meeting.id}`
  const baslik = opts.guncelleme ? 'Sorumlusu olduğunuz karar güncellendi' : 'Size bir karar atandı'
  const gecikmis = !!k.dueDate && k.dueDate.getTime() < Date.now()

  const { html, text } = renderEmail({
    module: 'Toplantı',
    title: baslik,
    subtitle: `${k.decisionNumber} · ${k.title}`,
    preheader: `${k.title} — ${k.meeting.title}`,
    bodyHtml:
      p(`<strong>${esc(k.meeting.title)}</strong> toplantısında alınan <strong>${esc(k.decisionNumber)}</strong> numaralı kararın sorumlusu sizsiniz.`) +
      (k.description ? p(esc(k.description)) : ''),
    infoRows: [
      { label: 'Karar', value: esc(k.title) },
      { label: 'Öncelik', value: esc(ONCELIK_ETIKET[k.priority] ?? k.priority) },
      {
        label: 'Son tarih',
        value: k.dueDate
          ? (gecikmis
              ? `${esc(tarihTR(k.dueDate))} <strong style="color:#b91c1c">(geçti)</strong>`
              : esc(tarihTR(k.dueDate)))
          : '—',
      },
      { label: 'Toplantı', value: `${esc(k.meeting.meetingNumber)} · ${esc(k.meeting.title)}` },
      { label: 'Toplantı tarihi', value: esc(tarihTR(k.meeting.scheduledDate)) },
    ],
    cta: { label: 'Kararı Aç', url: link },
  })

  return {
    konu: `${opts.guncelleme ? '✏️' : '📌'} ${baslik} — ${k.title}`,
    html, text, link, inAppBaslik: baslik, responsibleId: k.responsibleId,
  }
}

export async function kararBildirimiGonder(
  decisionId: string,
  opts: { guncelleme?: boolean } = {},
): Promise<AkisSonuc> {
  const icerik = await kararIcerigi(decisionId, opts)
  if (!icerik || !icerik.responsibleId) return BOS_SONUC
  const alici = await userIdenAlici(icerik.responsibleId)
  if (!alici) return { ...BOS_SONUC, atlanan: 1 }
  return dagit([alici], 0, icerik.konu, icerik.text, icerik.html, icerik.link, icerik.inAppBaslik)
}

// ── 3) TUTANAK / ÖZET ───────────────────────────────────────────────────────

export async function ozetIcerigi(meetingId: string): Promise<MailIcerik | null> {
  const m = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: {
      id: true, meetingNumber: true, title: true, scheduledDate: true,
      generalNotes: true, closingRemarks: true,
      decisions: {
        orderBy: { decisionNumber: 'asc' },
        select: {
          decisionNumber: true, title: true, dueDate: true, priority: true,
          responsible: { select: { name: true } }, responsibleName: true,
        },
      },
    },
  })
  if (!m) return null

  const link = `${BASE_URL}/meetings/${m.id}`
  const kararlar = m.decisions.length
    ? sectionTitle('Alınan kararlar', `${m.decisions.length} karar`) + dataTable(
        ['No', 'Karar', 'Sorumlu', 'Son tarih'],
        m.decisions.map((k) => [
          esc(k.decisionNumber),
          esc(k.title),
          esc(k.responsible?.name || k.responsibleName || '—'),
          esc(tarihTR(k.dueDate)),
        ]),
      )
    : p('<em>Bu toplantıda karar kaydedilmedi.</em>')

  const ozet = m.generalNotes || m.closingRemarks

  const { html, text } = renderEmail({
    module: 'Toplantı',
    title: 'Toplantı tamamlandı',
    subtitle: `${m.meetingNumber} · ${m.title}`,
    preheader: `${m.title} tutanağı — ${m.decisions.length} karar`,
    bodyHtml:
      p(`<strong>${esc(m.title)}</strong> toplantısı tamamlandı.`) +
      (ozet ? p(esc(ozet)) : ''),
    infoRows: [
      { label: 'Toplantı', value: `${esc(m.meetingNumber)} · ${esc(m.title)}` },
      { label: 'Tarih', value: esc(tarihTR(m.scheduledDate)) },
      { label: 'Karar sayısı', value: String(m.decisions.length) },
    ],
    afterHtml: kararlar,
    cta: { label: 'Tutanağı Aç', url: link },
    footnote: 'Tutanağın PDF çıktısını toplantı ekranından alabilirsiniz.',
  })

  return {
    konu: `✅ Toplantı Tamamlandı — ${m.title}`,
    html, text, link, inAppBaslik: 'Toplantı tamamlandı',
  }
}

/** Toplantı COMPLETED'a geçince katılımcılara özet + kararlar. */
export async function toplantiOzetiGonder(meetingId: string): Promise<AkisSonuc> {
  const icerik = await ozetIcerigi(meetingId)
  if (!icerik) return BOS_SONUC
  const { alicilar, atlanan } = await toplantiAlicilari(meetingId)
  if (alicilar.length === 0) return { ...BOS_SONUC, atlanan }
  return dagit(alicilar, atlanan, icerik.konu, icerik.text, icerik.html, icerik.link, icerik.inAppBaslik)
}

// ── 4) GECİKME HATIRLATMASI (cron) ──────────────────────────────────────────

export type GecikmeSonuc = {
  /** dueDate'i geçmiş ve PENDING olan karar sayısı. */
  taranan: number
  /** PENDING → OVERDUE yapılan karar sayısı. */
  overdueYapilan: number
  /** Hatırlatma gönderilen karar sayısı. */
  hatirlatilan: number
  /** Bugün zaten hatırlatıldığı için atlanan. */
  atlanan: number
  mailUlasmayan: string[]
}

const GECIKME_BASLIK = 'Karar süresi geçti'

/** Gecikme maili gövdesi — alıcıdan bağımsız, önizleme de bunu kullanır. */
export function gecikmeIcerigi(
  k: {
    decisionNumber: string; title: string; dueDate: Date | null; priority: string
    meeting: { meetingNumber: string; title: string }
  },
  link: string,
): MailIcerik {
  const gunGecti = k.dueDate ? Math.floor((Date.now() - k.dueDate.getTime()) / 86400000) : 0
  const { html, text } = renderEmail({
    module: 'Toplantı',
    title: GECIKME_BASLIK,
    subtitle: `${k.decisionNumber} · ${k.title}`,
    preheader: `${k.title} — son tarih ${gunGecti} gün önce doldu`,
    bodyHtml: p(
      `<strong>${esc(k.meeting.title)}</strong> toplantısında sorumlusu olduğunuz ` +
      `<strong>${esc(k.decisionNumber)}</strong> numaralı kararın son tarihi ` +
      `<strong>${gunGecti} gün önce</strong> doldu ve karar hâlâ tamamlanmadı.`,
    ),
    infoRows: [
      { label: 'Karar', value: esc(k.title) },
      { label: 'Öncelik', value: esc(ONCELIK_ETIKET[k.priority] ?? k.priority) },
      { label: 'Son tarih', value: `${esc(tarihTR(k.dueDate))} <strong style="color:#b91c1c">(${gunGecti} gün geçti)</strong>` },
      { label: 'Toplantı', value: `${esc(k.meeting.meetingNumber)} · ${esc(k.meeting.title)}` },
    ],
    cta: { label: 'Kararı Aç', url: link },
  })
  return { konu: `⚠️ ${GECIKME_BASLIK} — ${k.title}`, html, text, link, inAppBaslik: GECIKME_BASLIK }
}

/**
 * TEKRAR ENGELİ — ŞEMA DEĞİŞİKLİĞİ GEREKTİRMEZ: o kullanıcıya, o karar linkiyle,
 * BUGÜN oluşturulmuş "Karar süresi geçti" başlıklı in-app bildirim varsa atlanır.
 * fif-hatirlatma ucundaki desenin aynısı. Ayrı log tablosu (deneme'deki
 * PersonnelEvaluationEmailLog gibi) ya da `sonHatirlatmaAt` alanı eklemeye
 * gerek yok — ikisi de migration ister, bu istemez.
 */
async function bugunHatirlatildiMi(userId: string, link: string): Promise<boolean> {
  const gunBasi = new Date()
  gunBasi.setHours(0, 0, 0, 0)
  const v = await prisma.notification.findFirst({
    where: { userId, link, title: GECIKME_BASLIK, createdAt: { gte: gunBasi } },
    select: { id: true },
  })
  return !!v
}

/**
 * Günlük cron gövdesi: süresi geçmiş PENDING kararları OVERDUE yapar ve
 * sorumlusuna hatırlatır. `kuru: true` ise hiçbir şey YAZILMAZ (simülasyon).
 */
export async function gecikmisKararlariIsle(
  opts: { kuru?: boolean } = {},
): Promise<GecikmeSonuc> {
  const kuru = !!opts.kuru
  const sonuc: GecikmeSonuc = { taranan: 0, overdueYapilan: 0, hatirlatilan: 0, atlanan: 0, mailUlasmayan: [] }

  const gunBasi = new Date()
  gunBasi.setHours(0, 0, 0, 0)

  const kararlar = await prisma.meetingDecision.findMany({
    where: { status: 'PENDING', dueDate: { not: null, lt: gunBasi } },
    select: {
      id: true, decisionNumber: true, title: true, dueDate: true, priority: true, responsibleId: true,
      meeting: { select: { id: true, meetingNumber: true, title: true } },
    },
  })
  sonuc.taranan = kararlar.length

  for (const k of kararlar) {
    // Durum damgası bildirimden BAĞIMSIZ: sorumlusu olmayan karar da OVERDUE olur.
    if (!kuru) {
      await prisma.meetingDecision.update({ where: { id: k.id }, data: { status: 'OVERDUE' } })
    }
    sonuc.overdueYapilan++

    if (!k.responsibleId) continue
    const alici = await userIdenAlici(k.responsibleId)
    if (!alici) continue

    const link = `${BASE_URL}/meetings/${k.meeting.id}`
    if (await bugunHatirlatildiMi(alici.userId, link)) { sonuc.atlanan++; continue }

    const icerik = gecikmeIcerigi(k, link)

    if (kuru) { sonuc.hatirlatilan++; continue }
    const r = await gonder(alici, icerik.konu, icerik.text, icerik.html, link, GECIKME_BASLIK)
    if (r.mail || r.inApp) sonuc.hatirlatilan++
    if (!r.mail && r.inApp) sonuc.mailUlasmayan.push(alici.email)
  }

  return sonuc
}
