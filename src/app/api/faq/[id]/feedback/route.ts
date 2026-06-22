import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError, apiUnauthorized, apiNotFound, apiBadRequest } from '@/lib/api-response'
import { hashIp } from '@/lib/request-utils'

// POST /api/faq/[id]/feedback - Faydalı mı oylaması
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return apiUnauthorized()
    }

    const { id } = await params
    const body = await request.json()
    const { helpful } = body

    if (typeof helpful !== 'boolean') {
      return apiBadRequest('helpful alanı boolean olmalıdır')
    }

    // FAQ'ı kontrol et
    const faq = await prisma.fAQ.findUnique({
      where: { id },
    })

    if (!faq || !faq.isPublished) {
      return apiNotFound('SSS bulunamadı')
    }

    const userId = session.user.id

    // Kullanıcının daha önce oy verip vermediğini kontrol et
    const existingFeedback = await prisma.fAQFeedback.findUnique({
      where: {
        faqId_userId: {
          faqId: id,
          userId,
        },
      },
    })

    if (existingFeedback) {
      // Önceki oydan farklıysa güncelle
      if (existingFeedback.helpful !== helpful) {
        await prisma.$transaction([
          // Feedback'i güncelle
          prisma.fAQFeedback.update({
            where: { id: existingFeedback.id },
            data: { helpful },
          }),
          // Sayaçları güncelle (önceki oyu geri al, yeni oyu ekle)
          prisma.fAQ.update({
            where: { id },
            data: {
              helpfulCount: helpful
                ? { increment: 1 }
                : { decrement: 1 },
              notHelpfulCount: helpful
                ? { decrement: 1 }
                : { increment: 1 },
            },
          }),
        ])

        return apiSuccess({ message: 'Oyunuz güncellendi', helpful })
      }

      return apiSuccess({ message: 'Zaten bu şekilde oy verdiniz', helpful })
    }

    // Yeni oy ekle
    await prisma.$transaction([
      prisma.fAQFeedback.create({
        data: {
          faqId: id,
          userId,
          helpful,
        },
      }),
      prisma.fAQ.update({
        where: { id },
        data: {
          helpfulCount: helpful ? { increment: 1 } : undefined,
          notHelpfulCount: !helpful ? { increment: 1 } : undefined,
        },
      }),
    ])

    return apiSuccess({ message: 'Geri bildiriminiz kaydedildi', helpful })

  } catch (error) {
    console.error('FAQ Feedback error:', error)
    return apiError('Geri bildirim kaydedilemedi', 500, {
      endpoint: '/api/faq/[id]/feedback',
      error,
    })
  }
}

// GET /api/faq/[id]/feedback - Kullanıcının oyunu getir
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return apiUnauthorized()
    }

    const { id } = await params
    const userId = session.user.id

    const feedback = await prisma.fAQFeedback.findUnique({
      where: {
        faqId_userId: {
          faqId: id,
          userId,
        },
      },
    })

    return apiSuccess({
      hasVoted: !!feedback,
      helpful: feedback?.helpful ?? null,
    })

  } catch (error) {
    console.error('FAQ Feedback GET error:', error)
    return apiError('Geri bildirim alınamadı', 500, {
      endpoint: '/api/faq/[id]/feedback',
      error,
    })
  }
}
