import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { viewCountDelta } from '@/lib/announcements/view-count'

// POST - Okundu onayı ver
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-announcements: requireUser
    const { user, error } = await requireUser()
    if (error) return error

    const { id } = await params
    const userEmail = user.email
    const userDepartment = user.department

    // Duyuruyu kontrol et
    const announcement = await prisma.announcement.findUnique({
      where: { id }
    })

    if (!announcement) {
      return NextResponse.json({ error: 'Duyuru bulunamadi' }, { status: 404 })
    }

    if (!announcement.requireAcknowledgment) {
      return NextResponse.json({ error: 'Bu duyuru okundu onayi gerektirmiyor' }, { status: 400 })
    }

    // Görüntülenme = TEKİL okuyucu. İlk kayıt (INSERT) oluşurken viewCount +1;
    // zaten kaydı varsa yalnız onay güncellenir, sayaç artmaz.
    const existing = await prisma.announcementRead.findUnique({
      where: { announcementId_userEmail: { announcementId: id, userEmail } },
      select: { id: true }
    })

    let readRecord
    if (viewCountDelta(Boolean(existing)) === 1) {
      const [created] = await prisma.$transaction([
        prisma.announcementRead.create({
          data: {
            announcementId: id,
            userEmail,
            userName: user.name || userEmail,
            userDepartment,
            acknowledged: true,
            acknowledgedAt: new Date()
          }
        }),
        prisma.announcement.update({ where: { id }, data: { viewCount: { increment: 1 } } })
      ])
      readRecord = created
    } else {
      readRecord = await prisma.announcementRead.update({
        where: { announcementId_userEmail: { announcementId: id, userEmail } },
        data: { acknowledged: true, acknowledgedAt: new Date() }
      })
    }

    return NextResponse.json(readRecord)
  } catch (error) {
    console.error('Okundu onayi verilirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// GET - Okundu istatistikleri (Admin için)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-announcements: requireUser
    const { session, error } = await requireUser()
    if (error) return error

    const { id } = await params

    // PR-Y10: duyuru.admin permission (okundu istatistikleri admin işidir)
    if (!session.user.permissions?.includes('duyuru.admin')) {
      return NextResponse.json({ error: 'Bu islem icin yetkiniz yok' }, { status: 403 })
    }

    // Duyuruyu kontrol et
    const announcement = await prisma.announcement.findUnique({
      where: { id }
    })

    if (!announcement) {
      return NextResponse.json({ error: 'Duyuru bulunamadi' }, { status: 404 })
    }

    // Okunma kayıtlarını getir
    const reads = await prisma.announcementRead.findMany({
      where: { announcementId: id },
      orderBy: { readAt: 'desc' }
    })

    // İstatistikler
    const totalReads = reads.length
    const acknowledged = reads.filter(r => r.acknowledged).length
    const notAcknowledged = reads.filter(r => !r.acknowledged).length

    // Departmanlara göre grupla
    const byDepartment = reads.reduce((acc, r) => {
      const dept = r.userDepartment || 'Bilinmiyor'
      if (!acc[dept]) {
        acc[dept] = { total: 0, acknowledged: 0 }
      }
      acc[dept].total++
      if (r.acknowledged) acc[dept].acknowledged++
      return acc
    }, {} as Record<string, { total: number; acknowledged: number }>)

    return NextResponse.json({
      totalReads,
      acknowledged,
      notAcknowledged,
      byDepartment,
      reads
    })
  } catch (error) {
    console.error('Okunma istatistikleri yüklenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
