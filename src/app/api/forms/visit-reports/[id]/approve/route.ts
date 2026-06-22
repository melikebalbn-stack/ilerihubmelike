import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/auth/require-user"

// POST - Raporu onayla
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-forms: requireUser — approvedById = user.id
    // PR-FORMS-RBAC: forms.approve permission'ı (eski enum check)
    const { session, user, error } = await requireUser()
    if (error) return error

    if (!session.user.permissions?.includes('forms.approve')) {
      return NextResponse.json({ error: "Onay yetkiniz yok" }, { status: 403 })
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
