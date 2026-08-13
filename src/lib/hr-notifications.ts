/**
 * İK (İnsan Varlıkları) Bildirim Yardımcıları
 *
 * Hat 1 (iş başvurusu), Hat 3 (performans review) için ortak İK recipient
 * resolver. ticket-notifications.ts pattern'inin İK departmanı için karşılığı.
 *
 * Resolver kuralı (KODUN GERÇEKTE YAPTIĞI — aşağıdaki SQL ile birebir):
 *   isActive = true VE
 *     (department adında "insan varliklari" geçen) VEYA
 *     (department tam olarak "ik" / "hr" / "human resources") VEYA
 *     (role = HR_MANAGER)
 *
 * İZİN (permission) KOŞULU YOKTUR. Bu yorum eskiden "recruitment.admin / hr.admin
 * izni olanlar da alır" diyordu; SQL'de böyle bir koşul hiç olmadı — yorum yanlıştı,
 * kod doğru. Alıcı kümesi DEPARTMAN + ROL ile belirlenir ve bilerek DARDIR
 * (izin tabanlı genişletme İV'nin istediği davranış değil).
 *
 * Türkçe karakter normalize: unaccent extension'ı varsa raw SQL,
 * yoksa Türkçeli + Türkçesiz iki varyant fallback.
 */

import { prisma } from '@/lib/prisma'
import type { JobApplicationStatus } from '@/generated/prisma'
import { STATUS_LABELS_TR } from '@/lib/recruitment/transitions'
import { mudurKademesiMi } from '@/lib/recruitment/bekleyen'
import { sendEmail } from '@/lib/email'
import {
  asamaDegisikligiMaili,
  sinavSonucuMaili,
} from '@/lib/email-templates/hr-basvuru'

export type HRRecipient = {
  id: string
  email: string
  name: string
}

function toRecipient(u: {
  id: string
  email: string | null
  firstName: string | null
  lastName: string | null
  name: string | null
}): HRRecipient | null {
  if (!u.email) return null
  const composed = [u.firstName, u.lastName].filter(Boolean).join(' ').trim()
  const name = composed || u.name || u.email
  return { id: u.id, email: u.email, name }
}

/**
 * İK departmanındaki + HR_MANAGER rollü aktif kullanıcıları döner.
 * (Permission tabanlı bir koşul YOKTUR — bkz. dosya başı.)
 * Email'siz kullanıcı atlanır.
 *
 * Dedup: aynı user_id birden fazla kez gelmez.
 */
export async function resolveHRRecipients(): Promise<HRRecipient[]> {
  const seen = new Set<string>()
  const out: HRRecipient[] = []

  // 1) unaccent ile dene
  try {
    const rows = await prisma.$queryRaw<
      Array<{ id: string; email: string | null; firstName: string | null; lastName: string | null; name: string | null }>
    >`
      SELECT id, email, "firstName", "lastName", name
      FROM "User"
      WHERE "isActive" = true
        AND (
          (department IS NOT NULL AND LOWER(unaccent(department)) LIKE '%insan varliklari%')
          OR (department IS NOT NULL AND LOWER(unaccent(department)) IN ('ik', 'hr', 'human resources'))
          OR role = 'HR_MANAGER'
        )
    `
    for (const r of rows) {
      if (seen.has(r.id)) continue
      const rec = toRecipient(r)
      if (rec) {
        seen.add(r.id)
        out.push(rec)
      }
    }
  } catch (err) {
    console.warn('[hr-notify] unaccent query failed, using fallback:', err)

    // 2) Fallback: Türkçe karakter varyantları
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { department: { contains: 'İnsan Varlıkları', mode: 'insensitive' } },
          { department: { contains: 'Insan Varliklari', mode: 'insensitive' } },
          { department: { equals: 'IK', mode: 'insensitive' } },
          { department: { equals: 'HR', mode: 'insensitive' } },
          { department: { contains: 'Human Resources', mode: 'insensitive' } },
          { role: 'HR_MANAGER' },
        ],
      },
      select: { id: true, email: true, firstName: true, lastName: true, name: true },
    })
    for (const u of users) {
      if (seen.has(u.id)) continue
      const rec = toRecipient(u)
      if (rec) {
        seen.add(u.id)
        out.push(rec)
      }
    }
  }

  return out
}

// Başvuru detay sayfası (gerçek route — /ik/* YOK, doğrulandı).
const APPLICATION_LINK = (id: string) => `/strategic-hr/recruitment/job-applications/${id}`

