import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"

// Benzersiz imza kodu oluştur
function generateSignatureCode(): string {
  const year = new Date().getFullYear()
  const month = String(new Date().getMonth() + 1).padStart(2, "0")
  const day = String(new Date().getDate()).padStart(2, "0")
  const random = crypto.randomBytes(4).toString("hex").toUpperCase()
  return `ILH-SIG-${year}${month}${day}-${random}`
}

// Doküman imzalama
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { signatureType, notes } = body

    // Dokümanı bul
    const document = await prisma.iso27001Document.findUnique({
      where: { id },
    })

    if (!document) {
      return NextResponse.json({ error: "Dokuman bulunamadi" }, { status: 404 })
    }

    // Kullanıcı zaten imzalamış mı kontrol et
    const existingSignature = await prisma.iso27001Signature.findFirst({
      where: {
        documentId: id,
        signerEmail: session.user.email,
        signatureType: signatureType || "APPROVAL",
      },
    })

    if (existingSignature) {
      return NextResponse.json(
        { error: "Bu dokumani zaten imzalamissiniz" },
        { status: 400 }
      )
    }

    // IP adresi ve User Agent al
    const forwarded = request.headers.get("x-forwarded-for")
    const ipAddress = forwarded ? forwarded.split(",")[0] : request.headers.get("x-real-ip") || "unknown"
    const userAgent = request.headers.get("user-agent") || "unknown"

    // Benzersiz imza kodu
    const signatureCode = generateSignatureCode()

    // Kullanıcı bilgilerini al
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        name: true,
        email: true,
        jobTitle: true,
        department: true,
      },
    })

    // İmza oluştur
    const signature = await prisma.iso27001Signature.create({
      data: {
        documentId: id,
        signerId: user?.id || session.user.id || "",
        signerName: user?.name || session.user.name || "",
        signerEmail: session.user.email,
        signerTitle: user?.jobTitle || null,
        signerDepartment: user?.department || null,
        signatureCode,
        signedAt: new Date(),
        documentHash: document.contentHash || "",
        ipAddress,
        userAgent,
        signatureType: signatureType || "APPROVAL",
        notes: notes || null,
        isVerified: true,
        verifiedAt: new Date(),
      },
    })

    // Doküman durumunu güncelle (eğer APPROVAL imzası ise)
    if (signatureType === "APPROVAL" || !signatureType) {
      await prisma.iso27001Document.update({
        where: { id },
        data: {
          status: "APPROVED",
          approvedById: user?.id || session.user.id || "",
          approvedByName: user?.name || session.user.name || "",
          approvedAt: new Date(),
        },
      })
    }

    return NextResponse.json({
      success: true,
      signature: {
        id: signature.id,
        signatureCode: signature.signatureCode,
        signedAt: signature.signedAt,
        signerName: signature.signerName,
        signatureType: signature.signatureType,
      },
      message: `Dokuman basariyla imzalandi. Imza Kodu: ${signatureCode}`,
    })
  } catch (error) {
    console.error("Imzalama hatasi:", error)
    return NextResponse.json(
      { error: "Imzalama sirasinda hata olustu" },
      { status: 500 }
    )
  }
}

// Doküman imzalarını listele
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

    const { id } = await params

    const signatures = await prisma.iso27001Signature.findMany({
      where: { documentId: id },
      orderBy: { signedAt: "desc" },
    })

    return NextResponse.json(signatures)
  } catch (error) {
    console.error("Imza listesi hatasi:", error)
    return NextResponse.json(
      { error: "Imzalar alinamadi" },
      { status: 500 }
    )
  }
}
