import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Egitim listesi
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

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
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

    const body = await request.json()
    const {
      title,
      description,
      trainingType,
      duration,
      location,
      trainerName,
      trainerTitle,
      trainerEmail,
      trainingDate,
      controlId,
      participants,
      status,
    } = body

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
        createdById: session.user.id || null,
        createdByName: session.user.name || null,
        participants: {
          create: (participants || []).map((p: any) => ({
            name: p.name,
            title: p.title || null,
            department: p.department || null,
            email: p.email || null,
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
