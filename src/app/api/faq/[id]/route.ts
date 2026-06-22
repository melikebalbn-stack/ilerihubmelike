import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiBadRequest, apiNoContent } from '@/lib/api-response'

// GET /api/faq/[id] - Tek SSS detay (ve görüntülenme sayısını artır)
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

    // FAQ'ı bul ve görüntülenme sayısını artır
    const faq = await prisma.fAQ.update({
      where: { id },
      data: {
        viewCount: { increment: 1 },
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true,
          },
        },
        author: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!faq) {
      return apiNotFound('SSS bulunamadı')
    }

    // Yayınlanmamış SSS'i sadece admin görebilir
    const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER'].includes(session.user.role)
    if (!faq.isPublished && !isAdmin) {
      return apiNotFound('SSS bulunamadı')
    }

    return apiSuccess(faq)

  } catch (error) {
    console.error('FAQ GET error:', error)
    return apiError('SSS alınamadı', 500, {
      endpoint: '/api/faq/[id]',
      error,
    })
  }
}

// PATCH /api/faq/[id] - SSS güncelle
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return apiUnauthorized()
    }

    // Admin kontrolü
    const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER'].includes(session.user.role)
    if (!isAdmin) {
      return apiForbidden()
    }

    const { id } = await params
    const body = await request.json()
    const { question, answer, categoryId, tags, sortOrder, isPublished } = body

    // FAQ'ı kontrol et
    const existingFaq = await prisma.fAQ.findUnique({
      where: { id },
    })

    if (!existingFaq) {
      return apiNotFound('SSS bulunamadı')
    }

    // Kategori değişiyorsa kontrol et
    if (categoryId && categoryId !== existingFaq.categoryId) {
      const category = await prisma.fAQCategory.findUnique({
        where: { id: categoryId },
      })
      if (!category) {
        return apiBadRequest('Geçersiz kategori')
      }
    }

    const faq = await prisma.fAQ.update({
      where: { id },
      data: {
        ...(question !== undefined && { question }),
        ...(answer !== undefined && { answer }),
        ...(categoryId !== undefined && { categoryId }),
        ...(tags !== undefined && { tags }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isPublished !== undefined && { isPublished }),
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        author: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return apiSuccess(faq)

  } catch (error) {
    console.error('FAQ PATCH error:', error)
    return apiError('SSS güncellenemedi', 500, {
      endpoint: '/api/faq/[id]',
      error,
    })
  }
}

// DELETE /api/faq/[id] - SSS sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return apiUnauthorized()
    }

    // Admin kontrolü
    const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER'].includes(session.user.role)
    if (!isAdmin) {
      return apiForbidden()
    }

    const { id } = await params

    // FAQ'ı kontrol et
    const existingFaq = await prisma.fAQ.findUnique({
      where: { id },
    })

    if (!existingFaq) {
      return apiNotFound('SSS bulunamadı')
    }

    // Hard delete (feedback'ler de cascade ile silinir)
    await prisma.fAQ.delete({
      where: { id },
    })

    return apiNoContent()

  } catch (error) {
    console.error('FAQ DELETE error:', error)
    return apiError('SSS silinemedi', 500, {
      endpoint: '/api/faq/[id]',
      error,
    })
  }
}