/**
 * Başvuru aşama değişiminde Notification üretir (in-app).
 * - toStatus === MUDUR_DEGERLENDIRME: SADECE atanan müdüre ("Değerlendirmeniz bekleniyor").
 * - TOP ATANAN KİŞİDE OLAN diğer aşamalar (mudurKademesiMi): İK bildirimi AYNEN kalır,
 *   ÜSTÜNE atanan kişiye ayrı bir "sizi bekliyor" bildirimi eklenir.
 * - diğer tüm geçişler: resolveHRRecipients() ile İK ekibine.
 * Notification'lar createMany ile tek seferde. Metinlerde STATUS_LABELS_TR (ham enum yazılmaz).
 * Alıcı yoksa sessizce çıkar (hata fırlatmaz — çağıran best-effort bekler).
 *
 * ÇİFT BİLDİRİM KAPISI (otomatikSinavGecisi):
 * Sınav sonucu OTOMATİK bir aşama geçişi tetiklediğinde İV iki bildirim alırdı:
 * (1) "sınav sonucu", (2) "aşama değişti". İkisi aynı olayı anlatıyor. Bu bayrak set
 * edilirse aşama bildirimi HİÇ üretilmez; yeni durum sınav sonucu bildiriminin/mailinin
 * içinde gösterilir (notifyAssessmentCompleted → yeniDurum). Tek olay = tek bildirim.
 * Bayrak GEÇİŞİ engellemez, yalnız BİLDİRİMİ atlar — StageLog satırı yine yazılır.
 */
export async function notifyApplicationStageChange(args: {
  applicationId: string
  applicantName: string
  fromStatus: JobApplicationStatus
  toStatus: JobApplicationStatus
  assignedManagerId?: string | null
  actorName?: string | null
  requestedPosition?: string | null
  applicationNumber?: string | null
  /** Sınav sonucu tetikledi → bu bildirim ATLANIR (tek mail sınav sonucundan gider). */
  otomatikSinavGecisi?: boolean
}): Promise<void> {
  // Çift bildirim kapısı — en başta, hiçbir alıcı çözümlemesi yapılmadan çık.
  if (args.otomatikSinavGecisi) return

  const link = APPLICATION_LINK(args.applicationId)
  const toLabel = STATUS_LABELS_TR[args.toStatus] ?? args.toStatus
  const fromLabel = STATUS_LABELS_TR[args.fromStatus] ?? args.fromStatus
  const actor = args.actorName ? ` (${args.actorName})` : ''

  // Müdür değerlendirmesi: yalnız atanan müdüre.
  if (args.toStatus === 'MUDUR_DEGERLENDIRME') {
    if (!args.assignedManagerId) return // müdür atanmamışsa bildirim yok
    await prisma.notification.createMany({
      data: [
        {
          userId: args.assignedManagerId,
          title: 'Değerlendirmeniz bekleniyor',
          message: `${args.applicantName} adlı adayın başvurusu değerlendirmeniz için atandı${actor}.`,
          type: 'INFO',
          link,
        },
      ],
    })
    return
  }

  // Diğer tüm geçişler: İK ekibine.
  const recipients = await resolveHRRecipients()

  // Topun atanan kişide olduğu aşamalar (MUDUR_MULAKATI, DEGERLENDIRICI, URETIM_MUDUR_YRD,
  // FABRIKA_MUDURU): İK bildirimi kaldırılmaz, atanan kişiye AYRICA "sizi bekliyor" gider.
  // Hangi statülerin bu kapsamda olduğu SABİT LİSTE DEĞİL — mudurKademesiMi() ile matristen
  // türetilir (bekleyen.ts TEK KAYNAK). Matrise yeni bir atanan-kişi kademesi eklendiğinde
  // burası kendiliğinden kapsar.
  //
  // MUDUR_DEGERLENDIRME yukarıda erken dönüşle ayrıldığı için buraya hiç gelmez —
  // o aşamanın "yalnız müdüre" davranışı değişmedi.
  const ikIds = new Set(recipients.map((r) => r.id))
  const atananaGitsin =
    !!args.assignedManagerId &&
    mudurKademesiMi(args.toStatus) &&
    // Kişi zaten İK alıcısıysa çift bildirim üretme; İK satırı korunur.
    !ikIds.has(args.assignedManagerId)

  const data = [
    ...recipients.map((r) => ({
      userId: r.id,
      title: `Başvuru durumu: ${toLabel}`,
      message: `${args.applicantName} — ${fromLabel} → ${toLabel}${actor}`,
      type: 'INFO' as const,
      link,
    })),
    ...(atananaGitsin
      ? [
          {
            userId: args.assignedManagerId!,
            // MUDUR_DEGERLENDIRME metniyle aynı desen: "ne bekleniyor" + aday adı + aktör.
            title: `${toLabel} sizi bekliyor`,
            message: `${args.applicantName} adlı adayın başvurusu ${toLabel} aşamasında size atandı${actor}.`,
            type: 'INFO' as const,
            link,
          },
        ]
      : []),
  ]

  if (data.length === 0) return
  await prisma.notification.createMany({ data })

  // E-posta — ortak şablon (hr-basvuru.ts). Alıcı: İK ekibi (atanan müdüre mail GİTMEZ;
  // ona uygulama içi bildirim yeterli, mail yükü artmasın). Best-effort: mail hatası
  // uygulama içi bildirimi geri almaz, çağıran zaten try/catch ile sarar.
  if (recipients.length > 0) {
    const mail = asamaDegisikligiMaili({
      applicationId: args.applicationId,
      applicationNumber: args.applicationNumber ?? '—',
      adayAdi: args.applicantName,
      pozisyon: args.requestedPosition,
      eskiDurumEtiketi: fromLabel,
      yeniDurumEtiketi: toLabel,
      aktorAdi: args.actorName,
    })
    try {
      await sendEmail(
        recipients.map((r) => ({ email: r.email, name: r.name })),
        mail.subject,
        mail.text,
        mail.html,
      )
    } catch (err) {
      console.error('[hr-notify] aşama değişikliği maili gönderilemedi:', err)
    }
  }
}

