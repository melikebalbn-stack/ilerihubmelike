/**
 * Performans Değerlendirme Bildirim Dispatcher (PR-HR-NOTIF Hat 3)
 *
 * 4 event tipi:
 *   1. CYCLE_LAUNCH  — Cycle IN_PROGRESS'e geçti, employee + manager + İK
 *   2. DEADLINE_7    — Deadline'a 7 gün kala, review tamamlanmamış
 *   3. DEADLINE_0    — Deadline günü, review tamamlanmamış
 *   4. OVERDUE       — Deadline geçti +1 gün, manager + İK escalation
 *
 * İdempotency: PerformanceReviewEmailLog tablosunda
 * unique(cycleId, reviewId, eventType, recipientId) ile dedup.
 *
 * Kanallar: email + in-app notification + push (Promise.allSettled).
 * Fire-and-forget değil — cron route içinden çağrılır, sonuç döner.
 */

import { prisma } from '@/lib/prisma'
import {
  sendEmail,
  generateReviewCycleLaunchEmail,
  generateReviewReminderEmail,
  generateReviewOverdueEmail,
} from '@/lib/email'
import { sendPushToUser } from '@/lib/push-notifications'
import { resolveHRRecipients, type HRRecipient } from '@/lib/hr-notifications'
import { ReviewStatus, PerformanceCycleStatus } from '@/generated/prisma'

export type ReminderEventType = 'CYCLE_LAUNCH' | 'DEADLINE_7' | 'DEADLINE_0' | 'OVERDUE'

type DispatchResult = {
  eventType: ReminderEventType
  cycleId: string
  reviewId: string | null
  attempted: number
  sent: number
  skipped: number
  errors: string[]
}

/** Belirli (cycleId, reviewId, eventType, recipientId) için zaten log var mı? */
async function alreadySent(
  cycleId: string,
  reviewId: string | null,
  eventType: ReminderEventType,
  recipientId: string,
): Promise<boolean> {
  const log = await prisma.performanceReviewEmailLog.findFirst({
    where: {
      cycleId,
      reviewId: reviewId ?? null,
      eventType,
      recipientId,
      status: 'sent',
    },
    select: { id: true },
  })
  return !!log
}

/**
 * Tek bir recipient için: email + in-app + push gönder, sonra log yaz.
 * Hata: log status='failed' + error mesajı.
 */
async function dispatchToRecipient(args: {
  cycleId: string
  reviewId: string | null
  eventType: ReminderEventType
  recipient: HRRecipient
  subject: string
  body: string
  html: string
  inAppTitle: string
  inAppMessage: string
  link: string
  pushTag: string
}): Promise<{ status: 'sent' | 'skipped' | 'failed'; error?: string }> {
  const { cycleId, reviewId, eventType, recipient } = args

  if (await alreadySent(cycleId, reviewId, eventType, recipient.id)) {
    return { status: 'skipped' }
  }

  const errors: string[] = []

  const [emailRes, inAppRes, pushRes] = await Promise.allSettled([
    sendEmail([{ name: recipient.name, email: recipient.email }], args.subject, args.body, args.html),
    prisma.notification.create({
      data: {
        userId: recipient.id,
        title: args.inAppTitle,
        message: args.inAppMessage,
        type: 'INFO',
        link: args.link,
      },
    }),
    (async () => {
      const sub = await prisma.pushSubscription.count({ where: { userId: recipient.id } })
      if (sub === 0) return null
      return sendPushToUser(prisma, recipient.id, {
        title: args.inAppTitle,
        body: args.inAppMessage,
        url: args.link,
        tag: args.pushTag,
      })
    })(),
  ])

  if (emailRes.status === 'rejected') errors.push(`email: ${String(emailRes.reason)}`)
  if (inAppRes.status === 'rejected') errors.push(`in-app: ${String(inAppRes.reason)}`)
  if (pushRes.status === 'rejected') errors.push(`push: ${String(pushRes.reason)}`)

  const allFailed =
    emailRes.status === 'rejected' &&
    inAppRes.status === 'rejected' &&
    pushRes.status === 'rejected'

  await prisma.performanceReviewEmailLog.create({
    data: {
      cycleId,
      reviewId: reviewId ?? null,
      eventType,
      recipientId: recipient.id,
      status: allFailed ? 'failed' : 'sent',
      error: errors.length > 0 ? errors.join('; ') : null,
    },
  })

  if (allFailed) return { status: 'failed', error: errors.join('; ') }
  return { status: 'sent', error: errors.length > 0 ? errors.join('; ') : undefined }
}

