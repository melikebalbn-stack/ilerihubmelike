import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/auth/require-user"

// Kullanicinin atanmis egitimlerini getir
export async function GET() {
  try {
    // PR-Y2.5-iso27001-B: requireUser — kullanıcı kendi atamalarını filter
    const { user, error } = await requireUser()
    if (error) return error

    const assignments = await prisma.iso27001TrainingAssignment.findMany({
      where: { userId: user.id },
      include: {
        training: {
          select: {
            id: true,
            trainingNumber: true,
            title: true,
            description: true,
            trainingType: true,
            duration: true,
            isOnline: true,
            contentType: true,
            contentUrl: true,
            minViewTime: true,
            hasQuiz: true,
            passingScore: true,
            trainerName: true,
            trainerTitle: true,
            controlId: true,
          },
        },
      },
      orderBy: [
        { status: "asc" }, // Bekleyenler once
        { deadline: "asc" }, // Yakin tarihler once
      ],
    })

    // Istatistikler
    const stats = {
      total: assignments.length,
      pending: assignments.filter(a => a.status === "PENDING").length,
      inProgress: assignments.filter(a => a.status === "IN_PROGRESS").length,
      completed: assignments.filter(a => a.status === "COMPLETED").length,
      signed: assignments.filter(a => a.status === "SIGNED").length,
      expired: assignments.filter(a => a.status === "EXPIRED").length,
    }

    return NextResponse.json({
      assignments,
      stats,
    })
  } catch (error) {
    console.error("Egitim listesi hatasi:", error)
    return NextResponse.json(
      { error: "Egitimler alinamadi" },
      { status: 500 }
    )
  }
}
