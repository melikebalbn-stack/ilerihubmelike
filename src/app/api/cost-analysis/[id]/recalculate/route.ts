import { NextRequest, NextResponse } from 'next/server'
import { recalculateCosts } from '@/lib/cost-analysis/calculations'
import { requireSession } from '@/lib/auth/require-session'

// POST - Maliyet analizini yeniden hesapla
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-cost-analysis: requireSession (sadece sistem hesaplama, auth yeterli)
    const { error } = await requireSession()
    if (error) return error

    const { id } = await params

    const result = await recalculateCosts(id)

    if (!result) {
      return NextResponse.json({ error: 'Maliyet analizi bulunamadı' }, { status: 404 })
    }

    return NextResponse.json({
      message: 'Maliyetler yeniden hesaplandı',
      ...result,
    })
  } catch (error) {
    console.error('Maliyet hesaplanırken hata:', error)
    return NextResponse.json(
      { error: 'Maliyet hesaplanırken bir hata oluştu' },
      { status: 500 }
    )
  }
}
