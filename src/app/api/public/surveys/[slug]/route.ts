import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Public anket bilgilerini getir (login gerektirmez)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    const survey = await prisma.survey.findFirst({
      where: {
        publicSlug: slug,
        isPublic: true,
        status: 'ACTIVE'
      },
      select: {
        id: true,
        title: true,
        description: true,
        isAnonymous: true,
        requireAllQuestions: true,
        startsAt: true,
        endsAt: true,
        questions: {
          select: {
            id: true,
            questionText: true,
            questionType: true,
            isRequired: true,
            sortOrder: true,
            minValue: true,
            maxValue: true,
            options: {
              select: {
                id: true,
                optionText: true,
                sortOrder: true,
                isOther: true
              },
              orderBy: { sortOrder: 'asc' }
            }
          },
          orderBy: { sortOrder: 'asc' }
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

    return NextResponse.json(survey)
  } catch (error) {
    console.error('Public survey fetch error:', error)
    return NextResponse.json(
      { error: 'Anket yuklenirken bir hata olustu.' },
      { status: 500 }
    )
  }
}
