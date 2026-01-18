import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET - Eğitim kayıtlarını listele
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ message: "Yetkisiz erişim" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")
    const type = searchParams.get("type")
    const status = searchParams.get("status")

    const where: any = {}

    if (search) {
      where.OR = [
        { trainingTitle: { contains: search, mode: "insensitive" } },
      ]
    }

    if (type) {
      where.trainingType = type
    }

    if (status) {
      where.status = status
    }

    const trainings = await prisma.qdmsTrainingRecord.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true },
        },
        trainer: {
          select: { id: true, name: true },
        },
      },
      orderBy: { assignedAt: "desc" },
    })

    // Map to frontend expected format - grupla eğitim başlığına göre
    const groupedTrainings: Record<string, any> = {}

    trainings.forEach(t => {
      const key = t.trainingTitle
      if (!groupedTrainings[key]) {
        groupedTrainings[key] = {
          id: t.id,
          trainingCode: `TRN-${t.id.substring(0, 8).toUpperCase()}`,
          title: t.trainingTitle,
          type: t.trainingType,
          status: t.status,
          trainer: t.trainer?.name || null,
          plannedDate: t.dueDate || t.assignedAt,
          actualDate: t.completedAt,
          duration: 60,
          participantCount: 0,
          location: null,
          createdAt: t.createdAt,
        }
      }
      groupedTrainings[key].participantCount++
    })

    return NextResponse.json(Object.values(groupedTrainings))
  } catch (error) {
    console.error("Eğitim listesi hatası:", error)
    return NextResponse.json({ message: "Sunucu hatası" }, { status: 500 })
  }
}

// POST - Yeni eğitim kaydı oluştur
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ message: "Yetkisiz erişim" }, { status: 401 })
    }

    const body = await request.json()
    const { title, type, trainer, plannedDate, description } = body

    // Validasyon
    if (!title || !type || !plannedDate) {
      return NextResponse.json(
        { message: "Başlık, tür ve tarih zorunludur" },
        { status: 400 }
      )
    }

    // Mevcut kullanıcı için eğitim kaydı oluştur
    const training = await prisma.qdmsTrainingRecord.create({
      data: {
        trainingTitle: title,
        trainingType: type,
        dueDate: new Date(plannedDate),
        notes: description,
        status: "NOT_STARTED",
        userId: session.user.id,
      },
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
    })

    // Map to frontend expected format
    const result = {
      id: training.id,
      trainingCode: `TRN-${training.id.substring(0, 8).toUpperCase()}`,
      title: training.trainingTitle,
      type: training.trainingType,
      status: training.status === "NOT_STARTED" ? "PLANNED" : training.status,
      trainer: trainer || null,
      plannedDate: training.dueDate || training.assignedAt,
      actualDate: training.completedAt,
      duration: 60,
      participantCount: 1,
      location: null,
      createdAt: training.createdAt,
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error("Eğitim oluşturma hatası:", error)
    return NextResponse.json({ message: "Sunucu hatası" }, { status: 500 })
  }
}
