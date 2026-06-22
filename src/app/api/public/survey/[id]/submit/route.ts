import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { v4 as uuidv4 } from "uuid"

// POST - Submit survey response (no auth required)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: surveyId } = await params
    const body = await request.json()
    const { answers, respondentName, respondentDepartment } = body

    if (!answers || typeof answers !== "object") {
      return NextResponse.json(
        { error: "Yanıtlar gerekli" },
        { status: 400 }
      )
    }

    // Check if survey exists and is active
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        questions: {
          include: { options: true },
        },
      },
    })

    if (!survey) {
      return NextResponse.json(
        { error: "Anket bulunamadı" },
        { status: 404 }
      )
    }

    if (survey.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Bu anket şu anda aktif değil" },
        { status: 400 }
      )
    }

    // Get client info for anonymous tracking
    const ip = request.headers.get("x-forwarded-for") ||
               request.headers.get("x-real-ip") ||
               "unknown"
    const userAgent = request.headers.get("user-agent") || "unknown"

    // Create response
    const responseId = uuidv4()
    const anonymousId = uuidv4() // Anonim tanımlayıcı

    // Build answer records - handle both single and multiple choice
    const answerRecords: Array<{
      id: string
      questionId: string
      optionId: string | null
      textAnswer: string | null
    }> = []

    Object.entries(answers).forEach(([questionId, answer]) => {
      const question = survey.questions.find(q => q.id === questionId)

      if (Array.isArray(answer)) {
        // Multiple choice - create one record per selected option
        answer.forEach(optionOrText => {
          if (optionOrText.startsWith("other:")) {
            // Custom "Diğer" input
            answerRecords.push({
              id: uuidv4(),
              questionId,
              optionId: null,
              textAnswer: optionOrText.replace("other:", ""),
            })
          } else {
            // Regular option
            answerRecords.push({
              id: uuidv4(),
              questionId,
              optionId: optionOrText,
              textAnswer: null,
            })
          }
        })
      } else {
        // Single choice or text
        const answerStr = answer as string
        const isOption = question?.options.some(o => o.id === answerStr)
        answerRecords.push({
          id: uuidv4(),
          questionId,
          optionId: isOption ? answerStr : null,
          textAnswer: !isOption ? answerStr : null,
        })
      }
    })

    await prisma.surveyResponse.create({
      data: {
        id: responseId,
        surveyId,
        anonymousId,
        isComplete: true,
        respondentName: respondentName || null,
        respondentEmail: null,
        respondentDepartment: respondentDepartment || null,
        ipAddress: ip.split(",")[0].trim(),
        userAgent: userAgent.substring(0, 500),
        completedAt: new Date(),
        answers: {
          create: answerRecords,
        },
      },
    })

    // Update response count
    await prisma.survey.update({
      where: { id: surveyId },
      data: { updatedAt: new Date() },
    })

    return NextResponse.json({
      success: true,
      message: "Anket yanıtlarınız başarıyla kaydedildi",
    })
  } catch (error) {
    console.error("Survey submit error:", error)
    return NextResponse.json(
      { error: "Anket gönderilirken bir hata oluştu" },
      { status: 500 }
    )
  }
}
