import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const logs = await prisma.visitReportEmailLog.findMany({
      where: { reportId: id },
      orderBy: { sentAt: 'desc' },
    })

    return NextResponse.json(logs)
  } catch (error) {
    console.error('Email logları alınırken hata:', error)
    return NextResponse.json({ error: 'Loglar alınırken hata oluştu' }, { status: 500 })
  }
}
