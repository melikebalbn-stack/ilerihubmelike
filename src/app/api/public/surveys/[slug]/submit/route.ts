import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface SubmitBody {
  respondentName: string
  respondentDepartment: string
  answers: Record<string, string | string[]>
}

// Public anket yanitini kaydet (login gerektirmez)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const body: SubmitBody = await request.json()

    // Anketi kontrol et
    const survey = await prisma.survey.findFirst({
      where: {
        publicSlug: slug,
        isPublic: true,
        status: 'ACTIVE'
      },
      include: {
        questions: {
          include: {
            options: true
          }
        }
      }
    })

    if (!survey) {
      return NextResponse.json(
        { error: 'Anket bulunamadi veya artik aktif degil.' },
        { status: 404 }
      )
    }

    // Zaman kontrolu
    const now = new Date()
    if (survey.startsAt && new Date(survey.startsAt) > now) {
      return NextResponse.json(
        { error: 'Bu anket henuz baslamadi.' },
        { status: 403 }
      )
    }
    if (survey.endsAt && new Date(survey.endsAt) < now) {
      return NextResponse.json(
        { error: 'Bu anketin suresi doldu.' },
        { status: 403 }
      )
    }

    // İsim ve departman artık opsiyonel - validasyon kaldırıldı

    // Zorunlu sorulari kontrol et
    if (survey.requireAllQuestions) {
      for (const question of survey.questions) {
        if (question.isRequired) {
          const answer = body.answers[question.id]
          if (!answer || (Array.isArray(answer) && answer.length === 0)) {
            return NextResponse.json(
              { error: `"${question.questionText}" sorusu zorunludur.` },
              { status: 400 }
            )
          }
        }
      }
    }

    // IP adresi (opsiyonel - spam kontrolu icin)
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown'

    // Yaniti kaydet
    const response = await prisma.surveyResponse.create({
      data: {
        surveyId: survey.id,
        respondentName: body.respondentName?.trim() || null,
        respondentDepartment: body.respondentDepartment?.trim() || null,
        ipAddress: ip,
        isComplete: true,
        completedAt: new Date(),
        answers: {
          create: Object.entries(body.answers).map(([questionId, answer]) => {
            const question = survey.questions.find(q => q.id === questionId)

            if (Array.isArray(answer)) {
              // Coklu secim
              return answer.map(optionId => ({
                questionId,
                optionId,
                textAnswer: null,
                numericAnswer: null
              }))
            } else if (question?.questionType === 'SINGLE_CHOICE' || question?.questionType === 'DROPDOWN') {
              // Tek secim - optionId
              return {
                questionId,
                optionId: answer,
                textAnswer: null,
                numericAnswer: null
              }
            } else if (question?.questionType === 'RATING' || question?.questionType === 'SCALE') {
              // Numeric
              return {
                questionId,
                optionId: null,
                textAnswer: null,
                numericAnswer: parseInt(answer) || null
              }
            } else if (question?.questionType === 'YES_NO') {
              // Yes/No
              return {
                questionId,
                optionId: null,
                textAnswer: answer,
                numericAnswer: null
              }
            } else {
              // Metin
              return {
                questionId,
                optionId: null,
                textAnswer: answer,
                numericAnswer: null
              }
            }
          }).flat()
        }
      }
    })

    return NextResponse.json({
      success: true,
      responseId: response.id,
      message: 'Yanitiniz basariyla kaydedildi.'
    })
  } catch (error) {
    console.error('Public survey submit error:', error)
    return NextResponse.json(
      { error: 'Yanit kaydedilirken bir hata olustu.' },
      { status: 500 }
    )
  }
}
