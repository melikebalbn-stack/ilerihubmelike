import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin as checkIsAdmin } from '@/lib/auth-utils'

// GET - Duyuruları listele
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
    const categoryId = searchParams.get('categoryId')
    const priority = searchParams.get('priority')
    const search = searchParams.get('search')

    const userEmail = String(session.user.email).toLowerCase()
    const userRole = session.user.role || 'EMPLOYEE'
    const userDepartment = session.user.department

    // FIX #4: Yönetici kontrolü - merkezi utility kullanıldı
    const isAdmin = checkIsAdmin(userEmail, userRole)

    // Filtre oluştur - AND array kullanarak tüm filtreleri güvenli şekilde birleştir
    const andConditions: Record<string, unknown>[] = []

    // Admin değilse sadece yayınlanmış ve hedef kitlesine uygun duyuruları göster
    if (!isAdmin) {
      andConditions.push({ status: 'PUBLISHED' })
      andConditions.push({
        OR: [
          { targetType: 'ALL' },
          { targetType: 'DEPARTMENTS', targetDepartments: { has: userDepartment } },
          { targetType: 'ROLES', targetRoles: { has: userRole } }
        ]
      })
      // Süresi dolmuş duyuruları gösterme
      andConditions.push({
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } }
        ]
      })
    } else {
      // Admin için status filtresi
      if (status) {
        andConditions.push({ status })
      }
    }

    // Kategori filtresi
    if (categoryId) {
      andConditions.push({ categoryId })
    }

    // Öncelik filtresi
    if (priority) {
      andConditions.push({ priority })
    }

    // Arama - artık diğer filtreleri ezmez
    if (search) {
      andConditions.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { summary: { contains: search, mode: 'insensitive' } },
          { content: { contains: search, mode: 'insensitive' } }
        ]
      })
    }

    // Tüm koşulları AND ile birleştir
    const where: Record<string, unknown> = andConditions.length > 0 ? { AND: andConditions } : {}

    // Toplam sayı
    const total = await prisma.announcement.count({ where })

    // Duyuruları getir
    const announcements = await prisma.announcement.findMany({
      where,
      include: {
        category: true,
        survey: {
          select: {
            id: true,
            title: true,
            status: true
          }
        },
        _count: {
          select: {
            reads: true,
            comments: true,
            reactions: true
          }
        }
      },
      orderBy: [
        { isPinned: 'desc' },
        { priority: 'desc' },
        { publishedAt: 'desc' },
        { createdAt: 'desc' }
      ],
      skip: (page - 1) * limit,
      take: limit
    })

    // Kullanıcının okuduğu duyuruları bul
    const readAnnouncements = await prisma.announcementRead.findMany({
      where: {
        userEmail,
        announcementId: { in: announcements.map(a => a.id) }
      },
      select: {
        announcementId: true,
        acknowledged: true
      }
    })

    const readMap = new Map(readAnnouncements.map(r => [r.announcementId, r]))

    // Duyurulara okunma durumu ekle
    const announcementsWithReadStatus = announcements.map(announcement => ({
      ...announcement,
      isRead: readMap.has(announcement.id),
      isAcknowledged: readMap.get(announcement.id)?.acknowledged || false
    }))

    return NextResponse.json({
      announcements: announcementsWithReadStatus,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Duyurular yüklenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST - Yeni duyuru oluştur
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userEmail = String(session.user.email).toLowerCase()
    const userRole = session.user.role || 'EMPLOYEE'

    // Yönetici kontrolü
    const isAdmin = userEmail === 'melih.dilben@ilerigroup.com' ||
                    userRole === 'ADMIN' ||
                    userRole === 'SUPER_ADMIN'

    if (!isAdmin) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()
    const {
      title,
      summary,
      content,
      categoryId,
      priority = 'NORMAL',
      targetType = 'ALL',
      targetDepartments = [],
      targetRoles = [],
      coverImageUrl,
      attachments,
      isPinned = false,
      publishAt,
      expiresAt,
      allowComments = true,
      allowReactions = true,
      requireAcknowledgment = false,
      surveyId,
      status = 'DRAFT'
    } = body

    if (!title || !content) {
      return NextResponse.json({ error: 'Başlık ve içerik zorunludur' }, { status: 400 })
    }

    // Boş string'leri null'a çevir (foreign key constraint için)
    const cleanCategoryId = categoryId && categoryId.trim() !== '' ? categoryId : null
    const cleanSurveyId = surveyId && surveyId.trim() !== '' ? surveyId : null

    // Duyuru oluştur
    const announcement = await prisma.announcement.create({
      data: {
        title,
        summary,
        content,
        categoryId: cleanCategoryId,
        priority,
        targetType,
        targetDepartments,
        targetRoles,
        coverImageUrl,
        attachments,
        isPinned,
        publishAt: publishAt ? new Date(publishAt) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        allowComments,
        allowReactions,
        requireAcknowledgment,
        surveyId: cleanSurveyId,
        status,
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
        authorId: session.user.id || '',
        authorEmail: userEmail,
        authorName: session.user.name || userEmail,
        authorDepartment: session.user.department
      },
      include: {
        category: true,
        survey: true
      }
    })

    return NextResponse.json(announcement, { status: 201 })
  } catch (error) {
    console.error('Duyuru oluşturulurken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
