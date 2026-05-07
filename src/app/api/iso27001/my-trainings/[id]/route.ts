import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"
import { requireUser } from "@/lib/auth/require-user"

// Tek egitim detayi getir
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-iso27001-B: requireUser — kendi atama lookup'ı
    const { user, error } = await requireUser()
    if (error) return error

    const { id: trainingId } = await params

    const assignment = await prisma.iso27001TrainingAssignment.findUnique({
      where: {
        trainingId_userId: {
          trainingId,
          userId: user.id,
        },
      },
      include: {
        training: true,
      },
    })

    if (!assignment) {
      return NextResponse.json({ error: "Egitim atamasi bulunamadi" }, { status: 404 })
    }

    return NextResponse.json(assignment)
  } catch (error) {
    console.error("Egitim detay hatasi:", error)
    return NextResponse.json(
      { error: "Egitim alinamadi" },
      { status: 500 }
    )
  }
}

// Egitim ilerlemesini guncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-iso27001-B: requireUser
    const { user, error } = await requireUser()
    if (error) return error

    const { id: trainingId } = await params
    const body = await request.json()
    const { action, viewTime, progress, quizScore } = body

    // Mevcut atamayi bul
    const assignment = await prisma.iso27001TrainingAssignment.findUnique({
      where: {
        trainingId_userId: {
          trainingId,
          userId: user.id,
        },
      },
      include: {
        training: true,
      },
    })

    if (!assignment) {
      return NextResponse.json({ error: "Egitim atamasi bulunamadi" }, { status: 404 })
    }

    // Action'a gore islem yap
    let updateData: any = {}

    switch (action) {
      case "start":
        // Egitimi baslat
        if (assignment.status === "PENDING") {
          updateData = {
            status: "IN_PROGRESS",
            startedAt: new Date(),
          }
        }
        break

      case "progress":
        // Ilerleme guncelle
        updateData = {
          viewTime: (assignment.viewTime || 0) + (viewTime || 0),
          progress: Math.min(progress || assignment.progress, 100),
        }

        // Minimum goruntuleme suresi kontrolu
        const training = assignment.training
        if (training.minViewTime && updateData.viewTime >= training.minViewTime) {
          // Quiz yoksa direkt tamamlandi
          if (!training.hasQuiz) {
            updateData.status = "COMPLETED"
            updateData.completedAt = new Date()
          }
        }
        break

      case "quiz":
        // Quiz sonucu kaydet
        updateData = {
          quizScore: quizScore,
          quizAttempts: assignment.quizAttempts + 1,
        }

        // Gecme notu kontrolu
        const passingScore = assignment.training.passingScore || 70
        if (quizScore >= passingScore) {
          updateData.quizPassedAt = new Date()
          updateData.status = "COMPLETED"
          updateData.completedAt = new Date()
        }
        break

      case "complete":
        // Manuel tamamlama (quiz yoksa)
        if (!assignment.training.hasQuiz && assignment.progress >= 100) {
          updateData = {
            status: "COMPLETED",
            completedAt: new Date(),
          }
        }
        break

      default:
        return NextResponse.json({ error: "Gecersiz action" }, { status: 400 })
    }

    const updated = await prisma.iso27001TrainingAssignment.update({
      where: {
        trainingId_userId: {
          trainingId,
          userId: user.id,
        },
      },
      data: updateData,
      include: {
        training: {
          select: { title: true },
        },
      },
    })

    return NextResponse.json({
      success: true,
      assignment: updated,
    })
  } catch (error) {
    console.error("Egitim guncelleme hatasi:", error)
    return NextResponse.json(
      { error: "Egitim guncellenemedi" },
      { status: 500 }
    )
  }
}
