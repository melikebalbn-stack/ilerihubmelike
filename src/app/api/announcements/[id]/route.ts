import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'

// GET - Tek duyuru getir
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-announcements: requireUser → user.email/role/department (DB taze)
    const { session, user, error } = await requireUser()
    if (error) return error

    const { id } = await params
    const userEmail = user.email
    const userDepartment = user.department

    // PR-Y10: saf RBAC, duyuru.admin permission (admin tüm duyuruları görür,
    // normal user sadece audience'a uygun olanı).
    const isAdmin = session.user.permissions?.includes('duyuru.admin') ?? false

    // PR-DUYURU-TARGETROLES: targetRoles Role.slug saklıyor (text[]).
    // User'ın tüm slug'larını user_role tablosundan tek seferde çek.
    let userSlugs: string[] = []
    if (!isAdmin) {
      const userRoleRows = await prisma.userRole.findMany({
        where: { userId: user.id },
        select: { role: { select: { slug: true } } },
      })
      userSlugs = userRoleRows.map((r) => r.role.slug)
    }

    const announcement = await prisma.announcement.findUnique({
      where: { id },
      include: {
        category: true,
        survey: {
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
        },
        comments: {
          where: { isApproved: true, parentId: null },
          include: {
            replies: {
              where: { isApproved: true },
              orderBy: { createdAt: 'asc' }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        reactions: true,
        _count: {
          select: {
            reads: true,
            comments: true,
            reactions: true
          }
        }
      }
    })

    if (!announcement) {
      return NextResponse.json({ error: 'Duyuru bulunamadi' }, { status: 404 })
    }

    // Yetki kontrolü - Admin değilse
    if (!isAdmin) {
      // Yayınlanmamış duyuru
      if (announcement.status !== 'PUBLISHED') {
        return NextResponse.json({ error: 'Bu duyuruya erisim yetkiniz yok' }, { status: 403 })
      }

      // Hedef kitle kontrolü
      if (announcement.targetType === 'DEPARTMENTS' &&
          !announcement.targetDepartments.includes(userDepartment || '')) {
        return NextResponse.json({ error: 'Bu duyuru sizin departmaniniz icin degil' }, { status: 403 })
      }

      if (announcement.targetType === 'ROLES' &&
          !announcement.targetRoles.some(slug => userSlugs.includes(slug))) {
        return NextResponse.json({ error: 'Bu duyuru sizin rolunuz icin degil' }, { status: 403 })
      }

      // Süresi dolmuş duyuru
      if (announcement.expiresAt && new Date(announcement.expiresAt) < new Date()) {
        return NextResponse.json({ error: 'Bu duyurunun suresi dolmus' }, { status: 403 })
      }
    }

    // Görüntüleme sayısını artır ve okundu kaydı oluştur
    await prisma.$transaction([
      prisma.announcement.update({
        where: { id },
        data: { viewCount: { increment: 1 } }
      }),
      prisma.announcementRead.upsert({
        where: {
          announcementId_userEmail: {
            announcementId: id,
            userEmail
          }
        },
        create: {
          announcementId: id,
          userEmail,
          userName: user.name || userEmail,
          userDepartment
        },
        update: {} // Zaten varsa değiştirme
      })
    ])

    // Kullanıcının okundu durumunu kontrol et
    const readRecord = await prisma.announcementRead.findUnique({
      where: {
        announcementId_userEmail: {
          announcementId: id,
          userEmail
        }
      }
    })

    // Kullanıcının tepkilerini bul
    const userReactions = announcement.reactions
      .filter(r => r.userEmail === userEmail)
      .map(r => r.reactionType)

    // Tepki sayılarını grupla
    const reactionCounts = announcement.reactions.reduce((acc, r) => {
      acc[r.reactionType] = (acc[r.reactionType] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Kullanıcının ankete yanıt verip vermediğini kontrol et
    let hasRespondedToSurvey = false
    if (announcement.survey) {
      const existingResponse = await prisma.surveyResponse.findFirst({
        where: {
          surveyId: announcement.survey.id,
          respondentEmail: userEmail
        }
      })
      hasRespondedToSurvey = !!existingResponse
    }

    return NextResponse.json({
      ...announcement,
      isRead: !!readRecord,
      isAcknowledged: readRecord?.acknowledged || false,
      userReactions,
      reactionCounts,
      hasRespondedToSurvey
    })
  } catch (error) {
    console.error('Duyuru yüklenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PUT - Duyuru güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-announcements: requireUser
    const { session, user, error } = await requireUser()
    if (error) return error

    const { id } = await params
    const userEmail = user.email

    // PR-Y10: duyuru.admin permission (admin slug + super-admin)
    if (!session.user.permissions?.includes('duyuru.admin')) {
      return NextResponse.json({ error: 'Bu islem icin yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()
    const {
      title,
      summary,
      content,
      categoryId,
      priority,
      targetType,
      targetDepartments,
      targetRoles,
      coverImageUrl,
      attachments,
      isPinned,
      publishAt,
      expiresAt,
      allowComments,
      allowReactions,
      requireAcknowledgment,
      surveyId,
      status
    } = body

    // Mevcut duyuruyu kontrol et
    const existingAnnouncement = await prisma.announcement.findUnique({
      where: { id }
    })

    if (!existingAnnouncement) {
      return NextResponse.json({ error: 'Duyuru bulunamadi' }, { status: 404 })
    }

    // Status PUBLISHED oluyorsa publishedAt'ı ayarla
    const updateData: Record<string, unknown> = {}

    if (title !== undefined) updateData.title = title
    if (summary !== undefined) updateData.summary = summary
    if (content !== undefined) updateData.content = content
    if (categoryId !== undefined) updateData.categoryId = categoryId
    if (priority !== undefined) updateData.priority = priority
    if (targetType !== undefined) updateData.targetType = targetType
    if (targetDepartments !== undefined) updateData.targetDepartments = targetDepartments
    if (targetRoles !== undefined) updateData.targetRoles = targetRoles
    if (coverImageUrl !== undefined) updateData.coverImageUrl = coverImageUrl
    if (attachments !== undefined) updateData.attachments = attachments
    if (isPinned !== undefined) updateData.isPinned = isPinned
    if (publishAt !== undefined) updateData.publishAt = publishAt ? new Date(publishAt) : null
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null
    if (allowComments !== undefined) updateData.allowComments = allowComments
    if (allowReactions !== undefined) updateData.allowReactions = allowReactions
    if (requireAcknowledgment !== undefined) updateData.requireAcknowledgment = requireAcknowledgment
    if (surveyId !== undefined) updateData.surveyId = surveyId
    if (status !== undefined) {
      updateData.status = status
      if (status === 'PUBLISHED' && existingAnnouncement.status !== 'PUBLISHED') {
        updateData.publishedAt = new Date()
      }
    }

    const announcement = await prisma.announcement.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
        survey: true
      }
    })

    return NextResponse.json(announcement)
  } catch (error) {
    console.error('Duyuru güncellenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE - Duyuru sil
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-announcements: requireUser
    const { session, error } = await requireUser()
    if (error) return error

    const { id } = await params

    // PR-Y10: duyuru.admin permission
    if (!session.user.permissions?.includes('duyuru.admin')) {
      return NextResponse.json({ error: 'Bu islem icin yetkiniz yok' }, { status: 403 })
    }

    await prisma.announcement.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Duyuru silinirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