// ════════════════════════════════════════════════════════════
// EVENT: CYCLE_LAUNCH
// ════════════════════════════════════════════════════════════

/**
 * Cycle IN_PROGRESS'e geçince çağrılır.
 * Recipient: tüm review'ların employee + manager + İK ekibi (dedup).
 */
export async function dispatchCycleLaunch(cycleId: string): Promise<DispatchResult> {
  const result: DispatchResult = {
    eventType: 'CYCLE_LAUNCH',
    cycleId,
    reviewId: null,
    attempted: 0,
    sent: 0,
    skipped: 0,
    errors: [],
  }

  const cycle = await prisma.performanceCycle.findUnique({
    where: { id: cycleId },
    select: {
      id: true,
      name: true,
      year: true,
      yearEndReviewEnd: true,
      reviews: {
        select: {
          employeeId: true,
          employeeName: true,
          employeeEmail: true,
          managerId: true,
          managerName: true,
          managerEmail: true,
        },
      },
    },
  })

  if (!cycle) {
    result.errors.push(`cycle ${cycleId} bulunamadı`)
    return result
  }

  // Recipient seti: employee + manager + HR (dedup id)
  const recipientMap = new Map<string, HRRecipient>()

  for (const r of cycle.reviews) {
    if (r.employeeId && r.employeeEmail) {
      recipientMap.set(r.employeeId, {
        id: r.employeeId,
        email: r.employeeEmail,
        name: r.employeeName,
      })
    }
    if (r.managerId && r.managerEmail) {
      recipientMap.set(r.managerId, {
        id: r.managerId,
        email: r.managerEmail,
        name: r.managerName ?? r.managerEmail,
      })
    }
  }

  const hr = await resolveHRRecipients()
  for (const h of hr) recipientMap.set(h.id, h)

  for (const recipient of recipientMap.values()) {
    result.attempted++
    try {
      const { subject, body, html } = generateReviewCycleLaunchEmail(
        {
          id: cycle.id,
          name: cycle.name,
          year: cycle.year,
          yearEndReviewEnd: cycle.yearEndReviewEnd,
        },
        recipient.name,
      )
      const res = await dispatchToRecipient({
        cycleId: cycle.id,
        reviewId: null,
        eventType: 'CYCLE_LAUNCH',
        recipient,
        subject,
        body,
        html,
        inAppTitle: 'Performans Değerlendirme Başladı',
        inAppMessage: `${cycle.name} dönemi başlatıldı. Değerlendirmenizi tamamlayın.`,
        link: `/strategic-hr/performance?cycle=${cycle.id}`,
        pushTag: `perf-cycle-${cycle.id}`,
      })
      if (res.status === 'sent') result.sent++
      else if (res.status === 'skipped') result.skipped++
      else result.errors.push(`${recipient.email}: ${res.error ?? 'failed'}`)
    } catch (err) {
      result.errors.push(`${recipient.email}: ${String(err)}`)
    }
  }

  return result
}

// ════════════════════════════════════════════════════════════
// EVENT: DEADLINE_7 / DEADLINE_0
// ════════════════════════════════════════════════════════════

/**
 * Review tamamlanmamış (status NOT FINALIZED/ACKNOWLEDGED) ve
 * deadline'a daysRemaining gün kalmış. Recipient: employee + manager.
 */
