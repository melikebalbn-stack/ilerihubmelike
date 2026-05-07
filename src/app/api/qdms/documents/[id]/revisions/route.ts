import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth/require-session"

// GET - Revizyon geçmişini getir
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-qdms: requireSession (userId JWT'de mevcut)
    const { userId, error } = await requireSession()
    if (error) return error

    const { id } = await params

    const document = await prisma.qdmsDocument.findUnique({
      where: { id },
      include: {
        revisions: {
          include: {
            revisedBy: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    })

    if (!document) {
      return NextResponse.json({ message: "Doküman bulunamadı" }, { status: 404 })
    }

    return NextResponse.json({
      currentVersion: document.version,
      revisionNumber: document.revisionNumber,
      revisions: document.revisions,
    })
  } catch (error) {
    console.error("Revizyon geçmişi hatası:", error)
    return NextResponse.json({ message: "Sunucu hatası" }, { status: 500 })
  }
}

// POST - Yeni revizyon oluştur
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-qdms: requireSession (userId JWT'de mevcut)
    const { userId, error } = await requireSession()
    if (error) return error

    const { id } = await params
    const body = await request.json()
    const { changeDescription, newVersion } = body

    if (!changeDescription) {
      return NextResponse.json(
        { message: "Değişiklik açıklaması zorunludur" },
        { status: 400 }
      )
    }

    const document = await prisma.qdmsDocument.findUnique({
      where: { id },
    })

    if (!document) {
      return NextResponse.json({ message: "Doküman bulunamadı" }, { status: 404 })
    }

    // Sadece yayınlanmış dokümanlar revize edilebilir
    if (document.status !== "PUBLISHED") {
      return NextResponse.json(
        { message: "Sadece yayınlanmış dokümanlar revize edilebilir" },
        { status: 400 }
      )
    }

    // Yeni versiyon numarasını hesapla
    const currentParts = document.version.split(".")
    let calculatedVersion: string

    if (newVersion) {
      calculatedVersion = newVersion
    } else {
      // Minor version artır (1.0 -> 1.1)
      const minor = parseInt(currentParts[1] || "0") + 1
      calculatedVersion = `${currentParts[0]}.${minor}`
    }

    // Transaction ile revizyon oluştur
    const result = await prisma.$transaction(async (tx) => {
      // Mevcut versiyonu revizyon geçmişine kaydet
      const revision = await tx.qdmsDocumentRevision.create({
        data: {
          documentId: id,
          version: document.version,
          revisionNumber: document.revisionNumber,
          changeDescription,
          fileName: document.fileName,
          fileUrl: document.fileUrl,
          fileSize: document.fileSize,
          revisedById: userId,
        },
      })

      // Dokümanı güncelle
      const updatedDocument = await tx.qdmsDocument.update({
        where: { id },
        data: {
          version: calculatedVersion,
          revisionNumber: document.revisionNumber + 1,
          status: "DRAFT", // Revizyon sonrası tekrar taslak
          // Dosya bilgilerini temizle - yeni dosya yüklenmesi gerekecek
          fileName: null,
          fileUrl: null,
          fileSize: null,
          mimeType: null,
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

      return { revision, document: updatedDocument }
    })

    return NextResponse.json({
      message: "Revizyon oluşturuldu",
      ...result,
    }, { status: 201 })
  } catch (error) {
    console.error("Revizyon oluşturma hatası:", error)
    return NextResponse.json({ message: "Sunucu hatası" }, { status: 500 })
  }
}
