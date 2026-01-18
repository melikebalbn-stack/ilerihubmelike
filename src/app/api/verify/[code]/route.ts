import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET - Doğrulama koduna göre imza bilgilerini getir
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params

    if (!code) {
      return NextResponse.json(
        { valid: false, error: "Doğrulama kodu gerekli" },
        { status: 400 }
      )
    }

    // Onay kaydını doğrulama koduna göre bul
    const approval = await prisma.qdmsDocumentApproval.findUnique({
      where: { verificationCode: code },
      include: {
        document: {
          select: {
            id: true,
            documentNumber: true,
            title: true,
            revisionNumber: true,
            category: true,
            status: true,
          },
        },
        approver: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    if (!approval) {
      return NextResponse.json({
        valid: false,
        error: "Bu doğrulama kodu geçersiz veya bulunamadı",
      })
    }

    // Sadece onaylanmış kayıtları doğrula
    if (approval.status !== "APPROVED") {
      return NextResponse.json({
        valid: false,
        error: "Bu doküman henüz onaylanmamış",
      })
    }

    return NextResponse.json({
      valid: true,
      document: {
        code: approval.document.documentNumber,
        title: approval.document.title,
        revisionNumber: approval.document.revisionNumber,
        type: approval.document.category,
        status: approval.document.status,
      },
      approval: {
        signedBy: approval.approver.name || approval.approver.email,
        signedAt: approval.signatureTimestamp?.toISOString() || approval.actionDate?.toISOString(),
        signatureHash: approval.signatureHash,
        status: approval.status,
      },
    })
  } catch (error) {
    console.error("Doğrulama hatası:", error)
    return NextResponse.json(
      { valid: false, error: "Doğrulama yapılırken bir hata oluştu" },
      { status: 500 }
    )
  }
}
