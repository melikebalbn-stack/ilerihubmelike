import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'

// GET - Yorumları listele
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-suggestions: requireUser
    const { session, error } = await requireUser()
    if (error) return error

    const { id } = await params

    // PR-AUTHUTILS-CLEAN: duyuru.admin permission'ı (yöneticiler internal yorumları görebilir)
    const userIsAdmin = session.user.permissions?.includes('duyuru.admin') ?? false

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
    // PR-Y2.5-suggestions: requireUser
    const { user, error } = await requireUser()
    if (error) return error

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
        authorEmail: user.email,
        authorName: user.name ?? user.email,
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
        performedBy: user.email,
        performedByName: user.name ?? user.email
      }
    })

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    console.error('Yorum eklenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
