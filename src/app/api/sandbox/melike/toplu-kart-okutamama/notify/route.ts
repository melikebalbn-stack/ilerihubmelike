import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { requireUser } from '@/lib/auth/require-user'
import { getBulkCardScanAccess } from '../_lib/access'

export const dynamic = 'force-dynamic'

// GEÇİCİ: Gerçek İK e-posta adresi netleşene kadar bildirimler buraya gider.
// Melih/İK ile netleşince bu sabit gerçek İK adresiyle değiştirilecek.
const HR_NOTIFICATION_EMAIL = 'melike.balaban@ilerigroup.com'

/**
 * POST /api/sandbox/melike/toplu-kart-okutamama/notify
 * Manuel tetiklenen toplu bildirim maili — her kayıt eklendiğinde tek tek
 * mail ATILMAZ, kullanıcı "İK'ya Bildir" butonuna bastığında o an erişebildiği
 * kayıtların özetini tek seferde İK'ya (şimdilik test amaçlı sabit adrese) yollar.
 * Body: { recordIds?: string[] } — verilmezse erişilebilen tüm kayıtlar gönderilir.
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireUser()
    if (error) return error

    const access = await getBulkCardScanAccess(user.id)
    if (access.level === 'NONE') {
      return NextResponse.json({ error: 'Bu forma erişim yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const recordIds: string[] | undefined = body?.recordIds

    const where: Record<string, unknown> = {}
    if (access.level === 'GRI') {
      where.personnel = { bolum: access.bolum }
    }
    if (recordIds?.length) {
      where.id = { in: recordIds }
    }

    const records = await prisma.bulkCardScanFailure.findMany({
      where,
      include: { personnel: { select: { bolum: true } } },
      orderBy: { tarih: 'desc' },
    })

    if (records.length === 0) {
      return NextResponse.json({ error: 'Bildirilecek kayıt yok' }, { status: 400 })
    }

    const rows = records
      .map(
        (r) =>
          `${r.sicilNo || '-'} | ${r.adSoyad} | ${r.personnel?.bolum || '-'} | ` +
          `${new Date(r.tarih).toLocaleDateString('tr-TR')} | ${r.girisSaati || '-'} | ${r.cikisSaati || '-'}`
      )
      .join('\n')

    const body_ =
      `Toplu Kart Okutamama formunda ${records.length} kayıt bildiriliyor.\n\n` +
      `Sicil No | Ad Soyad | Bölüm | Tarih | Giriş | Çıkış\n${rows}\n\n` +
      `Bildiren: ${user.name || user.email}`

    const result = await sendEmail(
      [{ email: HR_NOTIFICATION_EMAIL, name: 'İK' }],
      `Toplu Kart Okutamama Bildirimi (${records.length} kayıt)`,
      body_
    )

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Mail gönderilemedi' }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: records.length })
  } catch (error) {
    console.error('Toplu kart okutamama bildirim hatası:', error)
    return NextResponse.json({ error: 'Bildirim gönderilemedi' }, { status: 500 })
  }
}
