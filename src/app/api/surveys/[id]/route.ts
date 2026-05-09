import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Tek anket getir
export async function GET(
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
    const userRole = session.user.role || 'EMPLOYEE'
    const userDepartment = session.user.department

    // PR-AUTHUTILS-CLEAN: duyuru.admin permission'ı
    const isAdmin = session.user.permissions?.includes('duyuru.admin') ?? false

    const survey = await prisma.survey.findUnique({
      where: { id },
      include: {
        questions: {
          include: {
            options: {
              orderBy: { sortOrder: 'asc' }
            },
            answers: isAdmin ? {
              include: {
                response: {
                  select: {
                    respondentName: true,
                    respondentDepartment: true
                  }
                }
              }
            } : false
          },
          orderBy: { sortOrder: 'asc' }
        },
        responses: isAdmin ? {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            respondentName: true,
            respondentDepartment: true,
            completedAt: true,
            createdAt: true
          }
        } : false,
        _count: {
          select: {
            responses: true,
            questions: true
          }
        }
      }
    })

    if (!survey) {
      return NextResponse.json({ error: 'Anket bulunamadi' }, { status: 404 })
    }

    // Yetki kontrolü
    if (!isAdmin) {
      if (survey.status !== 'ACTIVE') {
        return NextResponse.json({ error: 'Bu ankete erisim yetkiniz yok' }, { status: 403 })
      }

      if (survey.targetType === 'DEPARTMENTS' &&
          !survey.targetDepartments.includes(userDepartment || '')) {
        return NextResponse.json({ error: 'Bu anket sizin departmaniniz icin degil' }, { status: 403 })
      }

      if (survey.targetType === 'ROLES' &&
          !survey.targetRoles.includes(userRole)) {
        return NextResponse.json({ error: 'Bu anket sizin rolunuz icin degil' }, { status: 403 })
      }

      if (survey.endsAt && new Date(survey.endsAt) < new Date()) {
        return NextResponse.json({ error: 'Bu anketin suresi dolmus' }, { status: 403 })
      }
    }

    // Kullanıcının yanıtını kontrol et
    const existingResponse = await prisma.surveyResponse.findFirst({
      where: {
        surveyId: id,
        respondentEmail: userEmail
      },
      include: {
        answers: true
      }
    })

    return NextResponse.json({
      ...survey,
      hasResponded: !!existingResponse,
      isCompleted: existingResponse?.isComplete || false,
      userResponse: existingResponse
    })
  } catch (error) {
    console.error('Anket yüklenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PUT - Anket güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // PR-AUTHUTILS-CLEAN: duyuru.admin permission'ı
    const isAdmin = session.user.permissions?.includes('duyuru.admin') ?? false

    if (!isAdmin) {
      return NextResponse.json({ error: 'Bu islem icin yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()
    const {
      title,
      description,
      surveyType,
      startsAt,
      endsAt,
      isAnonymous,
      allowMultipleResponses,
      requireAllQuestions,
      showResults,
      targetType,
      targetDepartments,
      targetRoles,
      status,
      questions
    } = body

    // Mevcut anketi kontrol et
    const existingSurvey = await prisma.survey.findUnique({
      where: { id },
      include: {
        _count: { select: { responses: true } }
      }
    })

    if (!existingSurvey) {
      return NextResponse.json({ error: 'Anket bulunamadi' }, { status: 404 })
    }

    // Yanıt varsa soruları değiştirme
    if (existingSurvey._count.responses > 0 && questions) {
      return NextResponse.json({
        error: 'Yanitlanmis bir anketin sorulari degistirilemez'
      }, { status: 400 })
    }

    // Güncelleme
    const updateData: Record<string, unknown> = {}

    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (surveyType !== undefined) updateData.surveyType = surveyType
    if (startsAt !== undefined) updateData.startsAt = startsAt ? new Date(startsAt) : null
    if (endsAt !== undefined) updateData.endsAt = endsAt ? new Date(endsAt) : null
    if (isAnonymous !== undefined) updateData.isAnonymous = isAnonymous
    if (allowMultipleResponses !== undefined) updateData.allowMultipleResponses = allowMultipleResponses
    if (requireAllQuestions !== undefined) updateData.requireAllQuestions = requireAllQuestions
    if (showResults !== undefined) updateData.showResults = showResults
    if (targetType !== undefined) updateData.targetType = targetType
    if (targetDepartments !== undefined) updateData.targetDepartments = targetDepartments
    if (targetRoles !== undefined) updateData.targetRoles = targetRoles
    if (status !== undefined) updateData.status = status

    // Transaction ile güncelle
    const survey = await prisma.$transaction(async (tx) => {
      const updatedSurvey = await tx.survey.update({
        where: { id },
        data: updateData
      })

      // Soruları güncelle (yanıt yoksa)
      if (questions && existingSurvey._count.responses === 0) {
        // Mevcut soruları sil
        await tx.surveyQuestion.deleteMany({
          where: { surveyId: id }
        })

        // Yeni soruları oluştur
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i]
          const question = await tx.surveyQuestion.create({
            data: {
              surveyId: id,
              questionText: q.questionText,
              questionType: q.questionType,
              isRequired: q.isRequired ?? true,
              sortOrder: i,
              minValue: q.minValue,
              maxValue: q.maxValue,
              minLength: q.minLength,
              maxLength: q.maxLength
            }
          })

          // Seçenekleri oluştur
          if (q.options && q.options.length > 0) {
            for (let j = 0; j < q.options.length; j++) {
              const opt = q.options[j]
              await tx.surveyOption.create({
                data: {
                  questionId: question.id,
                  optionText: typeof opt === 'string' ? opt : opt.optionText,
                  sortOrder: j,
                  isOther: typeof opt === 'object' ? (opt.isOther || false) : false
                }
              })
            }
          }
        }
      }

      return updatedSurvey
    })

    // Güncellenmiş anketi getir
    const surveyWithQuestions = await prisma.survey.findUnique({
      where: { id: survey.id },
      include: {
        questions: {
          include: {
            options: {
              orderBy: { sortOrder: 'asc' }
            }
          },
          orderBy: { sortOrder: 'asc' }
        }
      }
    })

    return NextResponse.json(surveyWithQuestions)
  } catch (error) {
    console.error('Anket güncellenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE - Anket sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // PR-AUTHUTILS-CLEAN: duyuru.admin permission'ı
    const isAdmin = session.user.permissions?.includes('duyuru.admin') ?? false

    if (!isAdmin) {
      return NextResponse.json({ error: 'Bu islem icin yetkiniz yok' }, { status: 403 })
    }

    // Yanıt var mı kontrol et
    const responseCount = await prisma.surveyResponse.count({
      where: { surveyId: id }
    })

    if (responseCount > 0) {
      // Arşivle
      await prisma.survey.update({
        where: { id },
        data: { status: 'ARCHIVED' }
      })
      return NextResponse.json({
        success: true,
        message: 'Anket arsivlendi (yanitlar mevcut)'
      })
    }

    // Sil
    await prisma.survey.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Anket silinirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
