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

    // Makine sayıları (duruma göre)
    const machinesByStatus = await prisma.machine.groupBy({
      by: ['status'],
      where: { isActive: true },
      _count: true,
    })

    const totalMachines = await prisma.machine.count({
      where: { isActive: true },
    })

    // İş emirleri istatistikleri
    const workOrderStats = await prisma.maintenanceWorkOrder.groupBy({
      by: ['status'],
      where: {
        isActive: true,
        createdAt: { gte: startDate },
      },
      _count: true,
    })

    const totalWorkOrders = await prisma.maintenanceWorkOrder.count({
      where: {
        isActive: true,
        createdAt: { gte: startDate },
      },
    })

    // Arıza iş emirleri
    const breakdownWorkOrders = await prisma.maintenanceWorkOrder.count({
      where: {
        isActive: true,
        workOrderType: 'BREAKDOWN',
        createdAt: { gte: startDate },
      },
    })

    // Toplam duruş süresi (dakika)
    const downtimeRecords = await prisma.downtimeRecord.findMany({
      where: {
        startTime: { gte: startDate },
        durationMinutes: { not: null },
      },
      select: {
        durationMinutes: true,
        downtimeType: true,
      },
    })

    const totalDowntimeMinutes = downtimeRecords.reduce(
      (sum, record) => sum + (record.durationMinutes || 0),
      0
    )

    const breakdownDowntimeMinutes = downtimeRecords
      .filter(r => r.downtimeType === 'BREAKDOWN')
      .reduce((sum, record) => sum + (record.durationMinutes || 0), 0)

    // MTBF hesaplama (Mean Time Between Failures)
    // Toplam çalışma süresi / Arıza sayısı
    const totalOperatingHours = period * 24 * totalMachines // Yaklaşık
    const mtbfHours = breakdownWorkOrders > 0
      ? Math.round((totalOperatingHours - (totalDowntimeMinutes / 60)) / breakdownWorkOrders)
      : totalOperatingHours

    // MTTR hesaplama (Mean Time To Repair)
    // Toplam onarım süresi / Onarım sayısı
    const completedBreakdowns = await prisma.maintenanceWorkOrder.count({
      where: {
        workOrderType: 'BREAKDOWN',
        status: { in: ['COMPLETED', 'CLOSED'] },
        createdAt: { gte: startDate },
      },
    })

    const mttrMinutes = completedBreakdowns > 0
      ? Math.round(breakdownDowntimeMinutes / completedBreakdowns)
      : 0

    // Öncelik bazlı iş emirleri
    const workOrdersByPriority = await prisma.maintenanceWorkOrder.groupBy({
      by: ['priority'],
      where: {
        isActive: true,
        createdAt: { gte: startDate },
      },
      _count: true,
    })

    // Tip bazlı iş emirleri
    const workOrdersByType = await prisma.maintenanceWorkOrder.groupBy({
      by: ['workOrderType'],
      where: {
        isActive: true,
        createdAt: { gte: startDate },
      },
      _count: true,
    })

    // Planlı bakım uyumu
    const plannedWorkOrders = await prisma.maintenanceWorkOrder.count({
      where: {
        workOrderType: 'PREVENTIVE',
        createdAt: { gte: startDate },
      },
    })

    const completedPlannedWorkOrders = await prisma.maintenanceWorkOrder.count({
      where: {
        workOrderType: 'PREVENTIVE',
        status: { in: ['COMPLETED', 'CLOSED'] },
        createdAt: { gte: startDate },
      },
    })

    const pmCompliance = plannedWorkOrders > 0
      ? Math.round((completedPlannedWorkOrders / plannedWorkOrders) * 100)
      : 100

    // Son OEE kayıtları (ortalama)
    const oeeRecords = await prisma.machineOEERecord.findMany({
      where: {
        recordDate: { gte: startDate },
      },
      select: {
        oee: true,
        availability: true,
        performance: true,
        quality: true,
      },
    })

    const avgOEE = oeeRecords.length > 0
      ? Math.round(oeeRecords.reduce((sum, r) => sum + r.oee, 0) / oeeRecords.length)
      : 0

    const avgAvailability = oeeRecords.length > 0
      ? Math.round(oeeRecords.reduce((sum, r) => sum + r.availability, 0) / oeeRecords.length)
      : 0

    const avgPerformance = oeeRecords.length > 0
      ? Math.round(oeeRecords.reduce((sum, r) => sum + r.performance, 0) / oeeRecords.length)
      : 0

    const avgQuality = oeeRecords.length > 0
      ? Math.round(oeeRecords.reduce((sum, r) => sum + r.quality, 0) / oeeRecords.length)
      : 0

    // Acil iş emirleri (açık ve kritik/yüksek öncelikli)
    const urgentWorkOrders = await prisma.maintenanceWorkOrder.count({
      where: {
        isActive: true,
        status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] },
        priority: { in: ['CRITICAL', 'HIGH'] },
      },
    })

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
        recordCount: oeeRecords.length,
      },
    })
  } catch (error) {
    console.error('Error fetching maintenance stats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
