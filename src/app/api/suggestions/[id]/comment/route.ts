import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/auth-utils'

// GET - Yorumları listele
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

    // FIX #18: Internal yorum filtrelemesi - yöneticiler internal yorumları da görebilir
    const userEmail = String(session.user.email).toLowerCase()
    const userRole = session.user.role || 'EMPLOYEE'
    const userIsAdmin = isAdmin(userEmail, userRole)

    const commentFilter = userIsAdmin
      ? { suggestionId: id } // Admin tüm yorumları görür
      : { suggestionId: id, isInternal: false } // Normal kullanıcılar sadece public yorumları görür

    const comments = await prisma.suggestionComment.findMany({
      where: commentFilter,
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(comments)
  } catch (error) {
    console.error('Yorumlar yüklenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST - Yorum ekle
export async function POST(
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
    const { content, isInternal } = body

    if (!content || content.trim() === '') {
      return NextResponse.json({ error: 'Yorum içeriği zorunludur' }, { status: 400 })
    }

    // Öneriyi kontrol et
    const suggestion = await prisma.suggestion.findUnique({
      where: { id }
    })

    if (!suggestion) {
      return NextResponse.json({ error: 'Öneri bulunamadı' }, { status: 404 })
    }

    // Yorum oluştur
    const comment = await prisma.suggestionComment.create({
      data: {
        suggestionId: id,
        authorEmail: session.user.email,
        authorName: session.user.name || 'Bilinmiyor',
        content,
        isInternal: isInternal || false
      }
    })

    // Timeline'a ekle
    await prisma.suggestionTimeline.create({
      data: {
        suggestionId: id,
        action: 'COMMENT',
        description: isInternal ? 'Dahili not eklendi' : 'Yorum eklendi',
        performedBy: session.user.email,
        performedByName: session.user.name || 'Bilinmiyor'
      }
    })

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    console.error('Yorum eklenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
