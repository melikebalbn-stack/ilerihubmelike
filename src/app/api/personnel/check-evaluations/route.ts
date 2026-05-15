import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { requireUser } from '@/lib/auth/require-user'

export const dynamic = 'force-dynamic'

/**
 * POST/GET: Personel bildirim kontrol sistemi:
 * 1. Deneme (2 ay) ve 6 ay değerlendirme tarihleri — 1 hafta önce bildirim
 * 2. Belge süreleri (İlk Yardım, Yangın Sertifikası, MYK) — 1 ay önce + süresi dolunca bildirim
 *
 * İV ekibine e-posta gönderir. Tekrar gönderimi PersonnelEvaluationEmailLog ile engeller.
 *
 * Auth (PR-PERSONNEL-SECURITY):
 * - Sistem cron bypass: x-cron-secret header CRON_SECRET ile eşleşirse session zorunlu değil
 * - Manuel tetikleme: SUPER_ADMIN/ADMIN role check (HR e-posta gönderir, kötüye kullanım önlemi)
 */
async function checkAuth(request: NextRequest): Promise<NextResponse | null> {
  const cronSecret = request.headers.get('x-cron-secret')
  const isCron = !!cronSecret && cronSecret === process.env.CRON_SECRET

  if (isCron) return null

  const { user, error } = await requireUser()
  if (error) return error

  if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Bu endpoint sadece cron job veya admin tarafından çağrılabilir' },
      { status: 403 }
    )
  }

  return null
}
async function runCheck() {
  const now = new Date()
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  // İV ekibi e-posta listesi
  const hrUsers = await prisma.user.findMany({
    where: {
      isActive: true,
      department: { contains: 'insan', mode: 'insensitive' },
    },
    select: { email: true, name: true },
  })

  const hrRecipients = hrUsers
    .filter((u) => typeof u.email === 'string' && u.email.length > 0)
    .map(u => ({ email: u.email as string, name: u.name || (u.email as string) }))

  if (hrRecipients.length === 0) {
    return { success: true, message: 'İV ekibi bulunamadı', sent: 0 }
  }

  let sent = 0

  async function alreadySent(personnelId: string, type: string): Promise<boolean> {
    const log = await prisma.personnelEvaluationEmailLog.findFirst({
      where: { personnelId, type, sentAt: { gte: today } },
    })
    return !!log
  }

  async function logAndSend(
    items: { id: string; sicilNo: string | null; adSoyad: string; bolum: string; gorev: string }[],
    type: string,
    subject: string,
    body: string
  ) {
    if (items.length === 0) return
    const toSend = []
    for (const p of items) {
      if (!(await alreadySent(p.id, type))) toSend.push(p)
    }
    if (toSend.length === 0) return

    const r = await sendEmail(hrRecipients, subject, body)
    if (r.success) {
      sent++
      for (const p of toSend) {
        await prisma.personnelEvaluationEmailLog.create({
          data: { personnelId: p.id, type, recipientEmails: hrRecipients.map(x => x.email).join(', '), subject },
        })
      }
    }
  }

  // ──────────────────────────────────────────
  // 1. DEĞERLENDİRME TARİHLERİ (1 hafta önce)
  // ──────────────────────────────────────────

  const evalTarget = new Date(today)
  evalTarget.setUTCDate(evalTarget.getUTCDate() + 7)
  const evalEnd = new Date(evalTarget)
  evalEnd.setUTCDate(evalEnd.getUTCDate() + 1)

  const [twoMonthList, sixMonthList] = await Promise.all([
    prisma.personnel.findMany({
      where: { aktif: true, denemeDegerlendirme: { gte: evalTarget, lt: evalEnd } },
      select: { id: true, sicilNo: true, adSoyad: true, bolum: true, gorev: true, iseGirisTarihi: true, denemeDegerlendirme: true },
    }),
    prisma.personnel.findMany({
      where: { aktif: true, altiAyDegerlendirme: { gte: evalTarget, lt: evalEnd } },
      select: { id: true, sicilNo: true, adSoyad: true, bolum: true, gorev: true, iseGirisTarihi: true, altiAyDegerlendirme: true },
    }),
  ])

  if (twoMonthList.length > 0) {
    await logAndSend(
      twoMonthList, 'TWO_MONTH',
      `⏰ Deneme Süresi (2 Ay) Değerlendirme Hatırlatması - ${twoMonthList.length} personel`,
      buildEvalBody('Deneme Süresi (2 Ay)', twoMonthList.map(p => ({
        sicilNo: p.sicilNo, adSoyad: p.adSoyad, bolum: p.bolum, gorev: p.gorev,
        date: p.denemeDegerlendirme!, label: '1 hafta sonra',
      })))
    )
  }

  if (sixMonthList.length > 0) {
    await logAndSend(
      sixMonthList, 'SIX_MONTH',
      `⏰ İlk 6 Ay Değerlendirme Hatırlatması - ${sixMonthList.length} personel`,
      buildEvalBody('İlk 6 Ay', sixMonthList.map(p => ({
        sicilNo: p.sicilNo, adSoyad: p.adSoyad, bolum: p.bolum, gorev: p.gorev,
        date: p.altiAyDegerlendirme!, label: '1 hafta sonra',
      })))
    )
  }

  // ──────────────────────────────────────────
  // 2. BELGE SÜRELERİ (1 ay önce + süresi dolunca)
  // ──────────────────────────────────────────

  const certTarget30 = new Date(today)
  certTarget30.setUTCDate(certTarget30.getUTCDate() + 30)
  const certTarget30End = new Date(certTarget30)
  certTarget30End.setUTCDate(certTarget30End.getUTCDate() + 1)

  const certFields = [
    { field: 'ilkYardimciBelgesi' as const, label: 'İlk Yardımcı Belgesi' },
    { field: 'yanginSertifikasi' as const, label: 'Yangın Sertifikası' },
    { field: 'mykBelgesiTarihi' as const, label: 'MYK Belgesi' },
  ]

  for (const cert of certFields) {
    // 1 ay önce uyarı
    const expiring: any[] = await prisma.personnel.findMany({
      where: {
        aktif: true,
        [cert.field]: { gte: certTarget30, lt: certTarget30End },
      },
      select: { id: true, sicilNo: true, adSoyad: true, bolum: true, gorev: true, [cert.field]: true },
    })

    if (expiring.length > 0) {
      const typeKey = `${cert.field}_EXPIRING`
      await logAndSend(
        expiring, typeKey,
        `⚠️ ${cert.label} Süresi Yaklaşıyor - ${expiring.length} personel (30 gün)`,
        buildCertBody(cert.label, 'yaklaşıyor', expiring.map((p: any) => ({
          sicilNo: p.sicilNo, adSoyad: p.adSoyad, bolum: p.bolum, gorev: p.gorev,
          date: p[cert.field] as Date, daysText: '30 gün kaldı',
        })))
      )
    }

    // Süresi dolmuş (bugün veya geçmiş)
    const expired: any[] = await prisma.personnel.findMany({
      where: {
        aktif: true,
        [cert.field]: { lt: today },
      },
      select: { id: true, sicilNo: true, adSoyad: true, bolum: true, gorev: true, [cert.field]: true },
    })

    if (expired.length > 0) {
      // Süresi dolanlar için haftada 1 (Pazartesi) hatırlatma
      const dayOfWeek = now.getDay()
      if (dayOfWeek === 1) { // Pazartesi
        const typeKey = `${cert.field}_EXPIRED`
        await logAndSend(
          expired, typeKey,
          `🚨 ${cert.label} Süresi Dolmuş - ${expired.length} personel`,
          buildCertBody(cert.label, 'dolmuş', expired.map((p: any) => {
            const expDate = p[cert.field] as Date
            const daysPast = Math.floor((today.getTime() - expDate.getTime()) / 86400000)
            return {
              sicilNo: p.sicilNo, adSoyad: p.adSoyad, bolum: p.bolum, gorev: p.gorev,
              date: expDate, daysText: `${daysPast} gün geçti`,
            }
          }))
        )
      }
    }
  }

  return {
    success: true,
    sent,
    recipientCount: hrRecipients.length,
    twoMonthCount: twoMonthList.length,
    sixMonthCount: sixMonthList.length,
  }
}

