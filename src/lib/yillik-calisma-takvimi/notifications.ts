import { Prisma } from '@/generated/prisma'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { bildirimTetigiEslesir, parseBildirimTetik } from './notification-validators'

const DAY = 86_400_000
export function istanbulToday(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const value = (type: string) => Number(parts.find(part => part.type === type)?.value)
  return new Date(Date.UTC(value('year'), value('month') - 1, value('day')))
}
export function deadlineDifference(deadline: Date, today: Date): number {
  return Math.round((Date.UTC(deadline.getUTCFullYear(), deadline.getUTCMonth(), deadline.getUTCDate()) - today.getTime()) / DAY)
}

type Db = typeof prisma
export interface NotificationRunSummary {
  dryRun: boolean; evaluatedRecordCount: number; candidateCount: number; skippedDuplicateCount: number; missingRecipientCount: number
  candidates: { recordId: string; trigger: string; kind: 'HATIRLATMA' | 'ESKALASYON'; targetUserCount: number; reason: string; duplicate: boolean }[]
  sentCount?: number; errorCount?: number
}

export async function runYillikTakvimNotifications({ dryRun = true, now = new Date(), db = prisma }: { dryRun?: boolean; now?: Date; db?: Db } = {}): Promise<NotificationRunSummary> {
  const today = istanbulToday(now)
  const records = await db.yillikTakvimKaydi.findMany({
    where: { arsivMi: false, iptalMi: false, durum: { notIn: ['ONAYLANDI', 'IPTAL_EDILDI'] }, nihaiSonTarih: { not: null }, bildirimKurallari: { some: { aktif: true } } },
    include: {
      katilimcilar: { include: { user: { select: { id: true, name: true, email: true, isActive: true } } } },
      bildirimKurallari: { where: { aktif: true } },
      onayAdimlari: { orderBy: [{ tur: 'desc' }, { adimSira: 'asc' }], include: { onaylayan: { select: { id: true, name: true, email: true, isActive: true } } } },
    },
  })
  const candidates: NotificationRunSummary['candidates'] = []
  let skippedDuplicateCount = 0, missingRecipientCount = 0, sentCount = 0, errorCount = 0
  for (const record of records) {
    if (!record.nihaiSonTarih) continue
    const difference = deadlineDifference(record.nihaiSonTarih, today)
    for (const rule of record.bildirimKurallari) {
      if (!bildirimTetigiEslesir(rule.tetik, difference)) continue
      const escalation = parseBildirimTetik(rule.tetik).tip === 'gun_gecikme'
      const recipients = new Map(record.katilimcilar.filter(p => rule.aliciRoller.includes(p.rol) && p.user.isActive).map(p => [p.user.id, p.user]))
      if (rule.aliciRoller.includes('ONAYLAYAN')) {
        const approver = record.onayAdimlari.find(step => step.adimSira === 1)?.onaylayan
        if (approver?.isActive) recipients.set(approver.id, approver)
      }
      if (rule.aliciRoller.includes('IKINCI_ONAYLAYAN')) {
        const approver = record.onayAdimlari.find(step => step.adimSira === 2)?.onaylayan
        if (approver?.isActive) recipients.set(approver.id, approver)
      }
      if (escalation) {
        const level = await db.yillikTakvimOnayKademesi.findFirst({ where: { sira: 2, aktif: true }, include: { user: { select: { id: true, name: true, email: true, isActive: true } } } })
        if (level?.user.isActive) recipients.set(level.user.id, level.user)
      }
      if (!recipients.size) missingRecipientCount++
      let duplicateForRule = false
      for (const recipient of recipients.values()) {
        const title = escalation ? 'Yıllık Takvim Eskalasyonu' : 'Yıllık Takvim Hatırlatması'
        const message = `“${record.kisaBaslik || record.surec}” kaydı için ${rule.tetik} tetiklendi.`
        const channels = rule.kanal.filter((channel): channel is 'HUB' | 'EPOSTA' => channel === 'HUB' || channel === 'EPOSTA')
        for (const channel of channels) {
          const key = { kayitId: record.id, tetik: rule.tetik, aliciEposta: recipient.email, gonderimGunu: today, kanal: channel }
          const existing = await db.yillikTakvimBildirimLog.findUnique({ where: { kayitId_tetik_aliciEposta_gonderimGunu_kanal: key } })
          if (existing?.sonuc === 'GONDERILDI') { skippedDuplicateCount++; duplicateForRule = true; continue }
          if (dryRun) continue

          try {
            if (channel === 'HUB') {
              await db.notification.create({ data: { userId: recipient.id, title, message, type: 'REMINDER', link: '/strategic-hr/yillik-calisma-takvimi' } })
            } else {
              const result = await sendEmail([{ email: recipient.email, name: recipient.name || 'Kullanıcı' }], title, `${message}\n\nILERIHub üzerinden kaydı görüntüleyebilirsiniz.`)
              if (!result.success) throw new Error(result.error || 'E-posta gönderilemedi')
            }
            await db.yillikTakvimBildirimLog.upsert({
              where: { kayitId_tetik_aliciEposta_gonderimGunu_kanal: key },
              create: { ...key, aliciUserId: recipient.id, sonuc: 'GONDERILDI' },
              update: { aliciUserId: recipient.id, sonuc: 'GONDERILDI', hataMesaji: null },
            })
            sentCount++
          } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
              skippedDuplicateCount++
              duplicateForRule = true
              continue
            }
            errorCount++
            const hataMesaji = error instanceof Error ? error.message : 'Bilinmeyen gönderim hatası'
            try {
              await db.yillikTakvimBildirimLog.upsert({
                where: { kayitId_tetik_aliciEposta_gonderimGunu_kanal: key },
                create: { ...key, aliciUserId: recipient.id, sonuc: 'HATA', hataMesaji },
                update: { aliciUserId: recipient.id, sonuc: 'HATA', hataMesaji },
              })
            } catch (logError) {
              if (logError instanceof Prisma.PrismaClientKnownRequestError && logError.code === 'P2002') skippedDuplicateCount++
              else console.error('[YCT bildirim log]', logError)
            }
          }
        }
      }
      candidates.push({ recordId: record.id, trigger: rule.tetik, kind: escalation ? 'ESKALASYON' : 'HATIRLATMA', targetUserCount: recipients.size, reason: difference < 0 ? `${Math.abs(difference)} gün gecikmiş` : difference === 0 ? 'Son gün' : `${difference} gün kaldı`, duplicate: duplicateForRule })
    }
  }
  return { dryRun, evaluatedRecordCount: records.length, candidateCount: candidates.length, skippedDuplicateCount, missingRecipientCount, candidates, ...(dryRun ? {} : { sentCount, errorCount }) }
}
