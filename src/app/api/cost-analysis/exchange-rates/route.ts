import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { requireUser } from '@/lib/auth/require-user'

// GET - Döviz kurlarını listele
export async function GET(request: NextRequest) {
  try {
    // PR-Y2.5-cost-analysis: requireSession (read-only liste)
    const { error } = await requireSession()
    if (error) return error

    const { searchParams } = new URL(request.url)
    const latestOnly = searchParams.get('latestOnly') === 'true'

    let rates

    if (latestOnly) {
      // Her para birimi çifti için en son kuru getir
      rates = await prisma.$queryRaw`
        SELECT DISTINCT ON ("fromCurrency", "toCurrency") *
        FROM "CostExchangeRate"
        ORDER BY "fromCurrency", "toCurrency", "effectiveDate" DESC
      `
    } else {
      rates = await prisma.costExchangeRate.findMany({
        orderBy: [
          { fromCurrency: 'asc' },
          { toCurrency: 'asc' },
          { effectiveDate: 'desc' },
        ],
      })
    }

    return NextResponse.json(rates)
  } catch (error) {
    console.error('Döviz kurları alınırken hata:', error)
    return NextResponse.json(
      { error: 'Döviz kurları alınırken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// POST - Yeni döviz kuru ekle
export async function POST(request: NextRequest) {
  try {
    // PR-Y2.5-cost-analysis: requireUser + hasCostAnalysisAccess
    const { session, user, error } = await requireUser()
    if (error) return error
    if (!(session.user.permissions?.includes('costanalysis.admin') ?? false)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()
    const { fromCurrency, toCurrency, rate, effectiveDate } = body

    if (!fromCurrency || !toCurrency || !rate) {
      return NextResponse.json(
        { error: 'Kaynak para birimi, hedef para birimi ve kur zorunludur' },
        { status: 400 }
      )
    }

    if (fromCurrency === toCurrency) {
      return NextResponse.json(
        { error: 'Kaynak ve hedef para birimi aynı olamaz' },
        { status: 400 }
      )
    }

    const rateValue = parseFloat(rate)
    if (isNaN(rateValue) || rateValue <= 0) {
      return NextResponse.json(
        { error: 'Geçerli bir kur değeri giriniz' },
        { status: 400 }
      )
    }

    const effectiveDateValue = effectiveDate ? new Date(effectiveDate) : new Date()

    const exchangeRate = await prisma.costExchangeRate.create({
      data: {
        fromCurrency,
        toCurrency,
        rate: rateValue,
        effectiveDate: effectiveDateValue,
      },
    })

    return NextResponse.json(exchangeRate, { status: 201 })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Bu tarih için bu para birimi çifti zaten mevcut' },
        { status: 400 }
      )
    }
    console.error('Döviz kuru eklenirken hata:', error)
    return NextResponse.json(
      { error: 'Döviz kuru eklenirken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// DELETE - Döviz kuru sil
export async function DELETE(request: NextRequest) {
  try {
    // PR-Y2.5-cost-analysis: requireUser + hasCostAnalysisAccess
    const { session, user, error } = await requireUser()
    if (error) return error
    if (!(session.user.permissions?.includes('costanalysis.admin') ?? false)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Kur ID zorunludur' }, { status: 400 })
    }

    const rate = await prisma.costExchangeRate.findUnique({
      where: { id },
    })

    if (!rate) {
      return NextResponse.json({ error: 'Döviz kuru bulunamadı' }, { status: 404 })
    }

    await prisma.costExchangeRate.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Döviz kuru silindi' })
  } catch (error) {
    console.error('Döviz kuru silinirken hata:', error)
    return NextResponse.json(
      { error: 'Döviz kuru silinirken bir hata oluştu' },
      { status: 500 }
    )
  }
}
