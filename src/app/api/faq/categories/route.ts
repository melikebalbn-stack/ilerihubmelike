import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiCreated, apiBadRequest } from '@/lib/api-response'

// GET /api/faq/categories - Tüm kategorileri listele
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return apiUnauthorized()
    }

    const categories = await prisma.fAQCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: {
            faqs: {
              where: { isPublished: true },
            },
          },
        },
      },
    })

    const result = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      icon: cat.icon,
      sortOrder: cat.sortOrder,
      faqCount: cat._count.faqs,
    }))

    return apiSuccess(result)

  } catch (error) {
    console.error('FAQ Categories GET error:', error)
    return apiError('Kategoriler alınamadı', 500, {
      endpoint: '/api/faq/categories',
      error,
    })
  }
}

// POST /api/faq/categories - Yeni kategori ekle
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return apiUnauthorized()
    }

    // Sadece ADMIN
    if (!['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return apiForbidden()
    }

    const body = await request.json()
    const { name, description, icon, sortOrder } = body

    if (!name) {
      return apiBadRequest('Kategori adı zorunludur')
    }

    // Slug oluştur
    const slug = name
      .toLowerCase()
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    // Slug benzersizliğini kontrol et
    const existingCategory = await prisma.fAQCategory.findUnique({
      where: { slug },
    })

    if (existingCategory) {
      return apiBadRequest('Bu isimde bir kategori zaten var')
    }

    const category = await prisma.fAQCategory.create({
      data: {
        name,
        slug,
        description: description || null,
        icon: icon || null,
        sortOrder: sortOrder || 0,
      },
    })

    return apiCreated(category)

  } catch (error) {
    console.error('FAQ Categories POST error:', error)
    return apiError('Kategori eklenemedi', 500, {
      endpoint: '/api/faq/categories',
      error,
    })
  }
}

// PATCH /api/faq/categories - Kategori güncelle (id query param olarak)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return apiUnauthorized()
    }

    // Sadece ADMIN
    if (!['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return apiForbidden()
    }

    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return apiBadRequest('Kategori ID gerekli')
    }

    const body = await request.json()
    const { name, description, icon, sortOrder, isActive } = body

    const category = await prisma.fAQCategory.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(icon !== undefined && { icon }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return apiSuccess(category)

  } catch (error) {
    console.error('FAQ Categories PATCH error:', error)
    return apiError('Kategori güncellenemedi', 500, {
      endpoint: '/api/faq/categories',
      error,
    })
  }
}
