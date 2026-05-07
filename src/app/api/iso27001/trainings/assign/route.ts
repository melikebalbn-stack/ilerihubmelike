import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendPushToUser } from "@/lib/push-notifications"
import { requireSession } from "@/lib/auth/require-session"
import { requireUser } from "@/lib/auth/require-user"

// Egitimi kullanicilara ata
export async function POST(request: NextRequest) {
  try {
    // PR-Y2.5-iso27001-B: requireUser — DB user (assignedBy) gerek
    const { user, error } = await requireUser()
    if (error) return error

    const body = await request.json()
    const { trainingId, userIds, deadline } = body

    if (!trainingId || !userIds || userIds.length === 0) {
      return NextResponse.json(
        { error: "Egitim ID ve kullanici listesi zorunludur" },
        { status: 400 }
      )
    }

    // Egitimi kontrol et
    const training = await prisma.iso27001Training.findUnique({
      where: { id: trainingId },
      select: { id: true, title: true, isOnline: true },
    })

    if (!training) {
      return NextResponse.json({ error: "Egitim bulunamadi" }, { status: 404 })
    }

    // Kullanicilara ata
    const assignments = []
    const errors = []

    for (const userId of userIds) {
      try {
        // Mevcut atama var mi kontrol et
        const existing = await prisma.iso27001TrainingAssignment.findUnique({
          where: {
            trainingId_userId: {
              trainingId,
              userId,
            },
          },
        })

        if (existing) {
          errors.push({ userId, error: "Zaten atanmis" })
          continue
        }

        const assignment = await prisma.iso27001TrainingAssignment.create({
          data: {
            trainingId,
            userId,
            assignedById: user.id,
            assignedByName: user.name || user.email,
            deadline: deadline ? new Date(deadline) : null,
            status: "PENDING",
          },
          include: {
            user: {
              select: { id: true, name: true, email: true, department: true },
            },
          },
        })

        assignments.push(assignment)

        // Bildirim gonder (opsiyonel)
        try {
          const notifMsg = `"${training.title}" egitimi size atandi. Lutfen tamamlayin.`
          await prisma.notification.create({
            data: {
              userId,
              title: "Yeni Egitim Atandi",
              message: notifMsg,
              type: "INFO",
              link: `/my-trainings/${trainingId}`,
            },
          })
          sendPushToUser(prisma, userId, {
            title: "Yeni Eğitim Atandı",
            body: notifMsg,
            url: `/my-trainings/${trainingId}`,
          }).catch(() => {})
        } catch (e) {
          // Bildirim gonderme hatasi kritik degil
          console.error("Bildirim gonderilemedi:", e)
        }
      } catch (error) {
        errors.push({ userId, error: "Atama yapilamadi" })
      }
    }

    return NextResponse.json({
      success: true,
      message: `${assignments.length} kullaniciya egitim atandi`,
      assignments,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error("Egitim atama hatasi:", error)
    return NextResponse.json(
      { error: "Egitim atanamadi" },
      { status: 500 }
    )
  }
}

// Egitim atamalarini getir
export async function GET(request: NextRequest) {
  try {
    // PR-Y2.5-iso27001-B: requireSession
    const { error } = await requireSession()
    if (error) return error

    const { searchParams } = new URL(request.url)
    const trainingId = searchParams.get("trainingId")

    if (!trainingId) {
      return NextResponse.json(
        { error: "Egitim ID zorunludur" },
        { status: 400 }
      )
    }

    const assignments = await prisma.iso27001TrainingAssignment.findMany({
      where: { trainingId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            jobTitle: true,
          },
        },
      },
      orderBy: { assignedAt: "desc" },
    })

    return NextResponse.json(assignments)
  } catch (error) {
    console.error("Atama listesi hatasi:", error)
    return NextResponse.json(
      { error: "Atamalar alinamadi" },
      { status: 500 }
    )
  }
}
