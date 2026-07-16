import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { ileriHubUrl } from '@/lib/email-templates/akademi/_base'
import { getWeeklyPerformance, resolveAllowedDepts } from '@/lib/overtime-performance'
import { buildPerfEmailHtml, buildPerfEmailText } from '@/lib/email-templates/overtime-performance'

export const dynamic = 'force-dynamic'

// Haftalık: ÖNCEKİ hafta (Pzt 00:00 → Paz 23:59) onaylı mesai performansı → 'yonetim-raporu' rolüne mail.
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // weekStart: test için ?weekStart=YYYY-MM-DD (o haftanın Pzt'si); prod → ÖNCEKİ hafta Pzt.
  const { searchParams } = new URL(req.url)
  const wsParam = searchParams.get('weekStart')
  let weekStart: Date
  if (wsParam && /^\d{4}-\d{2}-\d{2}$/.test(wsParam)) {
    weekStart = new Date(`${wsParam}T00:00:00.000Z`)
  } else {
    const now = new Date()
    const dow = now.getUTCDay() // 0=Paz..6=Cmt
    const thisMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((dow + 6) % 7)))
    weekStart = new Date(thisMonday.getTime() - 7 * 86400000) // önceki hafta Pzt
  }
  const weekEndDay = new Date(weekStart.getTime() + 6 * 86400000)
  const weekEnd = new Date(`${weekEndDay.toISOString().slice(0, 10)}T23:59:59.999Z`)

  const fmt = (d: Date) => d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })
  const tarihMetni = `${fmt(weekStart)} – ${fmt(weekEndDay)}`

  const wsStr = weekStart.toISOString().slice(0, 10)
  const weStr = weekEndDay.toISOString().slice(0, 10)

  // PR-FAZ2A: alıcı = rol (yonetim-raporu); içerik = HER alıcının görünür bölümleri (boş/admin → tümü).
  const recipients = await prisma.user.findMany({
    where: { isActive: true, userRoles: { some: { role: { slug: 'yonetim-raporu' } } } },
    select: { id: true, email: true, name: true },
  })
  const valid = recipients.filter((r) => r.email)
  if (valid.length === 0) {
    console.log('[perf-weekly] yonetim-raporu rolünde aktif alıcı yok — mail atlandı')
    return NextResponse.json({ ok: true, weekStart: wsStr, weekEnd: weStr, sent: 0, reason: 'alıcı yok' })
  }

  let sent = 0
  let bosVeri = 0
  for (const r of valid) {
    const allowedDepts = await resolveAllowedDepts(r.id)
    const data = await getWeeklyPerformance(weekStart, weekEnd, allowedDepts)
    if (data.bolumler.length === 0) { bosVeri++; continue } // bu kişinin bölümlerinde veri yok → gönderme
    const opts = {
      baslik: 'Haftalık Mesai Performansı',
      tarihMetni,
      sayfaUrl: ileriHubUrl(`/forms/overtime/performans?date=${data.weekEnd}`),
      haftalikMi: true,
    }
    const res = await sendEmail(
      [{ email: r.email!, name: r.name ?? r.email! }],
      `Haftalık Mesai Performansı — ${tarihMetni}`,
      buildPerfEmailText(data, opts),
      buildPerfEmailHtml(data, opts),
    )
    if (res.success) sent++
  }

  console.log(`[perf-weekly] ${wsStr}..${weStr}: alıcı=${valid.length}, gönderildi=${sent}, veri-yok=${bosVeri}`)
  return NextResponse.json({ ok: true, weekStart: wsStr, weekEnd: weStr, alici: valid.length, sent, bosVeri })
}
