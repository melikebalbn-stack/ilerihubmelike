import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-forms: requireSession (read-only email log)
    const { error } = await requireSession()
    if (error) return error

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
