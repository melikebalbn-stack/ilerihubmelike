import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { viewCountDelta } from '@/lib/announcements/view-count'

// POST - Popup GÖRÜLDÜ (onay değil): AnnouncementRead upsert (readAt now).
// Onay gerektirmeyen duyuru popup'ı kapatılınca çağrılır → bir daha çıkmaz.
// (Onay gerektiren duyuru için /acknowledge kullanılır; o da aynı satırı yazar.)
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireUser()
    if (error) return error

    const { id } = await params
    const userEmail = user.email
    const userDepartment = user.department

    const announcement = await prisma.announcement.findUnique({
      where: { id },
      select: { id: true, status: true },
    })
    if (!announcement) {
      return NextResponse.json({ error: 'Duyuru bulunamadi' }, { status: 404 })
    }

    // Görüntülenme = TEKİL okuyucu. Yalnız İLK kayıt (INSERT) oluşurken viewCount +1;
    // aynı kişi ikinci kez çağırınca (AnnouncementRead unique zaten var) sayaç artmaz.
    const existing = await prisma.announcementRead.findUnique({
      where: { announcementId_userEmail: { announcementId: id, userEmail } },
      select: { id: true },
    })
    if (viewCountDelta(Boolean(existing)) === 1) {
      await prisma.$transaction([
        prisma.announcementRead.create({
          data: { announcementId: id, userEmail, userName: user.name || userEmail, userDepartment },
        }),
        prisma.announcement.update({ where: { id }, data: { viewCount: { increment: 1 } } }),
      ])
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Duyuru görüldü kaydı hatası:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
