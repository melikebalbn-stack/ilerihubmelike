import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth/require-session"

// Tüm benzersiz kanıtları listele (dosya URL'sine göre grupla)
export async function GET(request: NextRequest) {
  try {
    // PR-Y2.5-iso27001-C: requireSession (read-only liste)
    const { error } = await requireSession()
    if (error) return error

    // Tüm kanıtları getir, benzersiz fileUrl'lere göre grupla
    const evidences = await prisma.iso27001Evidence.findMany({
      where: {
        fileUrl: { not: null }
      },
      select: {
        id: true,
        title: true,
        description: true,
        evidenceType: true,
        fileName: true,
        fileUrl: true,
        fileType: true,
        evidenceDate: true,
        control: {
          select: {
            controlId: true,
          }
        }
      },
      orderBy: { createdAt: "desc" },
    })

    // Benzersiz dosyaları grupla (aynı fileUrl'ye sahip olanları birleştir)
    const uniqueEvidences = new Map<string, {
      id: string
      title: string
      description: string | null
      evidenceType: string
      fileName: string | null
      fileUrl: string
      fileType: string | null
      evidenceDate: Date
      usedInControls: string[]
    }>()

    for (const ev of evidences) {
      if (!ev.fileUrl) continue

      if (uniqueEvidences.has(ev.fileUrl)) {
        // Bu dosya zaten var, kontrol listesine ekle
        const existing = uniqueEvidences.get(ev.fileUrl)!
        if (!existing.usedInControls.includes(ev.control.controlId)) {
          existing.usedInControls.push(ev.control.controlId)
        }
      } else {
        // Yeni dosya
        uniqueEvidences.set(ev.fileUrl, {
          id: ev.id,
          title: ev.title,
          description: ev.description,
          evidenceType: ev.evidenceType,
          fileName: ev.fileName,
          fileUrl: ev.fileUrl,
          fileType: ev.fileType,
          evidenceDate: ev.evidenceDate,
          usedInControls: [ev.control.controlId]
        })
      }
    }

    return NextResponse.json({
      evidences: Array.from(uniqueEvidences.values())
    })
  } catch (error) {
    console.error("Kanıt listesi hatası:", error)
    return NextResponse.json(
      { error: "Kanıtlar alınamadı" },
      { status: 500 }
    )
  }
}
