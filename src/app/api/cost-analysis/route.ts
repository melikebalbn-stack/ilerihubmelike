import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CostAnalysisStatus } from '@/generated/prisma'
import { hasCostAnalysisAccess } from '@/lib/cost-analysis/access'
import { requireUser } from '@/lib/auth/require-user'

// GET - Tüm maliyet analizlerini listele
export async function GET(request: NextRequest) {
  try {
    // PR-Y2.5-cost-analysis: requireUser — yetkisiz kullanıcı kendi createdById ile filtrelenir
    const { user, error } = await requireUser()
    if (error) return error

    const isPrivileged = hasCostAnalysisAccess(user.role, user.email)

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const categoryId = searchParams.get('categoryId')
    const customerId = searchParams.get('customerId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const showAllRevisions = searchParams.get('showAllRevisions') === 'true'

    const where: any = {}

    // Varsayılan: sadece en güncel revizyonları göster
    if (!showAllRevisions) {
      where.isLatest = true
    }

    // Yetkisiz kullanıcılar sadece kendi oluşturduklarını görebilir
    if (!isPrivileged) {
      where.createdById = user.id
    }

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (status && status !== 'all') {
      where.status = status as CostAnalysisStatus
    }

    if (categoryId && categoryId !== 'all') {
      where.categoryId = categoryId
    }

    if (customerId && customerId !== 'all') {
      where.customerId = customerId
    }

    const [analyses, total] = await Promise.all([
      prisma.costAnalysis.findMany({
        where,
        include: {
          category: true,
          customer: true,
          _count: {
            select: {
              materials: true,
              laborItems: true,
              externalServices: true,
              otherCosts: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.costAnalysis.count({ where }),
    ])

    return NextResponse.json({
      data: analyses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Maliyet analizleri alınırken hata:', error)
    return NextResponse.json(
      { error: 'Maliyet analizleri alınırken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// POST - Yeni maliyet analizi oluştur
export async function POST(request: NextRequest) {
  try {
    // PR-Y2.5-cost-analysis: requireUser — createdById = user.id
    const { user, error } = await requireUser()
    if (error) return error
    if (!hasCostAnalysisAccess(user.role, user.email)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()

    const {
      code,
      name,
      description,
      revision,
      finishedWeight,
      currency,
      categoryId,
      customerId,
      overheadRate,
      profitRate,
    } = body

    // Validasyonlar
    if (!code || code.trim() === '') {
      return NextResponse.json({ error: 'Ürün kodu zorunludur' }, { status: 400 })
    }

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Ürün adı zorunludur' }, { status: 400 })
    }

    // finishedWeight opsiyonel - sonradan girilebilir
    const weightValue = finishedWeight ? parseFloat(finishedWeight) : 0

    // Kod benzersizlik kontrolü (composite unique: code + revisionNumber)
    const existingAnalysis = await prisma.costAnalysis.findFirst({
      where: { code: code.trim(), revisionNumber: 0 },
    })

    if (existingAnalysis) {
      return NextResponse.json(
        { error: 'Bu ürün kodu zaten mevcut' },
        { status: 400 }
      )
    }

    const analysis = await prisma.costAnalysis.create({
      data: {
        code: code.trim(),
        name: name.trim(),
        description: description?.trim() || null,
        revision: 'Rev.00',
        revisionNumber: 0,
        isLatest: true,
        finishedWeight: weightValue,
        currency: currency || 'EUR',
        categoryId: categoryId || null,
        customerId: customerId || null,
        overheadRate: parseFloat(overheadRate) || 25,
        profitRate: parseFloat(profitRate) || 20,
        createdById: user.id,
        status: 'DRAFT',
      },
      include: {
        category: true,
        customer: true,
      },
    })

    return NextResponse.json(analysis, { status: 201 })
  } catch (error) {
    console.error('Maliyet analizi oluşturulurken hata:', error)
    return NextResponse.json(
      { error: 'Maliyet analizi oluşturulurken bir hata oluştu' },
      { status: 500 }
    )
  }
}
