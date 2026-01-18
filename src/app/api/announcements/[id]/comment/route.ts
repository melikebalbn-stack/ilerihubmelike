import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
    const userEmail = String(session.user.email).toLowerCase()
    const body = await request.json()
    const { content, parentId } = body

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Yorum icerigi zorunludur' }, { status: 400 })
    }

    // Duyuruyu kontrol et
    const announcement = await prisma.announcement.findUnique({
      where: { id }
    })

    if (!announcement) {
      return NextResponse.json({ error: 'Duyuru bulunamadi' }, { status: 404 })
    }

    if (!announcement.allowComments) {
      return NextResponse.json({ error: 'Bu duyuruda yorumlar kapatilmis' }, { status: 400 })
    }

    // Üst yorum varsa kontrol et
    if (parentId) {
      const parentComment = await prisma.announcementComment.findUnique({
        where: { id: parentId }
      })

      if (!parentComment || parentComment.announcementId !== id) {
        return NextResponse.json({ error: 'Gecersiz ust yorum' }, { status: 400 })
      }
    }

    // Yorum oluştur
    const comment = await prisma.announcementComment.create({
      data: {
        announcementId: id,
        authorEmail: userEmail,
        authorName: session.user.name || userEmail,
        content: content.trim(),
        parentId
      }
    })

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    console.error('Yorum eklenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE - Yorum sil
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
    const userRole = session.user.role || 'EMPLOYEE'

    const { searchParams } = new URL(request.url)
    const commentId = searchParams.get('commentId')

    if (!commentId) {
      return NextResponse.json({ error: 'Yorum ID zorunludur' }, { status: 400 })
    }

    // Yorumu bul
    const comment = await prisma.announcementComment.findUnique({
      where: { id: commentId }
    })

    if (!comment || comment.announcementId !== id) {
      return NextResponse.json({ error: 'Yorum bulunamadi' }, { status: 404 })
    }

    // Yetki kontrolü - Sadece yorum sahibi veya admin silebilir
    const isAdmin = userEmail === 'melih.dilben@ilerigroup.com' ||
                    userRole === 'ADMIN' ||
                    userRole === 'SUPER_ADMIN'

    if (comment.authorEmail !== userEmail && !isAdmin) {
      return NextResponse.json({ error: 'Bu yorumu silme yetkiniz yok' }, { status: 403 })
    }

    // Yorumu sil
    await prisma.announcementComment.delete({
      where: { id: commentId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Yorum silinirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
