import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'

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

    await prisma.announcementRead.upsert({
      where: { announcementId_userEmail: { announcementId: id, userEmail } },
      create: {
        announcementId: id,
        userEmail,
        userName: user.name || userEmail,
        userDepartment,
      },
      update: {}, // zaten görülmüş/onaylanmışsa dokunma
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Duyuru görüldü kaydı hatası:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
