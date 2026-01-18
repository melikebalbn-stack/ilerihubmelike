import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { v4 as uuidv4 } from 'uuid'

// POST - Ankete yanıt ver
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const userEmail = String(session.user.email).toLowerCase()
    const userDepartment = session.user.department
    const userRole = session.user.role || 'EMPLOYEE'

    // Anketi kontrol et
    const survey = await prisma.survey.findUnique({
      where: { id },
      include: {
        questions: {
          include: {
            options: true
          }
        }
      }
    })

    if (!survey) {
      return NextResponse.json({ error: 'Anket bulunamadi' }, { status: 404 })
    }

    // Aktif mi kontrol et
    if (survey.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Bu anket aktif degil' }, { status: 400 })
    }

    // Süresi geçmiş mi
    if (survey.endsAt && new Date(survey.endsAt) < new Date()) {
      return NextResponse.json({ error: 'Bu anketin suresi dolmus' }, { status: 400 })
    }

    // Hedef kitle kontrolü
    if (survey.targetType === 'DEPARTMENTS' &&
        !survey.targetDepartments.includes(userDepartment || '')) {
      return NextResponse.json({ error: 'Bu anket sizin departmaniniz icin degil' }, { status: 403 })
    }

    if (survey.targetType === 'ROLES' &&
        !survey.targetRoles.includes(userRole)) {
      return NextResponse.json({ error: 'Bu anket sizin rolunuz icin degil' }, { status: 403 })
    }

    // Daha önce yanıtladı mı
    if (!survey.allowMultipleResponses) {
      const existingResponse = await prisma.surveyResponse.findFirst({
        where: {
          surveyId: id,
          OR: [
            { respondentEmail: userEmail },
            ...(survey.isAnonymous ? [] : [])
          ]
        }
      })

      if (existingResponse) {
        return NextResponse.json({
          error: 'Bu anketi zaten yanitladiniz'
        }, { status: 400 })
      }
    }

    const body = await request.json()
    const { answers } = body

    if (!answers || !Array.isArray(answers)) {
      return NextResponse.json({ error: 'Yanitlar zorunludur' }, { status: 400 })
    }

    // Zorunlu soruları kontrol et
    if (survey.requireAllQuestions) {
      const requiredQuestions = survey.questions.filter(q => q.isRequired)
      const answeredQuestionIds = new Set(answers.map((a: { questionId: string }) => a.questionId))

      const missingQuestions = requiredQuestions.filter(q => !answeredQuestionIds.has(q.id))

      if (missingQuestions.length > 0) {
        return NextResponse.json({
          error: `Zorunlu sorular yanitlanmadi: ${missingQuestions.map(q => q.questionText).join(', ')}`
        }, { status: 400 })
      }
    }

    // IP ve User Agent
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                      request.headers.get('x-real-ip') ||
                      'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Transaction ile yanıt oluştur
    const response = await prisma.$transaction(async (tx) => {
      // Yanıt kaydı oluştur
      const surveyResponse = await tx.surveyResponse.create({
        data: {
          surveyId: id,
          respondentEmail: survey.isAnonymous ? null : userEmail,
          respondentName: survey.isAnonymous ? null : (session.user.name || userEmail),
          respondentDepartment: survey.isAnonymous ? null : userDepartment,
          anonymousId: survey.isAnonymous ? uuidv4() : null,
          isComplete: true,
          completedAt: new Date(),
          ipAddress,
          userAgent
        }
      })

      // Cevapları oluştur
      for (const answer of answers) {
        const question = survey.questions.find(q => q.id === answer.questionId)
        if (!question) continue

        await tx.surveyAnswer.create({
          data: {
            responseId: surveyResponse.id,
            questionId: answer.questionId,
            optionId: answer.optionId || null,
            textAnswer: answer.textAnswer || null,
            numericAnswer: answer.numericAnswer ?? null,
            dateAnswer: answer.dateAnswer ? new Date(answer.dateAnswer) : null,
            fileUrl: answer.fileUrl || null
          }
        })

        // Çoklu seçim için ek cevaplar
        if (question.questionType === 'MULTIPLE_CHOICE' && answer.optionIds) {
          for (const optionId of answer.optionIds) {
            if (optionId !== answer.optionId) {
              await tx.surveyAnswer.create({
                data: {
                  responseId: surveyResponse.id,
                  questionId: answer.questionId,
                  optionId,
                  textAnswer: null,
                  numericAnswer: null,
                  dateAnswer: null,
                  fileUrl: null
                }
              })
            }
          }
        }
      }

      return surveyResponse
    })

    return NextResponse.json({
      success: true,
      responseId: response.id,
      message: 'Yanitiniz kaydedildi'
    })
  } catch (error) {
    console.error('Anket yaniti kaydedilirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
