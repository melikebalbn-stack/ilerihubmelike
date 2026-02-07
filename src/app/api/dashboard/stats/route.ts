import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAllLDAPUsers, getDirectReports } from '@/lib/ldap'
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api-response'

// GET /api/dashboard/stats - Dashboard istatistikleri
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return apiUnauthorized()
    }

    const userId = session.user.id
    const userEmail = session.user.email || ''
    const userRole = session.user.role
    const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'QUALITY_MANAGER', 'HR_MANAGER', 'IT_MANAGER'].includes(userRole)

    // Tarih hesaplamaları
    const now = new Date()
    const thirtyDaysFromNow = new Date(now)
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    // Paralel olarak tüm verileri çek
    const [
      // Çalışan sayısı (LDAP)
      ldapUsers,
      // Kalibrasyon cihazları
      totalDevices,
      upcomingCalibrations,
      // Bekleyen öneriler
      pendingSuggestions,
      mySuggestions,
      // Açık ticket sayısı
      openTickets,
      myTickets,
      // Son aktiviteler
      recentSuggestions,
      recentCalibrations,
      // Yaklaşan kalibrasyonlar (detay)
      upcomingCalibrationDetails,
    ] = await Promise.all([
      getAllLDAPUsers().catch(() => []),
      prisma.calibrationDevice.count({ where: { isActive: true } }),
      prisma.calibrationDevice.count({
        where: {
          isActive: true,
          nextCalibrationDate: {
            gte: now,
            lte: thirtyDaysFromNow,
          },
        },
      }),
      prisma.suggestion.count({
        where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'PENDING_APPROVAL'] } },
      }),
      prisma.suggestion.count({
        where: {
          submittedBy: userEmail,
          status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'PENDING_APPROVAL'] },
        },
      }),
      prisma.ticket.count({
        where: { status: { in: ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'PENDING', 'REOPENED'] } },
      }),
      prisma.ticket.count({
        where: {
          OR: [
            { requesterEmail: userEmail },
            { assignedTo: userEmail },
          ],
          status: { in: ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'PENDING', 'REOPENED'] },
        },
      }),
      // Son 10 öneri
      prisma.suggestion.findMany({
        take: 10,
        orderBy: { submittedAt: 'desc' },
        select: {
          id: true,
          title: true,
          status: true,
          submittedAt: true,
          submittedByName: true,
        },
      }),
      // Son 10 kalibrasyon
      prisma.calibrationHistory.findMany({
        take: 10,
        orderBy: { calibrationDate: 'desc' },
        select: {
          id: true,
          calibrationDate: true,
          result: true,
          device: {
            select: {
              deviceId: true,
              name: true,
            },
          },
        },
      }),
      // Yaklaşan kalibrasyonlar (detay)
      prisma.calibrationDevice.findMany({
        where: {
          isActive: true,
          nextCalibrationDate: {
            gte: now,
            lte: thirtyDaysFromNow,
          },
        },
        orderBy: { nextCalibrationDate: 'asc' },
        take: 5,
        select: {
          id: true,
          deviceId: true,
          name: true,
          nextCalibrationDate: true,
          location: true,
        },
      }),
    ])

    // Kullanıcının görevleri (admin için tüm pending işler, kullanıcı için kendi işleri)
    const myTasks = {
      suggestions: isAdmin ? pendingSuggestions : mySuggestions,
      tickets: isAdmin ? openTickets : myTickets,
    }

    // Son aktiviteleri birleştir
    const recentActivities = [
      ...recentSuggestions.map((s) => ({
        type: 'suggestion' as const,
        id: s.id,
        title: s.title,
        status: s.status,
        date: s.submittedAt,
        user: s.submittedByName || 'Bilinmeyen',
      })),
      ...recentCalibrations.map((c) => ({
        type: 'calibration' as const,
        id: c.id,
        title: `${c.device?.name || 'Cihaz'} - ${c.device?.deviceId || ''}`,
        status: c.result,
        date: c.calibrationDate,
        user: null,
      })),
    ]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10)

    // İstatistikler
    const stats = {
      employees: {
        total: ldapUsers.length,
        label: 'Toplam Çalışan',
      },
      devices: {
        total: totalDevices,
        upcoming: upcomingCalibrations,
        label: 'Aktif Cihaz',
      },
      suggestions: {
        pending: isAdmin ? pendingSuggestions : mySuggestions,
        label: isAdmin ? 'Bekleyen Öneri' : 'Benim Önerilerim',
      },
      tickets: {
        open: isAdmin ? openTickets : myTickets,
        label: isAdmin ? 'Açık Ticket' : 'Benim Ticketlarım',
      },
    }

    return apiSuccess({
      stats,
      myTasks,
      upcomingCalibrations: upcomingCalibrationDetails.map((c) => ({
        id: c.id,
        deviceCode: c.deviceId,
        deviceName: c.name || 'Cihaz',
        location: c.location || '',
        nextCalibrationDate: c.nextCalibrationDate,
        daysLeft: Math.ceil(
          (new Date(c.nextCalibrationDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        ),
      })),
      recentActivities,
      isAdmin,
    })

  } catch (error) {
    console.error('Dashboard stats error:', error)
    return apiError('Dashboard verileri alınamadı', 500, {
      endpoint: '/api/dashboard/stats',
      error,
    })
  }
}
