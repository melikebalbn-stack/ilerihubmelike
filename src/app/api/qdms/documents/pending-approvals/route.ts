import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/auth/require-user"

// GET - Onay bekleyen dokümanları listele (Kalite Müdürü için)
export async function GET(request: NextRequest) {
  try {
    // PR-Y2.5-qdms: requireUser — role check icin
    const { user: dbUser, error } = await requireUser()
    if (error) return error

    // Sadece QUALITY_MANAGER veya ADMIN görebilir
    if (!["QUALITY_MANAGER", "ADMIN", "SUPER_ADMIN"].includes(dbUser.role)) {
      return NextResponse.json(
        { message: "Bu işlem için yetkiniz bulunmuyor" },
        { status: 403 }
      )
    }

    // Onay bekleyen dokümanları getir
    const pendingDocuments = await prisma.qdmsDocument.findMany({
      where: {
        status: "PENDING_APPROVAL",
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
        department: {
          select: { id: true, name: true },
        },
        approvals: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            approver: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    })

    // Her doküman için onay durumunu ekle
    const documentsWithApprovalInfo = pendingDocuments.map((doc) => ({
      ...doc,
      pendingSince: doc.updatedAt,
      hasApprovalRecord: doc.approvals.length > 0,
      lastApproval: doc.approvals[0] || null,
    }))

    return NextResponse.json({
      documents: documentsWithApprovalInfo,
      count: documentsWithApprovalInfo.length,
    })
  } catch (error) {
    console.error("Onay bekleyen dokümanlar listesi hatası:", error)
    return NextResponse.json({ message: "Sunucu hatası" }, { status: 500 })
  }
}
