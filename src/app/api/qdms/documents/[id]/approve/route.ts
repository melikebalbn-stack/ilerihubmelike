import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import * as crypto from "crypto"
import { v4 as uuidv4 } from "uuid"

// Dijital imza hash'i oluştur
function generateSignatureHash(
  documentId: string,
  documentNumber: string,
  revisionNumber: number,
  approverEmail: string,
  approverName: string,
  timestamp: Date
): string {
  const dataToHash = `${documentId}|${documentNumber}|${revisionNumber}|${approverEmail}|${approverName}|${timestamp.toISOString()}`
  return crypto.createHash("sha256").update(dataToHash).digest("hex")
}

// POST - Dokümanı onayla veya reddet
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Sadece QUALITY_MANAGER veya ADMIN onaylayabilir
    if (!["QUALITY_MANAGER", "ADMIN", "SUPER_ADMIN"].includes(dbUser.role)) {
      return NextResponse.json(
        { message: "Bu işlem için yetkiniz bulunmuyor" },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { action, comments } = body // action: "approve" | "reject"

    if (!action || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { message: "Geçersiz işlem. 'approve' veya 'reject' olmalı" },
        { status: 400 }
      )
    }

    // Dokümanı kontrol et
    const document = await prisma.qdmsDocument.findUnique({
      where: { id },
      include: {
        approvals: {
          where: { approverId: dbUser.id },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    })

    if (!document) {
      return NextResponse.json({ message: "Doküman bulunamadı" }, { status: 404 })
    }

    // Sadece PENDING_APPROVAL durumundaki dokümanlar onaylanabilir
    if (document.status !== "PENDING_APPROVAL") {
      return NextResponse.json(
        { message: "Bu doküman onay bekliyor durumunda değil" },
        { status: 400 }
      )
    }

    // Onay kaydını bul veya oluştur
    let approval = document.approvals[0]

    if (!approval) {
      // Yeni onay kaydı oluştur
      approval = await prisma.qdmsDocumentApproval.create({
        data: {
          documentId: id,
          approverId: dbUser.id,
          stepOrder: 1,
          stepName: "Kalite Onayı",
          status: "PENDING",
        },
      })
    }

    if (action === "approve") {
      // Dijital imza bilgilerini oluştur
      const signatureTimestamp = new Date()
      const verificationCode = uuidv4()
      const signatureHash = generateSignatureHash(
        document.id,
        document.documentNumber,
        document.revisionNumber,
        dbUser.email,
        dbUser.name || dbUser.email,
        signatureTimestamp
      )

      // IP adresi ve User Agent bilgisini al
      const forwardedFor = request.headers.get("x-forwarded-for")
      const signerIpAddress = forwardedFor ? forwardedFor.split(",")[0].trim() : "unknown"
      const signerUserAgent = request.headers.get("user-agent") || "unknown"

      // Dokümanı onayla
      await prisma.$transaction([
        // Onay kaydını dijital imza bilgileriyle güncelle
        prisma.qdmsDocumentApproval.update({
          where: { id: approval.id },
          data: {
            status: "APPROVED",
            comments: comments || null,
            actionDate: signatureTimestamp,
            // Dijital imza alanları
            signatureHash,
            signatureTimestamp,
            signerIpAddress,
            signerUserAgent,
            verificationCode,
          },
        }),
        // Doküman durumunu güncelle
        prisma.qdmsDocument.update({
          where: { id },
          data: {
            status: "PUBLISHED",
            effectiveDate: new Date(),
          },
        }),
      ])

      // QR doğrulama URL'i oluştur
      const baseUrl = process.env.NEXTAUTH_URL || "https://ilerihub.ilerigroup.com"
      const verificationUrl = `${baseUrl}/verify/${verificationCode}`

      return NextResponse.json({
        message: "Doküman onaylandı ve dijital olarak imzalandı",
        status: "PUBLISHED",
        signature: {
          verificationCode,
          verificationUrl,
          signatureHash,
          signedAt: signatureTimestamp.toISOString(),
          signedBy: dbUser.name || dbUser.email,
        },
      })
    } else {
      // Dokümanı reddet
      await prisma.$transaction([
        // Onay kaydını güncelle
        prisma.qdmsDocumentApproval.update({
          where: { id: approval.id },
          data: {
            status: "REJECTED",
            comments: comments || null,
            actionDate: new Date(),
          },
        }),
        // Doküman durumunu taslak'a geri çevir
        prisma.qdmsDocument.update({
          where: { id },
          data: {
            status: "DRAFT",
          },
        }),
      ])

      return NextResponse.json({
        message: "Doküman reddedildi ve taslak durumuna döndürüldü",
        status: "DRAFT",
        rejectReason: comments,
      })
    }
  } catch (error) {
    console.error("Onay işlemi hatası:", error)
    return NextResponse.json({ message: "Sunucu hatası" }, { status: 500 })
  }
}
