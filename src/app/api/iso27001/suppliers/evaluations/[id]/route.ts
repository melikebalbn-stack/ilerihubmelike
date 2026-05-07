import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth/require-session"

// Değerlendirme detayı
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-iso27001-B: requireSession
    const { error } = await requireSession()
    if (error) return error

    const { id } = await params

    const evaluation = await prisma.supplierEvaluation.findUnique({
      where: { id },
      include: {
        supplier: true,
        criteria: {
          include: {
            criteria: true,
          },
        },
      },
    })

    if (!evaluation) {
      return NextResponse.json({ error: "Değerlendirme bulunamadı" }, { status: 404 })
    }

    return NextResponse.json(evaluation)
  } catch (error) {
    console.error("Değerlendirme detay hatası:", error)
    return NextResponse.json(
      { error: "Değerlendirme alınamadı" },
      { status: 500 }
    )
  }
}

// Değerlendirme güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-iso27001-B: requireSession
    const { error } = await requireSession()
    if (error) return error

    const { id } = await params
    const body = await request.json()
    const { criteriaScores, generalNotes, improvements, status } = body

    const existing = await prisma.supplierEvaluation.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Değerlendirme bulunamadı" }, { status: 404 })
    }

    const updateData: any = {}

    if (generalNotes !== undefined) updateData.generalNotes = generalNotes
    if (improvements !== undefined) updateData.improvements = improvements
    if (status !== undefined) updateData.status = status

    // Kriter puanları değiştiyse yeniden hesapla
    if (criteriaScores && criteriaScores.length > 0) {
      // Mevcut puanları sil
      await prisma.supplierCriteriaScore.deleteMany({
        where: { evaluationId: id },
      })

      // Yeni puanları oluştur
      await prisma.supplierCriteriaScore.createMany({
        data: criteriaScores.map((cs: { criteriaId: string; score: number; notes?: string }) => ({
          evaluationId: id,
          criteriaId: cs.criteriaId,
          score: cs.score,
          notes: cs.notes || null,
        })),
      })

      // Toplam puan yeniden hesapla
      const totalScore = criteriaScores.reduce(
        (sum: number, cs: { score: number }) => sum + cs.score,
        0
      )

      let resultGroup: "A_APPROVED" | "B_CANDIDATE" | "C_REJECTED"
      if (totalScore >= 70) {
        resultGroup = "A_APPROVED"
      } else if (totalScore >= 50) {
        resultGroup = "B_CANDIDATE"
      } else {
        resultGroup = "C_REJECTED"
      }

      updateData.totalScore = totalScore
      updateData.resultGroup = resultGroup
      updateData.isApproved = totalScore >= 50
    }

    const evaluation = await prisma.supplierEvaluation.update({
      where: { id },
      data: updateData,
      include: {
        supplier: true,
        criteria: {
          include: {
            criteria: true,
          },
        },
      },
    })

    // Kriter puanları değiştiyse tedarikçiyi de güncelle
    if (criteriaScores && criteriaScores.length > 0) {
      await prisma.supplier.update({
        where: { id: existing.supplierId },
        data: {
          lastScore: evaluation.totalScore,
          lastEvalDate: evaluation.evaluationDate,
          group: evaluation.resultGroup,
        },
      })
    }

    return NextResponse.json({
      success: true,
      evaluation,
    })
  } catch (error) {
    console.error("Değerlendirme güncelleme hatası:", error)
    return NextResponse.json(
      { error: "Değerlendirme güncellenemedi" },
      { status: 500 }
    )
  }
}

// Değerlendirme sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-iso27001-B: requireSession
    const { error } = await requireSession()
    if (error) return error

    const { id } = await params

    const existing = await prisma.supplierEvaluation.findUnique({
      where: { id },
      select: { id: true, evaluationNo: true, supplierId: true },
    })

    if (!existing) {
      return NextResponse.json({ error: "Değerlendirme bulunamadı" }, { status: 404 })
    }

    await prisma.supplierEvaluation.delete({ where: { id } })

    // Tedarikçinin kalan en son değerlendirmesini bul ve güncelle
    const lastEval = await prisma.supplierEvaluation.findFirst({
      where: { supplierId: existing.supplierId },
      orderBy: { evaluationDate: "desc" },
      select: { totalScore: true, evaluationDate: true, resultGroup: true },
    })

    if (lastEval) {
      await prisma.supplier.update({
        where: { id: existing.supplierId },
        data: {
          lastScore: lastEval.totalScore,
          lastEvalDate: lastEval.evaluationDate,
          group: lastEval.resultGroup,
        },
      })
    } else {
      // Hiç değerlendirme kalmadıysa sıfırla
      await prisma.supplier.update({
        where: { id: existing.supplierId },
        data: {
          lastScore: null,
          lastEvalDate: null,
          group: "PENDING",
        },
      })
    }

    return NextResponse.json({
      success: true,
      message: `${existing.evaluationNo} numaralı değerlendirme silindi`,
    })
  } catch (error) {
    console.error("Değerlendirme silme hatası:", error)
    return NextResponse.json(
      { error: "Değerlendirme silinemedi" },
      { status: 500 }
    )
  }
}
