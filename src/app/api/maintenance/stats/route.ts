import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Bakım KPI'ları ve istatistikler
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const period = parseInt(searchParams.get('period') || '30') // Son X gün

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - period)

    // FIX #14: Tüm sorguları paralel çalıştır
    const [
      machinesByStatus,
      totalMachines,
      workOrderStats,
      totalWorkOrders,
      breakdownWorkOrders,
      downtimeStats,
      breakdownDowntimeStats,
      completedBreakdowns,
      workOrdersByPriority,
      workOrdersByType,
      plannedWorkOrders,
      completedPlannedWorkOrders,
      oeeStats,
      urgentWorkOrders,
    ] = await Promise.all([
      // Makine sayıları (duruma göre)
      prisma.machine.groupBy({
        by: ['status'],
        where: { isActive: true },
        _count: true,
      }),

      // Toplam makine sayısı
      prisma.machine.count({
        where: { isActive: true },
      }),

      // İş emirleri istatistikleri (duruma göre)
      prisma.maintenanceWorkOrder.groupBy({
        by: ['status'],
        where: {
          isActive: true,
          createdAt: { gte: startDate },
        },
        _count: true,
      }),

      // Toplam iş emri sayısı
      prisma.maintenanceWorkOrder.count({
        where: {
          isActive: true,
          createdAt: { gte: startDate },
        },
      }),

      // Arıza iş emirleri
      prisma.maintenanceWorkOrder.count({
        where: {
          isActive: true,
          workOrderType: 'BREAKDOWN',
          createdAt: { gte: startDate },
        },
      }),

      // FIX #14: Duruş süresi aggregate - tüm kayıtlar
      prisma.downtimeRecord.aggregate({
        where: {
          startTime: { gte: startDate },
          durationMinutes: { not: null },
        },
        _sum: { durationMinutes: true },
      }),

      // FIX #14: Arıza duruş süresi aggregate
      prisma.downtimeRecord.aggregate({
        where: {
          startTime: { gte: startDate },
          durationMinutes: { not: null },
          downtimeType: 'BREAKDOWN',
        },
        _sum: { durationMinutes: true },
      }),

      // Tamamlanan arızalar (MTTR için)
      prisma.maintenanceWorkOrder.count({
        where: {
          workOrderType: 'BREAKDOWN',
          status: { in: ['COMPLETED', 'CLOSED'] },
          createdAt: { gte: startDate },
        },
      }),

      // Öncelik bazlı iş emirleri
      prisma.maintenanceWorkOrder.groupBy({
        by: ['priority'],
        where: {
          isActive: true,
          createdAt: { gte: startDate },
        },
        _count: true,
      }),

      // Tip bazlı iş emirleri
      prisma.maintenanceWorkOrder.groupBy({
        by: ['workOrderType'],
        where: {
          isActive: true,
          createdAt: { gte: startDate },
        },
        _count: true,
      }),

      // Planlı bakım sayısı
      prisma.maintenanceWorkOrder.count({
        where: {
          workOrderType: 'PREVENTIVE',
          createdAt: { gte: startDate },
        },
      }),

      // Tamamlanan planlı bakım sayısı
      prisma.maintenanceWorkOrder.count({
        where: {
          workOrderType: 'PREVENTIVE',
          status: { in: ['COMPLETED', 'CLOSED'] },
          createdAt: { gte: startDate },
        },
      }),

      // FIX #14: OEE aggregate - tüm verileri çekip uygulama tarafında ortalama almak yerine DB'de hesapla
      prisma.machineOEERecord.aggregate({
        where: {
          recordDate: { gte: startDate },
        },
        _avg: {
          oee: true,
          availability: true,
          performance: true,
          quality: true,
        },
        _count: {
          id: true,
        },
      }),

      // Acil iş emirleri (açık ve kritik/yüksek öncelikli)
      prisma.maintenanceWorkOrder.count({
        where: {
          isActive: true,
          status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] },
          priority: { in: ['CRITICAL', 'HIGH'] },
        },
      }),
    ])

    // Hesaplamalar
    const totalDowntimeMinutes = downtimeStats._sum.durationMinutes || 0
    const breakdownDowntimeMinutes = breakdownDowntimeStats._sum.durationMinutes || 0

    // MTBF hesaplama (Mean Time Between Failures)
    const totalOperatingHours = period * 24 * totalMachines
    const mtbfHours = breakdownWorkOrders > 0
      ? Math.round((totalOperatingHours - (totalDowntimeMinutes / 60)) / breakdownWorkOrders)
      : totalOperatingHours

    // MTTR hesaplama (Mean Time To Repair)
    const mttrMinutes = completedBreakdowns > 0
      ? Math.round(breakdownDowntimeMinutes / completedBreakdowns)
      : 0

    // PM Compliance
    const pmCompliance = plannedWorkOrders > 0
      ? Math.round((completedPlannedWorkOrders / plannedWorkOrders) * 100)
      : 100

    // OEE değerleri - aggregate'ten gelen değerler
    const avgOEE = Math.round(oeeStats._avg.oee || 0)
    const avgAvailability = Math.round(oeeStats._avg.availability || 0)
    const avgPerformance = Math.round(oeeStats._avg.performance || 0)
    const avgQuality = Math.round(oeeStats._avg.quality || 0)
    const oeeRecordCount = oeeStats._count.id

    return NextResponse.json({
      period,
      machines: {
        total: totalMachines,
        byStatus: machinesByStatus.reduce((acc, item) => {
          acc[item.status] = item._count
          return acc
        }, {} as Record<string, number>),
      },
      workOrders: {
        total: totalWorkOrders,
        breakdown: breakdownWorkOrders,
        urgent: urgentWorkOrders,
        byStatus: workOrderStats.reduce((acc, item) => {
          acc[item.status] = item._count
          return acc
        }, {} as Record<string, number>),
        byPriority: workOrdersByPriority.reduce((acc, item) => {
          acc[item.priority] = item._count
          return acc
        }, {} as Record<string, number>),
        byType: workOrdersByType.reduce((acc, item) => {
          acc[item.workOrderType] = item._count
          return acc
        }, {} as Record<string, number>),
      },
      kpis: {
        mtbf: mtbfHours, // Saat
        mttr: mttrMinutes, // Dakika
        pmCompliance, // Yüzde
        totalDowntimeHours: Math.round(totalDowntimeMinutes / 60),
        breakdownDowntimeHours: Math.round(breakdownDowntimeMinutes / 60),
      },
      oee: {
        average: avgOEE,
        availability: avgAvailability,
        performance: avgPerformance,
        quality: avgQuality,
        recordCount: oeeRecordCount,
      },
    })
  } catch (error) {
    console.error('Error fetching maintenance stats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