async function dispatchReviewReminder(
  reviewId: string,
  daysRemaining: 7 | 0,
): Promise<DispatchResult> {
  const eventType: ReminderEventType = daysRemaining === 7 ? 'DEADLINE_7' : 'DEADLINE_0'
  const result: DispatchResult = {
    eventType,
    cycleId: '',
    reviewId,
    attempted: 0,
    sent: 0,
    skipped: 0,
    errors: [],
  }

  const review = await prisma.performanceReview.findUnique({
    where: { id: reviewId },
    select: {
      id: true,
      cycleId: true,
      employeeId: true,
      employeeName: true,
      employeeEmail: true,
      managerId: true,
      managerName: true,
      managerEmail: true,
      cycle: {
        select: { name: true, yearEndReviewEnd: true },
      },
    },
  })

  if (!review || !review.cycle.yearEndReviewEnd) {
    result.errors.push(`review ${reviewId} veya deadline yok`)
    return result
  }

  result.cycleId = review.cycleId

  const recipients: HRRecipient[] = []
  if (review.employeeId && review.employeeEmail) {
    recipients.push({ id: review.employeeId, email: review.employeeEmail, name: review.employeeName })
  }
  if (review.managerId && review.managerEmail) {
    recipients.push({
      id: review.managerId,
      email: review.managerEmail,
      name: review.managerName ?? review.managerEmail,
    })
  }

  for (const recipient of recipients) {
    result.attempted++
    try {
      const { subject, body, html } = generateReviewReminderEmail(
        {
          id: review.id,
          cycleId: review.cycleId,
          cycleName: review.cycle.name,
          employeeName: review.employeeName,
          employeeEmail: review.employeeEmail,
          deadline: review.cycle.yearEndReviewEnd,
        },
        daysRemaining,
        recipient.name,
      )
      const res = await dispatchToRecipient({
        cycleId: review.cycleId,
        reviewId: review.id,
        eventType,
        recipient,
        subject,
        body,
        html,
        inAppTitle:
          daysRemaining === 0
            ? 'SON GÜN: Performans Değerlendirme'
            : `Hatırlatma: ${daysRemaining} gün kaldı`,
        inAppMessage: `${review.cycle.name} dönemi değerlendirmesi tamamlanmamış.`,
        link: `/strategic-hr/performance?cycle=${review.cycleId}`,
        pushTag: `perf-review-${review.id}-${eventType}`,
      })
      if (res.status === 'sent') result.sent++
      else if (res.status === 'skipped') result.skipped++
      else result.errors.push(`${recipient.email}: ${res.error ?? 'failed'}`)
    } catch (err) {
      result.errors.push(`${recipient.email}: ${String(err)}`)
    }
  }

  return result
}

// ════════════════════════════════════════════════════════════
// EVENT: OVERDUE
// ════════════════════════════════════════════════════════════

/**
 * Deadline geçti +1 gün. Recipient: manager + İK escalation.
 */
async function dispatchReviewOverdue(reviewId: string, daysOverdue: number): Promise<DispatchResult> {
  const result: DispatchResult = {
    eventType: 'OVERDUE',
    cycleId: '',
    reviewId,
    attempted: 0,
    sent: 0,
    skipped: 0,
    errors: [],
  }

  const review = await prisma.performanceReview.findUnique({
    where: { id: reviewId },
    select: {
      id: true,
      cycleId: true,
      employeeName: true,
      employeeEmail: true,
      managerId: true,
      managerName: true,
      managerEmail: true,
      cycle: { select: { name: true, yearEndReviewEnd: true } },
    },
  })

  if (!review || !review.cycle.yearEndReviewEnd) {
    result.errors.push(`review ${reviewId} veya deadline yok`)
    return result
  }

  result.cycleId = review.cycleId

  // Manager + HR escalation
  const recipientMap = new Map<string, HRRecipient>()
  if (review.managerId && review.managerEmail) {
    recipientMap.set(review.managerId, {
      id: review.managerId,
      email: review.managerEmail,
      name: review.managerName ?? review.managerEmail,
    })
  }
  const hr = await resolveHRRecipients()
  for (const h of hr) recipientMap.set(h.id, h)

  for (const recipient of recipientMap.values()) {
    result.attempted++
    try {
      const { subject, body, html } = generateReviewOverdueEmail(
        {
          id: review.id,
          cycleId: review.cycleId,
          cycleName: review.cycle.name,
          employeeName: review.employeeName,
          employeeEmail: review.employeeEmail,
          deadline: review.cycle.yearEndReviewEnd,
        },
        daysOverdue,
        recipient.name,
      )
      const res = await dispatchToRecipient({
        cycleId: review.cycleId,
        reviewId: review.id,
        eventType: 'OVERDUE',
        recipient,
        subject,
        body,
        html,
        inAppTitle: 'GECİKMİŞ Performans Değerlendirme',
        inAppMessage: `${review.employeeName} için ${review.cycle.name} dönemi değerlendirmesi ${daysOverdue} gündür gecikmiş.`,
        link: `/strategic-hr/performance?cycle=${review.cycleId}`,
        pushTag: `perf-overdue-${review.id}`,
      })
      if (res.status === 'sent') result.sent++
      else if (res.status === 'skipped') result.skipped++
      else result.errors.push(`${recipient.email}: ${res.error ?? 'failed'}`)
    } catch (err) {
      result.errors.push(`${recipient.email}: ${String(err)}`)
    }
  }

  return result
}

