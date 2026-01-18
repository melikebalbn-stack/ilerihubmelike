import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET - Onay bekleyen dokümanları listele (Kalite Müdürü için)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ message: "Yetkisiz erişim" }, { status: 401 })
    }

    // Kullanıcıyı email ile bul
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!dbUser) {
      return NextResponse.json(
        { message: "Kullanıcı bulunamadı" },
        { status: 401 }
      )
    }

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