/**
 * Aday sınavı tamamlanınca bildirim (in-app + e-posta). Alıcılar: İK ekibi
 * (resolveHRRecipients) + varsa atanan müdür — TEK createMany (userId tekilleştirilir).
 * Başlık geçti/kaldı ayrımı, mesajda puan + geçme notu. Süreci BOZMAZ (çağıran try/catch).
 *
 * yeniDurum: sınav sonucu OTOMATİK bir aşama geçişi tetiklediyse yeni statü buraya verilir.
 * Böylece "sonuç + yeni durum" TEK bildirimde/mailde çıkar ve aşama bildirimi ayrıca
 * üretilmez (bkz. notifyApplicationStageChange → otomatikSinavGecisi).
 */
export async function notifyAssessmentCompleted(args: {
  applicationId: string
  applicantName: string
  assessmentTitle: string
  puan: number
  gecmeNotu: number
  gecti: boolean
  assignedManagerId?: string | null
  requestedPosition?: string | null
  applicationNumber?: string | null
  /** Otomatik ilerleme olduysa yeni statü — tek bildirimde gösterilir. */
  yeniDurum?: JobApplicationStatus | null
}): Promise<void> {
  const link = APPLICATION_LINK(args.applicationId)
  const yeniDurumEtiketi = args.yeniDurum
    ? (STATUS_LABELS_TR[args.yeniDurum] ?? args.yeniDurum)
    : null
  const title = `Sınav sonucu: ${args.gecti ? 'Geçti' : 'Kaldı'}`
  const message =
    `${args.applicantName} — ${args.assessmentTitle}: ${args.puan} puan ` +
    `(geçme notu ${args.gecmeNotu}) — ${args.gecti ? 'geçti' : 'kaldı'}.` +
    // Aşama bildirimi ATLANDIĞI için yeni durum BU mesajda görünmeli.
    (yeniDurumEtiketi ? ` Yeni durum: ${yeniDurumEtiketi}.` : '')

  // İK + (varsa) atanan müdür; Set ile tekilleştir (aynı kişi iki bildirim almasın).
  const recipients = await resolveHRRecipients()
  const userIds = new Set<string>(recipients.map((r) => r.id))
  if (args.assignedManagerId) userIds.add(args.assignedManagerId)
  if (userIds.size === 0) return

  await prisma.notification.createMany({
    data: [...userIds].map((userId) => ({
      userId,
      title,
      message,
      type: 'INFO' as const,
      link,
    })),
  })

  // E-posta — ortak şablon. Alıcı: İK ekibi (mail adresi olanlar).
  if (recipients.length > 0) {
    const mail = sinavSonucuMaili({
      applicationId: args.applicationId,
      applicationNumber: args.applicationNumber ?? '—',
      adayAdi: args.applicantName,
      pozisyon: args.requestedPosition,
      sinavAdi: args.assessmentTitle,
      puan: args.puan,
      gecmeNotu: args.gecmeNotu,
      gecti: args.gecti,
      yeniDurumEtiketi,
    })
    try {
      await sendEmail(
        recipients.map((r) => ({ email: r.email, name: r.name })),
        mail.subject,
        mail.text,
        mail.html,
      )
    } catch (err) {
      console.error('[hr-notify] sınav sonucu maili gönderilemedi:', err)
    }
  }
}
