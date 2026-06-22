import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// İmza doğrulama (public endpoint - login gerektirmez)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get("code")

    if (!code) {
      return NextResponse.json(
        { error: "Imza kodu gerekli" },
        { status: 400 }
      )
    }

    // İmzayı bul
    const signature = await prisma.iso27001Signature.findUnique({
      where: { signatureCode: code },
      include: {
        document: {
          select: {
            id: true,
            documentNumber: true,
            title: true,
            version: true,
            contentHash: true,
            status: true,
          },
        },
      },
    })

    if (!signature) {
      return NextResponse.json({
        valid: false,
        message: "Imza kodu bulunamadi. Gecersiz veya yanlis kod.",
      })
    }

    // Hash kontrolü - doküman değişmiş mi?
    const hashMatch = signature.documentHash === signature.document.contentHash

    return NextResponse.json({
      valid: true,
      verified: signature.isVerified,
      hashMatch,
      signature: {
        code: signature.signatureCode,
        signedAt: signature.signedAt,
        signerName: signature.signerName,
        signerTitle: signature.signerTitle,
        signerDepartment: signature.signerDepartment,
        signatureType: signature.signatureType,
      },
      document: {
        number: signature.document.documentNumber,
        title: signature.document.title,
        version: signature.document.version,
        status: signature.document.status,
      },
      message: hashMatch
        ? "Imza gecerli. Dokuman imzalandiktan sonra degistirilmemis."
        : "UYARI: Dokuman imzalandiktan sonra degistirilmis olabilir!",
    })
  } catch (error) {
    console.error("Imza dogrulama hatasi:", error)
    return NextResponse.json(
      { error: "Dogrulama sirasinda hata olustu" },
      { status: 500 }
    )
  }
}
