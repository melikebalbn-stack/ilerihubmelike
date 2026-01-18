import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Kullanıcının önerilerindeki son güncellemeleri getir
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email || typeof session.user.email !== 'string') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '5')
    const userEmail = String(session.user.email).toLowerCase()

    // Kullanıcının önerilerini getir - karar verilmiş olanları
    const suggestions = await prisma.suggestion.findMany({
      where: {
        isActive: true,
        submittedBy: { equals: userEmail, mode: 'insensitive' },
        status: { in: ['APPROVED', 'REJECTED', 'IN_PROGRESS', 'IMPLEMENTED', 'PENDING_APPROVAL'] }
      },
      select: {
        id: true,
        suggestionNumber: true,
        title: true,
        status: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: limit
    })

    // Durum açıklamalarını ekle
    const updates = suggestions.map(s => ({
      ...s,
      statusLabel: getStatusLabel(s.status),
      statusType: getStatusType(s.status),
      decisionDate: s.updatedAt
    }))

    return NextResponse.json(updates)
  } catch (error) {
    console.error('Öneri güncellemeleri yüklenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    'PENDING_APPROVAL': 'Kurul Onayı Bekliyor',
    'APPROVED': 'Onaylandı',
    'REJECTED': 'Reddedildi',
    'IN_PROGRESS': 'Uygulamaya Alındı',
    'IMPLEMENTED': 'Uygulandı'
  }
  return labels[status] || status
}

function getStatusType(status: string): 'success' | 'error' | 'warning' | 'info' {
  const types: Record<string, 'success' | 'error' | 'warning' | 'info'> = {
    'PENDING_APPROVAL': 'warning',
    'APPROVED': 'success',
    'REJECTED': 'error',
    'IN_PROGRESS': 'info',
    'IMPLEMENTED': 'success'
  }
  return types[status] || 'info'
}
