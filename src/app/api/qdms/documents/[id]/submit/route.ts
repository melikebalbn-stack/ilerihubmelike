import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// POST - Dokümanı onaya gönder
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ message: "Yetkisiz erişim" }, { status: 401 })
    }

    const { id } = await params

    // Dokümanı kontrol et
    const document = await prisma.qdmsDocument.findUnique({
      where: { id },
    })

    if (!document) {
      return NextResponse.json({ message: "Doküman bulunamadı" }, { status: 404 })
    }

    // Sadece DRAFT durumundaki dokümanlar onaya gönderilebilir
    if (document.status !== "DRAFT") {
      return NextResponse.json(
        { message: "Sadece taslak durumundaki dokümanlar onaya gönderilebilir" },
        { status: 400 }
      )
    }

    // Dosya yüklenmiş mi kontrol et (opsiyonel - dosyasız da onaya gönderilebilir)
    // if (!document.fileName) {
    //   return NextResponse.json(
    //     { message: "Önce dosya yüklenmelidir" },
    //     { status: 400 }
    //   )
    // }

    // Kalite Müdürlerini bul
    const qualityManagers = await prisma.user.findMany({
      where: {
        role: { in: ["QUALITY_MANAGER", "ADMIN", "SUPER_ADMIN"] },
        isActive: true,
      },
      select: { id: true, name: true, email: true },
    })

    // Durumu PENDING_APPROVAL olarak güncelle ve onay kayıtları oluştur
    const updated = await prisma.$transaction(async (tx) => {
      // Eski bekleyen onay kayıtlarını temizle
      await tx.qdmsDocumentApproval.deleteMany({
        where: {
          documentId: id,
          status: "PENDING",
        },
      })

      // Dokümanı güncelle
      const doc = await tx.qdmsDocument.update({
        where: { id },
        data: {
          status: "PENDING_APPROVAL",
        },
        include: {
          owner: {
            select: { id: true, name: true },
          },
          department: {
            select: { id: true, name: true },
          },
        },
      })

      // Her kalite müdürü için onay kaydı oluştur
      if (qualityManagers.length > 0) {
        await tx.qdmsDocumentApproval.createMany({
          data: qualityManagers.map((qm) => ({
            documentId: id,
            approverId: qm.id,
            stepOrder: 1,
            stepName: "Kalite Onayı",
            status: "PENDING",
          })),
        })
      }

      return doc
    })

    return NextResponse.json({
      message: `Doküman onaya gönderildi. ${qualityManagers.length} kalite yöneticisine bildirilecek.`,
      document: updated,
      approvers: qualityManagers.map((qm) => qm.name),
    })
  } catch (error) {
    console.error("Onaya gönderme hatası:", error)
    return NextResponse.json({ message: "Sunucu hatası" }, { status: 500 })
  }
}
