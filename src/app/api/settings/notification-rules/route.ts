import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { NotificationRuleType, NotificationRulePeriod } from '@/generated/prisma'

export const dynamic = 'force-dynamic'

// GET - Tüm bildirim kurallarını listele
export async function GET() {
  try {
    const rules = await prisma.calibrationNotificationRule.findMany({
      where: { isActive: true },
      orderBy: [
        { type: 'asc' },
        { days: 'asc' },
      ],
    })

    return NextResponse.json(rules)
  } catch (error) {
    console.error('Bildirim kuralları alınırken hata:', error)
    return NextResponse.json(
      { error: 'Kurallar alınırken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// POST - Yeni bildirim kuralı ekle
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, period, days, repeatWeekly } = body

    // Validasyon
    if (!type || !['EXPIRING', 'EXPIRED'].includes(type)) {
      return NextResponse.json(
        { error: 'Geçerli bir durum tipi seçiniz' },
        { status: 400 }
      )
    }

    if (!period || !['BEFORE', 'AFTER'].includes(period)) {
      return NextResponse.json(
        { error: 'Geçerli bir periyod seçiniz' },
        { status: 400 }
      )
    }

    if (!days || days < 1 || days > 30) {
      return NextResponse.json(
        { error: 'Gün sayısı 1-30 arasında olmalıdır' },
        { status: 400 }
      )
    }

    // Mantıksal kontrol: EXPIRING sadece BEFORE ile, EXPIRED sadece AFTER ile kullanılmalı
    if (type === 'EXPIRING' && period === 'AFTER') {
      return NextResponse.json(
        { error: 'Süresi Yaklaşan için sadece "Kala" seçeneği kullanılabilir' },
        { status: 400 }
      )
    }

    if (type === 'EXPIRED' && period === 'BEFORE') {
      return NextResponse.json(
        { error: 'Süresi Dolan için sadece "Sonra" seçeneği kullanılabilir' },
        { status: 400 }
      )
    }

    // Aynı kural var mı kontrol et
    const existing = await prisma.calibrationNotificationRule.findFirst({
      where: {
        type: type as NotificationRuleType,
        period: period as NotificationRulePeriod,
        days,
        isActive: true,
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Bu kural zaten mevcut' },
        { status: 400 }
      )
    }

    const rule = await prisma.calibrationNotificationRule.create({
      data: {
        type: type as NotificationRuleType,
        period: period as NotificationRulePeriod,
        days,
        repeatWeekly: repeatWeekly || false,
      },
    })

    return NextResponse.json(rule, { status: 201 })
  } catch (error) {
    console.error('Bildirim kuralı eklenirken hata:', error)
    return NextResponse.json(
      { error: 'Kural eklenirken bir hata oluştu' },
      { status: 500 }
    )
  }
}
