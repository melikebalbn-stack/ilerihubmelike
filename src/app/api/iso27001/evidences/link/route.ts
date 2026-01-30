import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Mevcut bir kanıtı yeni bir kontrole bağla (dosyayı kopyalamadan referans oluştur)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

    const body = await request.json()
    const { evidenceId, controlId } = body

    if (!evidenceId || !controlId) {
      return NextResponse.json(
        { error: "evidenceId ve controlId zorunludur" },
        { status: 400 }
      )
    }

    // Mevcut kanıtı bul
    const existingEvidence = await prisma.iso27001Evidence.findUnique({
      where: { id: evidenceId },
      select: {
        title: true,
        description: true,
        evidenceType: true,
        fileName: true,
        fileUrl: true,
        fileType: true,
        referenceUrl: true,
        referenceNote: true,
      }
    })

    if (!existingEvidence) {
      return NextResponse.json({ error: "Kanıt bulunamadı" }, { status: 404 })
    }

    // Hedef kontrolü bul
    const control = await prisma.iso27001Control.findFirst({
      where: {
        OR: [{ id: controlId }, { controlId: controlId }]
      },
      select: { id: true, controlId: true }
    })

    if (!control) {
      return NextResponse.json({ error: "Kontrol bulunamadı" }, { status: 404 })
    }

    // Bu kontrolde aynı fileUrl ile kanıt var mı kontrol et
    if (existingEvidence.fileUrl) {
      const alreadyLinked = await prisma.iso27001Evidence.findFirst({
        where: {
          controlId: control.id,
          fileUrl: existingEvidence.fileUrl
        }
      })

      if (alreadyLinked) {
        return NextResponse.json(
          { error: "Bu kanıt zaten bu kontrole bağlı" },
          { status: 400 }
        )
      }
    }

    // Kullanıcı bilgilerini al
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true }
    })

    // Yeni kanıt kaydı oluştur (aynı dosyaya referans)
    const newEvidence = await prisma.iso27001Evidence.create({
      data: {
        controlId: control.id,
        title: existingEvidence.title,
        description: existingEvidence.description,
        evidenceType: existingEvidence.evidenceType as any,
        fileName: existingEvidence.fileName,
        fileUrl: existingEvidence.fileUrl,
        fileType: existingEvidence.fileType,
        referenceUrl: existingEvidence.referenceUrl,
        referenceNote: existingEvidence.referenceNote,
        evidenceDate: new Date(),
        uploadedById: user?.id || "system",
        uploadedByName: user?.name || session.user.email,
      },
      select: {
        id: true,
        title: true,
        evidenceType: true,
        fileName: true,
        fileUrl: true,
        evidenceDate: true,
      }
    })

    return NextResponse.json({
      success: true,
      evidence: newEvidence,
      message: "Kanıt başarıyla bağlandı"
    })
  } catch (error) {
    console.error("Kanıt bağlama hatası:", error)
    return NextResponse.json(
      { error: "Kanıt bağlanamadı" },
      { status: 500 }
    )
  }
}
