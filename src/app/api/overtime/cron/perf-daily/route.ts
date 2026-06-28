import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { ileriHubUrl } from '@/lib/email-templates/akademi/_base'
import { getDailyPerformance } from '@/lib/overtime-performance'
import { buildPerfEmailHtml, buildPerfEmailText } from '@/lib/email-templates/overtime-performance'

export const dynamic = 'force-dynamic'

// Cron pattern (x-cron-secret) + sendEmail (mail-guard) — check-overdue deseni.
// Günlük: DÜN'e ait onaylı mesai performansı → 'uretim-planlama' rolüne mail.
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Tarih: test için ?date=YYYY-MM-DD; prod cron parametresiz → DÜN.
  const { searchParams } = new URL(req.url)
  const dateParam = searchParams.get('date')
  let date: Date
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    date = new Date(`${dateParam}T00:00:00.000Z`)
  } else {
    const now = new Date()
    const y = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1))
    date = y
  }
  const dateStr = date.toISOString().slice(0, 10)
  const tarihMetni = date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })

  const data = await getDailyPerformance(date)
  if (data.bolumler.length === 0) {
    console.log(`[perf-daily] ${dateStr}: onaylı mesai performans verisi yok — mail atlandı`)
    return NextResponse.json({ ok: true, date: dateStr, sent: false, reason: 'veri yok' })
  }

  const recipients = await prisma.user.findMany({
    where: { isActive: true, userRoles: { some: { role: { slug: 'uretim-planlama' } } } },
    select: { email: true, name: true },
  })
  const to = recipients.filter((r) => r.email).map((r) => ({ email: r.email!, name: r.name ?? r.email! }))
  if (to.length === 0) {
    console.log('[perf-daily] uretim-planlama rolünde aktif alıcı yok — mail atlandı')
    return NextResponse.json({ ok: true, date: dateStr, sent: false, reason: 'alıcı yok' })
  }

  const opts = {
    baslik: 'Günlük Mesai Performansı',
    tarihMetni,
    sayfaUrl: ileriHubUrl(`/forms/overtime/performans?date=${dateStr}`),
    haftalikMi: false,
  }
  const res = await sendEmail(
    to,
    `Günlük Mesai Performansı — ${tarihMetni}`,
    buildPerfEmailText(data, opts),
    buildPerfEmailHtml(data, opts),
  )

  console.log(`[perf-daily] ${dateStr}: ${data.bolumler.length} bölüm, ${to.length} alıcı, gönderildi=${res.success}`)
  return NextResponse.json({ ok: true, date: dateStr, bolumler: data.bolumler.length, alici: to.length, sent: res.success, error: res.error })
}
