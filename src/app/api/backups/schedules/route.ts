// Backups API - Zamanlamalar
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Yetki kontrolü
function isAuthorized(userRole: string): boolean {
  const allowedRoles = ['IT_MANAGER', 'ADMIN', 'SUPER_ADMIN']
  return allowedRoles.includes(userRole)
}

// Sonraki çalışma zamanını hesapla
function calculateNextRunAt(frequency: string, time: string, dayOfWeek?: number | null, dayOfMonth?: number | null): Date {
  const [hours, minutes] = time.split(':').map(Number)
  const now = new Date()
  const nextRun = new Date()

  nextRun.setHours(hours, minutes, 0, 0)

  switch (frequency) {
    case 'DAILY':
      // Bugünün saati geçtiyse yarına ayarla
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1)
      }
      break

    case 'WEEKLY':
      // Belirtilen güne ayarla
      const targetDay = dayOfWeek || 0
      const currentDay = nextRun.getDay()
      let daysUntilTarget = targetDay - currentDay
      if (daysUntilTarget < 0 || (daysUntilTarget === 0 && nextRun <= now)) {
        daysUntilTarget += 7
      }
      nextRun.setDate(nextRun.getDate() + daysUntilTarget)
      break

    case 'MONTHLY':
      // Belirtilen güne ayarla
      const targetDate = dayOfMonth || 1
      nextRun.setDate(targetDate)
      if (nextRun <= now) {
        nextRun.setMonth(nextRun.getMonth() + 1)
      }
      break
  }

  return nextRun
}

// GET - Zamanlama Listesi
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }

    if (!isAuthorized(session.user.role)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const schedules = await prisma.backupSchedule.findMany({
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(schedules)
  } catch (error) {
    console.error('Zamanlama listesi hatası:', error)
    return NextResponse.json({ error: 'Zamanlamalar alınamadı' }, { status: 500 })
  }
}

// POST - Yeni Zamanlama Oluştur
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }

    if (!isAuthorized(session.user.role)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()
    const {
      name,
      projectName,
      frequency,
      time,
      dayOfWeek,
      dayOfMonth,
      retentionDays = 30,
      includeDatabase = true
    } = body

    if (!name || !projectName || !frequency || !time) {
      return NextResponse.json({ error: 'Zorunlu alanlar eksik' }, { status: 400 })
    }

    if (!['DAILY', 'WEEKLY', 'MONTHLY'].includes(frequency)) {
      return NextResponse.json({ error: 'Geçersiz sıklık' }, { status: 400 })
    }

    if (!['ILERIHub', 'Akademi', 'Database', 'All'].includes(projectName)) {
      return NextResponse.json({ error: 'Geçersiz proje adı' }, { status: 400 })
    }

    const nextRunAt = calculateNextRunAt(frequency, time, dayOfWeek, dayOfMonth)

    const schedule = await prisma.backupSchedule.create({
      data: {
        name,
        projectName,
        frequency,
        time,
        dayOfWeek,
        dayOfMonth,
        retentionDays,
        includeDatabase,
        nextRunAt,
        createdBy: session.user.email
      }
    })

    return NextResponse.json(schedule, { status: 201 })
  } catch (error) {
    console.error('Zamanlama oluşturma hatası:', error)
    return NextResponse.json({ error: 'Zamanlama oluşturulamadı' }, { status: 500 })
  }
}
