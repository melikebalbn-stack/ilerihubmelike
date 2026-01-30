import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// POST - Raporu onayla
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
    }

    // Yönetici kontrolü
    const allowedRoles = ['ADMIN', 'SUPER_ADMIN', 'DEPT_HEAD', 'SUPERVISOR']
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Onay yetkiniz yok" }, { status: 403 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 })
    }

    const { id } = await params
    const body = await request.json()
    const { action } = body // 'approve' veya 'reject'

    const report = await prisma.visitReport.findUnique({
      where: { id }
    })

    if (!report) {
      return NextResponse.json({ error: "Rapor bulunamadı" }, { status: 404 })
    }

    if (report.status !== 'PENDING') {
      return NextResponse.json({ error: "Sadece onay bekleyen raporlar işlenebilir" }, { status: 400 })
    }

    const updatedReport = await prisma.visitReport.update({
      where: { id },
      data: {
        status: action === 'approve' ? 'APPROVED' : 'REJECTED',
        approvedById: user.id,
        approvedAt: new Date()
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } }
      }
    })

    return NextResponse.json(updatedReport)
  } catch (error) {
    console.error("Onay işlemi başarısız:", error)
    return NextResponse.json({ error: "Onay işlemi başarısız" }, { status: 500 })
  }
}
