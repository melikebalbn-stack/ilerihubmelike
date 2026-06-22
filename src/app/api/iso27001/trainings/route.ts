import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth/require-session"
import { requireUser } from "@/lib/auth/require-user"

// Egitim listesi
export async function GET() {
  try {
    // PR-Y2.5-iso27001-B: requireSession
    const { error } = await requireSession()
    if (error) return error

    const trainings = await prisma.iso27001Training.findMany({
      orderBy: { trainingDate: "desc" },
      include: {
        participants: true,
        _count: {
          select: {
            assignments: true,
          },
        },
      },
    })

    return NextResponse.json(trainings)
  } catch (error) {
    console.error("Egitim listesi hatasi:", error)
    return NextResponse.json(
      { error: "Egitimler alinamadi" },
      { status: 500 }
    )
  }
}

// Yeni egitim olustur
export async function POST(request: NextRequest) {
  try {
    // PR-Y2.5-iso27001-B: requireUser — DB user (createdBy) gerek
    const { user, error } = await requireUser()
    if (error) return error

    const body = await request.json()
    const {
      title,
      description,
      trainingType,
      duration,
      location,
      trainerName,
      trainerTitle,
      trainingDate,
      controlId,
      participants,
      status,
    } = body
    // PR-Y2.5: input boundary normalization — DB email lowercase invariant
    const trainerEmail = typeof body.trainerEmail === 'string' && body.trainerEmail.trim() !== ''
      ? body.trainerEmail.toLowerCase()
      : null

    if (!title || !trainerName || !trainingDate) {
      return NextResponse.json(
        { error: "Egitim konusu, egitimci ve tarih zorunludur" },
        { status: 400 }
      )
    }

    // Egitim numarasi olustur: TRN-YYYY-XXX
    const year = new Date(trainingDate).getFullYear()
    const lastTraining = await prisma.iso27001Training.findFirst({
      where: {
        trainingNumber: {
          startsWith: `TRN-${year}`,
        },
      },
      orderBy: { trainingNumber: "desc" },
      select: { trainingNumber: true },
    })

    let nextNum = 1
    if (lastTraining) {
      const parts = lastTraining.trainingNumber.split("-")
      const lastNum = parseInt(parts[2])
      nextNum = lastNum + 1
    }
    const trainingNumber = `TRN-${year}-${String(nextNum).padStart(3, "0")}`

    // Egitimi olustur
    const training = await prisma.iso27001Training.create({
      data: {
        trainingNumber,
        title,
        description: description || null,
        trainingType: trainingType || "AWARENESS",
        duration: duration || 60,
        location: location || null,
        trainerName,
        trainerTitle: trainerTitle || null,
        trainerEmail: trainerEmail || null,
        trainingDate: new Date(trainingDate),
        controlId: controlId || "A.6.3", // Varsayilan olarak A.6.3
        status: status || "COMPLETED",
        createdById: user.id,
        createdByName: user.name || user.email,
        participants: {
          create: (participants || []).map((p: any) => ({
            name: p.name,
            title: p.title || null,
            department: p.department || null,
            // PR-Y2.5: input boundary normalization
            email: typeof p.email === 'string' && p.email.trim() !== '' ? p.email.toLowerCase() : null,
            attended: p.attended !== false,
            signedAt: p.signedAt ? new Date(p.signedAt) : new Date(trainingDate),
          })),
        },
      },
      include: {
        participants: true,
      },
    })

    return NextResponse.json({
      success: true,
      training,
      message: "Egitim kaydedildi",
    })
  } catch (error) {
    console.error("Egitim olusturma hatasi:", error)
    return NextResponse.json(
      { error: "Egitim olusturulamadi" },
      { status: 500 }
    )
  }
}