// ════════════════════════════════════════════════════════════
// CRON RUNNER
// ════════════════════════════════════════════════════════════

/**
 * Günlük cron tarafından çağrılır. 4 event tarama:
 * 1. Bugün IN_PROGRESS olan + henüz CYCLE_LAUNCH log'u olmayan cycle'lar
 * 2. Aktif review'lar, deadline = today + 7 gün, status FINAL değil
 * 3. Aktif review'lar, deadline = today, status FINAL değil
 * 4. Aktif review'lar, deadline = today - 1 gün (geçen gün), status FINAL değil
 *
 * Returns toplam sayım.
 */
export async function runPerformanceReviewReminders(): Promise<{
  cycleLaunches: DispatchResult[]
  deadline7: DispatchResult[]
  deadline0: DispatchResult[]
  overdue: DispatchResult[]
  totalSent: number
  totalSkipped: number
  totalErrors: number
  durationMs: number
}> {
  const start = Date.now()
  const now = new Date()
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const day = 86400000

  // 1. CYCLE_LAUNCH — bugün IN_PROGRESS'e geçen cycle'lar (status değişikliği detection)
  // Basit varsayım: IN_PROGRESS olan ve henüz CYCLE_LAUNCH log kaydı olmayan cycle'lar
  const inProgressCycles = await prisma.performanceCycle.findMany({
    where: { status: 'IN_PROGRESS', isActive: true },
    select: { id: true },
  })

  const cycleLaunches: DispatchResult[] = []
  for (const c of inProgressCycles) {
    const logged = await prisma.performanceReviewEmailLog.findFirst({
      where: { cycleId: c.id, eventType: 'CYCLE_LAUNCH' },
      select: { id: true },
    })
    if (logged) continue
    cycleLaunches.push(await dispatchCycleLaunch(c.id))
  }

  // Aktif review filtresi: status FINALIZED/ACKNOWLEDGED değil + cycle aktif
  const reviewBaseWhere = {
    status: { notIn: [ReviewStatus.FINALIZED, ReviewStatus.ACKNOWLEDGED] },
    cycle: {
      isActive: true,
      status: { notIn: [PerformanceCycleStatus.COMPLETED, PerformanceCycleStatus.ARCHIVED] },
    },
  }

  // 2. DEADLINE_7 — deadline = today + 7
  const deadline7Target = new Date(today.getTime() + 7 * day)
  const reviews7 = await prisma.performanceReview.findMany({
    where: {
      ...reviewBaseWhere,
      cycle: {
        ...reviewBaseWhere.cycle,
        yearEndReviewEnd: deadline7Target,
      },
    },
    select: { id: true },
  })
  const deadline7: DispatchResult[] = []
  for (const r of reviews7) deadline7.push(await dispatchReviewReminder(r.id, 7))

  // 3. DEADLINE_0 — deadline = today
  const reviews0 = await prisma.performanceReview.findMany({
    where: {
      ...reviewBaseWhere,
      cycle: {
        ...reviewBaseWhere.cycle,
        yearEndReviewEnd: today,
      },
    },
    select: { id: true },
  })
  const deadline0: DispatchResult[] = []
  for (const r of reviews0) deadline0.push(await dispatchReviewReminder(r.id, 0))

  // 4. OVERDUE — deadline = today - 1
  const overdueTarget = new Date(today.getTime() - day)
  const reviewsOver = await prisma.performanceReview.findMany({
    where: {
      ...reviewBaseWhere,
      cycle: {
        ...reviewBaseWhere.cycle,
        yearEndReviewEnd: overdueTarget,
      },
    },
    select: { id: true },
  })
  const overdue: DispatchResult[] = []
  for (const r of reviewsOver) overdue.push(await dispatchReviewOverdue(r.id, 1))

  const all = [...cycleLaunches, ...deadline7, ...deadline0, ...overdue]
  const totalSent = all.reduce((sum, r) => sum + r.sent, 0)
  const totalSkipped = all.reduce((sum, r) => sum + r.skipped, 0)
  const totalErrors = all.reduce((sum, r) => sum + r.errors.length, 0)

  return {
    cycleLaunches,
    deadline7,
    deadline0,
    overdue,
    totalSent,
    totalSkipped,
    totalErrors,
    durationMs: Date.now() - start,
  }
}
