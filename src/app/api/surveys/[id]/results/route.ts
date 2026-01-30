import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Anket sonuçlarını getir
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

    const isAdmin = userEmail === 'melih.dilben@ilerigroup.com' ||
                    userRole === 'ADMIN' ||
                    userRole === 'SUPER_ADMIN' ||
                    userRole === 'HR_MANAGER' ||
                    userRole === 'IT_MANAGER'

    // DEPT_HEAD için özel kontrol - IK anketleri hariç sonuçları görebilir
    const isDeptHead = userRole === 'DEPT_HEAD'

    // Anketi ve ilişkili verileri getir
    const survey = await prisma.survey.findUnique({
      where: { id },
      include: {
        questions: {
          include: {
            options: {
              orderBy: { sortOrder: 'asc' }
            },
            answers: {
              include: {
                response: {
                  select: {
                    id: true,
                    respondentName: true,
                    respondentDepartment: true
                  }
                }
              }
            }
          },
          orderBy: { sortOrder: 'asc' }
        },
        responses: {
          where: { isComplete: true },
          select: {
            id: true,
            respondentName: true,
            respondentDepartment: true,
            completedAt: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' }
        },
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

    // DEPT_HEAD için IK anketleri kontrolü
    // IK'nın açtığı anketlerin sonuçlarına DEPT_HEAD erişemez
    if (isDeptHead && !isAdmin) {
      // Anketi oluşturan kişinin rolünü kontrol et
      const surveyCreator = await prisma.user.findFirst({
        where: { email: { equals: survey.createdByEmail, mode: 'insensitive' } },
        select: { role: true, department: true }
      })

      // Eğer anketi HR_MANAGER oluşturduysa veya departmanı IK ise erişim engelle
      const isHRSurvey = surveyCreator?.role === 'HR_MANAGER' ||
                         surveyCreator?.department?.toLowerCase().includes('insan kaynakları') ||
                         surveyCreator?.department?.toLowerCase().includes('i̇nsan kaynakları') ||
                         surveyCreator?.department?.toLowerCase() === 'ik' ||
                         surveyCreator?.department?.toLowerCase() === 'hr'

      if (isHRSurvey) {
        return NextResponse.json({ error: 'IK anketlerinin sonuçlarına erişim yetkiniz yok' }, { status: 403 })
      }
    }

    // Yetki kontrolü - DEPT_HEAD isAdmin olmasa da IK dışı anket sonuçlarını görebilir
    if (!isAdmin && !isDeptHead) {
      if (survey.showResults === 'NEVER') {
        return NextResponse.json({ error: 'Bu anketin sonuclari gosterilmiyor' }, { status: 403 })
      }

      if (survey.showResults === 'AFTER_END' && survey.endsAt && new Date(survey.endsAt) > new Date()) {
        return NextResponse.json({ error: 'Sonuclar anket bittikten sonra gosterilecek' }, { status: 403 })
      }

      if (survey.showResults === 'AFTER_SUBMIT') {
        const hasResponded = await prisma.surveyResponse.findFirst({
          where: {
            surveyId: id,
            respondentEmail: userEmail
          }
        })

        if (!hasResponded) {
          return NextResponse.json({ error: 'Sonuclari gormek icin anketi yanitlayin' }, { status: 403 })
        }
      }
    }

    return NextResponse.json(survey)
  } catch (error) {
    console.error('Anket sonuclari yüklenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
