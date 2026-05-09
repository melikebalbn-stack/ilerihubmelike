import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Anket numarası oluştur
async function generateSurveyNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `ANK-${year}-`

  const lastSurvey = await prisma.survey.findFirst({
    where: {
      surveyNumber: { startsWith: prefix }
    },
    orderBy: { surveyNumber: 'desc' }
  })

  let nextNumber = 1
  if (lastSurvey) {
    const lastNumber = parseInt(lastSurvey.surveyNumber.split('-')[2])
    nextNumber = lastNumber + 1
  }

  return `${prefix}${nextNumber.toString().padStart(4, '0')}`
}

// GET - Anketleri listele
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const status = searchParams.get('status')
    const type = searchParams.get('type')

    const userEmail = String(session.user.email).toLowerCase()
    const userRole = session.user.role || 'EMPLOYEE'
    const userDepartment = session.user.department

    // PR-AUTHUTILS-CLEAN: duyuru.admin permission'ı (anketler duyuru modülü altında)
    const isAdmin = session.user.permissions?.includes('duyuru.admin') ?? false

    // Filtre oluştur
    const where: Record<string, unknown> = {}

    if (!isAdmin) {
      where.status = 'ACTIVE'
      where.OR = [
        { targetType: 'ALL' },
        { targetType: 'DEPARTMENTS', targetDepartments: { has: userDepartment } },
        { targetType: 'ROLES', targetRoles: { has: userRole } }
      ]
      // Süresi dolmuş anketleri gösterme
      where.AND = [
        {
          OR: [
            { endsAt: null },
            { endsAt: { gte: new Date() } }
          ]
        }
      ]
    } else {
      if (status) {
        where.status = status
      }
    }

    if (type) {
      where.surveyType = type
    }

    const total = await prisma.survey.count({ where })

    const surveys = await prisma.survey.findMany({
      where,
      include: {
        _count: {
          select: {
            questions: true,
            responses: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    })

    // Kullanıcının yanıtladığı anketleri bul
    const respondedSurveys = await prisma.surveyResponse.findMany({
      where: {
        respondentEmail: userEmail,
        surveyId: { in: surveys.map(s => s.id) }
      },
      select: {
        surveyId: true,
        isComplete: true
      }
    })

    const respondedMap = new Map(respondedSurveys.map(r => [r.surveyId, r]))

    const surveysWithStatus = surveys.map(survey => ({
      ...survey,
      hasResponded: respondedMap.has(survey.id),
      isCompleted: respondedMap.get(survey.id)?.isComplete || false
    }))

    return NextResponse.json({
      surveys: surveysWithStatus,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Anketler yüklenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST - Yeni anket oluştur
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userEmail = String(session.user.email).toLowerCase()

    // PR-AUTHUTILS-CLEAN: duyuru.admin permission'ı
    const isAdmin = session.user.permissions?.includes('duyuru.admin') ?? false

    if (!isAdmin) {
      return NextResponse.json({ error: 'Bu islem icin yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()
    const {
      title,
      description,
      surveyType = 'SURVEY',
      startsAt,
      endsAt,
      isAnonymous = false,
      allowMultipleResponses = false,
      requireAllQuestions = true,
      showResults = 'AFTER_SUBMIT',
      targetType = 'ALL',
      targetDepartments = [],
      targetRoles = [],
      status = 'DRAFT',
      isPublic = false,
      publicSlug = null,
      questions = []
    } = body

    if (!title) {
      return NextResponse.json({ error: 'Anket basligi zorunludur' }, { status: 400 })
    }

    // Public slug kontrolu
    if (isPublic && publicSlug) {
      const existingSlug = await prisma.survey.findFirst({
        where: { publicSlug }
      })
      if (existingSlug) {
        return NextResponse.json({ error: 'Bu URL zaten kullaniliyor' }, { status: 400 })
      }
    }

    const surveyNumber = await generateSurveyNumber()

    // Anket ve sorularını transaction ile oluştur
    const survey = await prisma.$transaction(async (tx) => {
      const newSurvey = await tx.survey.create({
        data: {
          surveyNumber,
          title,
          description,
          surveyType,
          startsAt: startsAt ? new Date(startsAt) : null,
          endsAt: endsAt ? new Date(endsAt) : null,
          isAnonymous,
          allowMultipleResponses,
          requireAllQuestions,
          showResults,
          targetType,
          targetDepartments,
          targetRoles,
          status,
          isPublic,
          publicSlug: isPublic && publicSlug ? publicSlug : null,
          createdBy: session.user.id || '',
          createdByName: session.user.name || userEmail,
          createdByEmail: userEmail
        }
      })

      // Soruları oluştur
      if (questions.length > 0) {
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i]
          const question = await tx.surveyQuestion.create({
            data: {
              surveyId: newSurvey.id,
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
                  optionText: opt.optionText || opt,
                  sortOrder: j,
                  isOther: opt.isOther || false
                }
              })
            }
          }
        }
      }

      return newSurvey
    })

    // Soruları ve seçenekleri ile birlikte getir
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

    return NextResponse.json(surveyWithQuestions, { status: 201 })
  } catch (error) {
    console.error('Anket olusturulurken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
