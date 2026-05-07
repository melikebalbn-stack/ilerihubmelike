import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdmin as checkIsAdmin } from '@/lib/auth-utils'
import { requireUser } from '@/lib/auth/require-user'

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

    // Okundu kaydını güncelle veya oluştur
    const readRecord = await prisma.announcementRead.upsert({
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
        userDepartment,
        acknowledged: true,
        acknowledgedAt: new Date()
      },
      update: {
        acknowledged: true,
        acknowledgedAt: new Date()
      }
    })

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
    const { user, error } = await requireUser()
    if (error) return error

    const { id } = await params
    const userEmail = user.email
    const userRole = user.role || 'EMPLOYEE'

    // FIX #4: Merkezi utility kullanıldı
    const isAdmin = checkIsAdmin(userEmail, userRole)

    if (!isAdmin) {
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
