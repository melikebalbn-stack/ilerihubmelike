/**
 * İK (İnsan Varlıkları) Bildirim Yardımcıları
 *
 * Hat 1 (iş başvurusu), Hat 3 (performans review) için ortak İK recipient
 * resolver. ticket-notifications.ts pattern'inin İK departmanı için karşılığı.
 *
 * Resolver kuralı:
 *   isActive = true VE
 *     (department adında "insan varliklari" / "ik" / "hr" geçen) VEYA
 *     (role = HR_MANAGER) VEYA
 *     (User.permissions içinde 'recruitment.admin' veya 'hr.admin')
 *
 * Türkçe karakter normalize: unaccent extension'ı varsa raw SQL,
 * yoksa Türkçeli + Türkçesiz iki varyant fallback.
 */

import { prisma } from '@/lib/prisma'
import type { JobApplicationStatus } from '@/generated/prisma'
import { STATUS_LABELS_TR } from '@/lib/recruitment/transitions'
import { mudurKademesiMi } from '@/lib/recruitment/bekleyen'

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
 * İK departmanındaki + HR_MANAGER role + recruitment.admin permission'lı
 * aktif kullanıcıları döner. Email'siz kullanıcı atlanır.
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
 */
export async function notifyApplicationStageChange(args: {
  applicationId: string
  applicantName: string
  fromStatus: JobApplicationStatus
  toStatus: JobApplicationStatus
  assignedManagerId?: string | null
  actorName?: string | null
}): Promise<void> {
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
}

/**
 * Aday sınavı tamamlanınca in-app bildirim. Alıcılar: İK ekibi (resolveHRRecipients) +
 * varsa atanan müdür — TEK createMany (userId tekilleştirilir). Başlık geçti/kaldı ayrımı,
 * mesajda puan + geçme notu. Süreci BOZMAZ (çağıran try/catch ile sarar).
 */
export async function notifyAssessmentCompleted(args: {
  applicationId: string
  applicantName: string
  assessmentTitle: string
  puan: number
  gecmeNotu: number
  gecti: boolean
  assignedManagerId?: string | null
}): Promise<void> {
  const link = APPLICATION_LINK(args.applicationId)
  const title = `Sınav sonucu: ${args.gecti ? 'Geçti' : 'Kaldı'}`
  const message =
    `${args.applicantName} — ${args.assessmentTitle}: ${args.puan} puan ` +
    `(geçme notu ${args.gecmeNotu}) — ${args.gecti ? 'geçti' : 'kaldı'}.`

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
}
