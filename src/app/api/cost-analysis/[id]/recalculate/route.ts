import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { recalculateCosts } from '@/lib/cost-analysis/calculations'

// POST - Maliyet analizini yeniden hesapla
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
