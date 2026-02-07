import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiCreated, apiBadRequest } from '@/lib/api-response'

// Türkçe karakterleri normalize et
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
}

// GET /api/faq - Tüm SSS'leri listele
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return apiUnauthorized()
    }

    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const categoryId = searchParams.get('categoryId') || ''
    const sortBy = searchParams.get('sortBy') || 'sortOrder' // sortOrder, viewCount, helpfulCount
    const includeUnpublished = searchParams.get('includeUnpublished') === 'true'

    // Admin kontrolü (unpublished görmek için)
    const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER'].includes(session.user.role)

    // Base where koşulu
    const whereCondition: Record<string, unknown> = {}

    // Sadece adminler unpublished görebilir
    if (!isAdmin || !includeUnpublished) {
      whereCondition.isPublished = true
    }

    // Kategori filtresi
    if (categoryId) {
      whereCondition.categoryId = categoryId
    }

    // Tüm SSS'leri çek
    const faqs = await prisma.fAQ.findMany({
      where: whereCondition,
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
      orderBy: sortBy === 'viewCount'
        ? { viewCount: 'desc' }
        : sortBy === 'helpfulCount'
          ? { helpfulCount: 'desc' }
          : { sortOrder: 'asc' },
    })

    // Arama filtresi (client-side için daha esnek)
    let filteredFaqs = faqs
    if (search) {
      const normalizedSearch = normalizeText(search)
      filteredFaqs = faqs.filter(faq =>
        normalizeText(faq.question).includes(normalizedSearch) ||
        normalizeText(faq.answer).includes(normalizedSearch) ||
        faq.tags.some(tag => normalizeText(tag).includes(normalizedSearch))
      )
    }

    // Kategorilere göre grupla
    const grouped = filteredFaqs.reduce((acc, faq) => {
      const catId = faq.category.id
      if (!acc[catId]) {
        acc[catId] = {
          category: faq.category,
          faqs: [],
        }
      }
      acc[catId].faqs.push({
        id: faq.id,
        question: faq.question,
        answer: faq.answer,
        tags: faq.tags,
        viewCount: faq.viewCount,
        helpfulCount: faq.helpfulCount,
        notHelpfulCount: faq.notHelpfulCount,
        isPublished: faq.isPublished,
        sortOrder: faq.sortOrder,
        categoryId: faq.categoryId,
        author: faq.author,
        createdAt: faq.createdAt,
        updatedAt: faq.updatedAt,
      })
      return acc
    }, {} as Record<string, { category: typeof faqs[0]['category']; faqs: unknown[] }>)

    return apiSuccess({
      grouped: Object.values(grouped),
      total: filteredFaqs.length,
    })

  } catch (error) {
    console.error('FAQ GET error:', error)
    return apiError('SSS listesi alınamadı', 500, {
      endpoint: '/api/faq',
      error,
    })
  }
}

// POST /api/faq - Yeni SSS ekle
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { question, answer, categoryId, tags, sortOrder, isPublished } = body

    if (!question || !answer || !categoryId) {
      return apiBadRequest('Soru, cevap ve kategori zorunludur')
    }

    // Kategori kontrolü
    const category = await prisma.fAQCategory.findUnique({
      where: { id: categoryId },
    })

    if (!category) {
      return apiBadRequest('Geçersiz kategori')
    }

    const faq = await prisma.fAQ.create({
      data: {
        question,
        answer,
        categoryId,
        tags: tags || [],
        sortOrder: sortOrder || 0,
        isPublished: isPublished || false,
        authorId: session.user.id,
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

    return apiCreated(faq)

  } catch (error) {
    console.error('FAQ POST error:', error)
    return apiError('SSS eklenemedi', 500, {
      endpoint: '/api/faq',
      error,
    })
  }
}