// ──────────────────────────────────────────
// E-posta şablonları
// ──────────────────────────────────────────

function buildEvalBody(
  evalType: string,
  items: { sicilNo: string | null; adSoyad: string; bolum: string; gorev: string; date: Date; label: string }[]
): string {
  const dateStr = new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const lines = items.map((p, i) =>
    `${i + 1}. ${p.adSoyad} (${p.sicilNo})
   📍 Bölüm: ${p.bolum}
   👔 Görev: ${p.gorev}
   ⏰ Değerlendirme Tarihi: ${p.date.toLocaleDateString('tr-TR')} (${p.label})`
  ).join('\n\n')

  return `⏰ ${evalType} Değerlendirme Hatırlatması
Tarih: ${dateStr}

Aşağıdaki personelin ${evalType} değerlendirme tarihi yaklaşmaktadır.
Lütfen değerlendirme sürecini başlatınız.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${lines}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Toplam: ${items.length} personel

--
Bu e-posta otomatik olarak ILERIHub İnsan Varlıkları Yönetim Sistemi tarafından gönderilmiştir.
© 2025 İleri Group`
}

function buildCertBody(
  certName: string,
  status: 'yaklaşıyor' | 'dolmuş',
  items: { sicilNo: string; adSoyad: string; bolum: string; gorev: string; date: Date; daysText: string }[]
): string {
  const dateStr = new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const icon = status === 'yaklaşıyor' ? '⚠️' : '🚨'
  const header = status === 'yaklaşıyor'
    ? `${icon} ${certName} Süresi Yaklaşan Personel`
    : `${icon} ${certName} Süresi Dolmuş Personel — ACİL`
  const message = status === 'yaklaşıyor'
    ? `Aşağıdaki personelin ${certName.toLowerCase()} süresi 30 gün içinde dolacaktır.\nLütfen yenileme işlemlerini başlatınız.`
    : `⚠️ Aşağıdaki personelin ${certName.toLowerCase()} süresi DOLMUŞTUR.\nACİL olarak yenileme işlemi yapılmalıdır!`

  const lines = items.map((p, i) =>
    `${i + 1}. ${p.adSoyad} (${p.sicilNo})
   📍 Bölüm: ${p.bolum}
   👔 Görev: ${p.gorev}
   📅 Geçerlilik Tarihi: ${p.date.toLocaleDateString('tr-TR')}
   ⏱️  ${p.daysText}`
  ).join('\n\n')

  return `${header}
Tarih: ${dateStr}

${message}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${lines}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Toplam: ${items.length} personel

--
Bu e-posta otomatik olarak ILERIHub İnsan Varlıkları Yönetim Sistemi tarafından gönderilmiştir.
© 2025 İleri Group`
}

export async function POST(request: NextRequest) {
  const authError = await checkAuth(request)
  if (authError) return authError

  try {
    const result = await runCheck()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Personel değerlendirme/belge kontrolü hatası:', error)
    return NextResponse.json({ success: false, error: 'Kontrol başarısız' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
