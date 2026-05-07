import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth/require-session"
import { requireUser } from "@/lib/auth/require-user"

// BGYS Farkindalik Egitimi - 07/08/2025
const INITIAL_TRAINING = {
  title: "BGYS Farkindalik Egitimi",
  description: "ISO 27001 kapsaminda duzenlenen bilgi guvenligi farkindalik egitimi. Egitim, bilgi guvenligi temel prensipleri, politikalar ve prosedurler hakkinda bilgilendirme icermektedir.",
  trainingType: "AWARENESS",
  duration: 60, // 1 saat
  location: "1. Toplanti Odasi",
  trainerName: "Hasan Engin",
  trainerTitle: "IT Uzmani",
  trainingDate: new Date("2025-08-07"),
  controlId: "A.6.3",
  status: "COMPLETED",
  participants: [
    { name: "Muhammet Demir", title: "CMM Operatoru" },
    { name: "Sedat Acar", title: "Enjeksiyon Operatoru" },
    { name: "Adem Bozkurt", title: "Montaj Operatoru" },
    { name: "Gokmen Yilmaz", title: "CAD-CAM Operatoru" },
    { name: "Eren Goksel Ileri", title: "Kilit Musteri Yoneticisi" },
    { name: "Ali Alper Ari", title: "Bakim Operatoru" },
    { name: "Ibrahim Aydemir", title: "ARGE Elemani" },
    { name: "Ensar Mansiz", title: "Kaynak Operatoru" },
    { name: "Cengiz Emir", title: "Bakim Operatoru" },
  ],
}

export async function POST() {
  try {
    // PR-Y2.5-iso27001-B: requireUser
    const { user, error } = await requireUser()
    if (error) return error

    // Mevcut egitimi kontrol et
    const existing = await prisma.iso27001Training.findFirst({
      where: {
        title: INITIAL_TRAINING.title,
        trainingDate: INITIAL_TRAINING.trainingDate,
      },
    })

    if (existing) {
      return NextResponse.json({
        success: false,
        message: "Bu egitim zaten kayitli",
        training: existing,
      })
    }

    // Egitim numarasi olustur
    const year = INITIAL_TRAINING.trainingDate.getFullYear()
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
        title: INITIAL_TRAINING.title,
        description: INITIAL_TRAINING.description,
        trainingType: INITIAL_TRAINING.trainingType as any,
        duration: INITIAL_TRAINING.duration,
        location: INITIAL_TRAINING.location,
        trainerName: INITIAL_TRAINING.trainerName,
        trainerTitle: INITIAL_TRAINING.trainerTitle,
        trainingDate: INITIAL_TRAINING.trainingDate,
        controlId: INITIAL_TRAINING.controlId,
        status: INITIAL_TRAINING.status as any,
        createdById: user.id,
        createdByName: user.name || user.email,
        participants: {
          create: INITIAL_TRAINING.participants.map((p) => ({
            name: p.name,
            title: p.title,
            attended: true,
            signedAt: INITIAL_TRAINING.trainingDate,
          })),
        },
      },
      include: {
        participants: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: "BGYS Farkindalik Egitimi kaydedildi",
      training,
    })
  } catch (error) {
    console.error("Egitim seed hatasi:", error)
    return NextResponse.json(
      { error: "Egitim kaydedilemedi" },
      { status: 500 }
    )
  }
}

// Mevcut egitim sayisini getir
export async function GET() {
  try {
    // PR-Y2.5-iso27001-B: requireSession
    const { error } = await requireSession()
    if (error) return error

    const count = await prisma.iso27001Training.count()
    const participantCount = await prisma.iso27001TrainingParticipant.count()

    return NextResponse.json({
      trainings: count,
      participants: participantCount,
    })
  } catch (error) {
    return NextResponse.json({ error: "Sayim yapilamadi" }, { status: 500 })
  }
}
