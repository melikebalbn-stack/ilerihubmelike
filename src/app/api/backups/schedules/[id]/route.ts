// Backups API - Zamanlama Detay, Güncelleme, Silme
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
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1)
      }
      break

    case 'WEEKLY':
      const targetDay = dayOfWeek || 0
      const currentDay = nextRun.getDay()
      let daysUntilTarget = targetDay - currentDay
      if (daysUntilTarget < 0 || (daysUntilTarget === 0 && nextRun <= now)) {
        daysUntilTarget += 7
      }
      nextRun.setDate(nextRun.getDate() + daysUntilTarget)
      break

    case 'MONTHLY':
      const targetDate = dayOfMonth || 1
      nextRun.setDate(targetDate)
      if (nextRun <= now) {
        nextRun.setMonth(nextRun.getMonth() + 1)
      }
      break
  }

  return nextRun
}

// GET - Zamanlama Detayı
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }

    if (!isAuthorized(session.user.role)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const { id } = await params

    const schedule = await prisma.backupSchedule.findUnique({
      where: { id }
    })

    if (!schedule) {
      return NextResponse.json({ error: 'Zamanlama bulunamadı' }, { status: 404 })
    }

    return NextResponse.json(schedule)
  } catch (error) {
    console.error('Zamanlama detay hatası:', error)
    return NextResponse.json({ error: 'Zamanlama detayı alınamadı' }, { status: 500 })
  }
}

// PUT - Zamanlama Güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }

    if (!isAuthorized(session.user.role)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const {
      name,
      projectName,
      frequency,
      time,
      dayOfWeek,
      dayOfMonth,
      retentionDays,
      includeDatabase,
      isActive
    } = body

    const existingSchedule = await prisma.backupSchedule.findUnique({
      where: { id }
    })

    if (!existingSchedule) {
      return NextResponse.json({ error: 'Zamanlama bulunamadı' }, { status: 404 })
    }

    // Sonraki çalışma zamanını güncelle
    const nextRunAt = calculateNextRunAt(
      frequency || existingSchedule.frequency,
      time || existingSchedule.time,
      dayOfWeek !== undefined ? dayOfWeek : existingSchedule.dayOfWeek,
      dayOfMonth !== undefined ? dayOfMonth : existingSchedule.dayOfMonth
    )

    const schedule = await prisma.backupSchedule.update({
      where: { id },
      data: {
        name,
        projectName,
        frequency,
        time,
        dayOfWeek,
        dayOfMonth,
        retentionDays,
        includeDatabase,
        isActive,
        nextRunAt
      }
    })

    return NextResponse.json(schedule)
  } catch (error) {
    console.error('Zamanlama güncelleme hatası:', error)
    return NextResponse.json({ error: 'Zamanlama güncellenemedi' }, { status: 500 })
  }
}

// DELETE - Zamanlama Sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }

    if (!isAuthorized(session.user.role)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const { id } = await params

    await prisma.backupSchedule.delete({
      where: { id }
    })

    return NextResponse.json({ success: true, message: 'Zamanlama silindi' })
  } catch (error) {
    console.error('Zamanlama silme hatası:', error)
    return NextResponse.json({ error: 'Zamanlama silinemedi' }, { status: 500 })
  }
}
