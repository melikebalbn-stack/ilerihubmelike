import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/auth-utils'

// GET - Öneri detayı
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
    const userIsAdmin = isAdmin(userEmail, userRole)

    // Yönetici ise internal yorumları da göster
    const commentFilter = userIsAdmin
      ? {} // Admin tüm yorumları görür
      : { isInternal: false } // Normal kullanıcılar sadece public yorumları görür

    const suggestion = await prisma.suggestion.findUnique({
      where: { id },
      include: {
        category: true,
        approvalHistory: {
          orderBy: { createdAt: 'desc' }
        },
        comments: {
          where: commentFilter,
          orderBy: { createdAt: 'desc' }
        },
        timeline: {
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!suggestion) {
      return NextResponse.json({ error: 'Öneri bulunamadı' }, { status: 404 })
    }

    // Anonim önerilerde gönderen bilgisini gizle (kendi önerileri hariç)
    if (suggestion.isAnonymous && suggestion.submittedBy !== session.user.email) {
      return NextResponse.json({
        ...suggestion,
        submittedBy: 'anonim@ilerigroup.com',
        submittedByName: 'Anonim',
        submittedByDept: null
      })
    }

    return NextResponse.json(suggestion)
  } catch (error) {
    console.error('Öneri detayı yüklenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PUT - Öneri güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    // Mevcut öneriyi bul
    const existingSuggestion = await prisma.suggestion.findUnique({
      where: { id }
    })

    if (!existingSuggestion) {
      return NextResponse.json({ error: 'Öneri bulunamadı' }, { status: 404 })
    }

    // Sadece öneri sahibi veya admin düzenleyebilir
    const userEmail = String(session.user.email).toLowerCase()
    const userRole = session.user.role || 'EMPLOYEE'
    const userIsAdmin = isAdmin(userEmail, userRole)

    if (existingSuggestion.submittedBy.toLowerCase() !== userEmail && !userIsAdmin) {
      return NextResponse.json({ error: 'Bu öneriyi düzenleme yetkiniz yok' }, { status: 403 })
    }

    // Sadece SUBMITTED durumundaki öneriler düzenlenebilir
    if (existingSuggestion.status !== 'SUBMITTED') {
      return NextResponse.json(
        { error: 'İncelemeye alınan öneriler düzenlenemez' },
        { status: 400 }
      )
    }

    const {
      title,
      description,
      currentSituation,
      proposedSolution,
      expectedBenefit,
      estimatedSavings,
      categoryId,
      priority,
      suggestionType,
      attachments
    } = body

    const suggestion = await prisma.suggestion.update({
      where: { id },
      data: {
        title,
        description,
        currentSituation,
        proposedSolution,
        expectedBenefit,
        estimatedSavings: estimatedSavings ? parseFloat(estimatedSavings) : null,
        categoryId: categoryId || null,
        priority: priority || 'NORMAL',
        suggestionType: suggestionType || 'IMPROVEMENT',
        attachments: attachments ? JSON.stringify(attachments) : null
      },
      include: {
        category: true
      }
    })

    // Timeline'a ekle
    await prisma.suggestionTimeline.create({
      data: {
        suggestionId: suggestion.id,
        action: 'UPDATED',
        description: 'Öneri güncellendi',
        performedBy: session.user.email,
        performedByName: session.user.name || 'Bilinmiyor'
      }
    })

    return NextResponse.json(suggestion)
  } catch (error) {
    console.error('Öneri güncellenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE - Öneri sil
export async function DELETE(
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

    // FIX #4: Merkezi utility kullanıldı
    // Admin kontrolü - sadece admin tüm önerileri silebilir
    const userIsAdmin = isAdmin(userEmail, session.user.role)

    const existingSuggestion = await prisma.suggestion.findUnique({
      where: { id }
    })

    if (!existingSuggestion) {
      return NextResponse.json({ error: 'Öneri bulunamadı' }, { status: 404 })
    }

    // Admin her şeyi silebilir, diğerleri sadece kendi önerilerini
    if (!userIsAdmin) {
      // Sadece öneri sahibi silebilir
      if (existingSuggestion.submittedBy.toLowerCase() !== userEmail) {
        return NextResponse.json({ error: 'Bu öneriyi silme yetkiniz yok' }, { status: 403 })
      }

      // Normal kullanıcılar sadece SUBMITTED durumundaki önerilerini silebilir
      if (existingSuggestion.status !== 'SUBMITTED') {
        return NextResponse.json(
          { error: 'İncelemeye alınan öneriler silinemez' },
          { status: 400 }
        )
      }
    }

    // Hard delete for admin, soft delete for others
    if (userIsAdmin) {
      // İlişkili kayıtları sil
      await prisma.suggestionComment.deleteMany({ where: { suggestionId: id } })
      await prisma.suggestionTimeline.deleteMany({ where: { suggestionId: id } })
      await prisma.suggestionApproval.deleteMany({ where: { suggestionId: id } })
      await prisma.suggestion.delete({ where: { id } })
    } else {
      // Soft delete
      await prisma.suggestion.update({
        where: { id },
        data: { isActive: false }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Öneri silinirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
