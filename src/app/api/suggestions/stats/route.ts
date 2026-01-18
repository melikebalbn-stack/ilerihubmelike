import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - İstatistikleri getir
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Toplam öneri sayıları
    const totalCount = await prisma.suggestion.count({
      where: { isActive: true }
    })

    const pendingCount = await prisma.suggestion.count({
      where: {
        isActive: true,
        status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'PENDING_APPROVAL'] }
      }
    })

    const approvedCount = await prisma.suggestion.count({
      where: {
        isActive: true,
        status: { in: ['APPROVED', 'IN_PROGRESS'] }
      }
    })

    const implementedCount = await prisma.suggestion.count({
      where: {
        isActive: true,
        status: 'IMPLEMENTED'
      }
    })

    const rejectedCount = await prisma.suggestion.count({
      where: {
        isActive: true,
        status: 'REJECTED'
      }
    })

    // Bu ayki öneriler
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const thisMonthCount = await prisma.suggestion.count({
      where: {
        isActive: true,
        submittedAt: { gte: startOfMonth }
      }
    })

    // Toplam tasarruf
    const savingsResult = await prisma.suggestion.aggregate({
      where: {
        isActive: true,
        status: 'IMPLEMENTED',
        actualSavings: { not: null }
      },
      _sum: { actualSavings: true }
    })

    // Kategori bazlı dağılım
    const categoryDistribution = await prisma.suggestion.groupBy({
      by: ['categoryId'],
      where: { isActive: true },
      _count: { id: true }
    })

    // Kategori isimlerini al
    const categories = await prisma.suggestionCategory.findMany({
      select: { id: true, name: true, color: true }
    })

    const categoryStats = categoryDistribution.map(cd => {
      const cat = categories.find(c => c.id === cd.categoryId)
      return {
        categoryId: cd.categoryId,
        name: cat?.name || 'Kategorisiz',
        color: cat?.color || '#6b7280',
        count: cd._count.id
      }
    })

    // Departman bazlı dağılım
    const departmentDistribution = await prisma.suggestion.groupBy({
      by: ['submittedByDept'],
      where: {
        isActive: true,
        submittedByDept: { not: null }
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10
    })

    // Aylık trend (son 6 ay)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const monthlyTrend = await prisma.suggestion.findMany({
      where: {
        isActive: true,
        submittedAt: { gte: sixMonthsAgo }
      },
      select: { submittedAt: true, status: true }
    })

    // Aylara göre grupla
    const monthlyStats: Record<string, { submitted: number; implemented: number }> = {}
    monthlyTrend.forEach(s => {
      const month = s.submittedAt.toISOString().substring(0, 7) // YYYY-MM
      if (!monthlyStats[month]) {
        monthlyStats[month] = { submitted: 0, implemented: 0 }
      }
      monthlyStats[month].submitted++
      if (s.status === 'IMPLEMENTED') {
        monthlyStats[month].implemented++
      }
    })

    // En aktif kullanıcılar (anonim hariç)
    const topContributors = await prisma.suggestion.groupBy({
      by: ['submittedBy', 'submittedByName'],
      where: {
        isActive: true,
        isAnonymous: false
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5
    })

    return NextResponse.json({
      overview: {
        total: totalCount,
        pending: pendingCount,
        approved: approvedCount,
        implemented: implementedCount,
        rejected: rejectedCount,
        thisMonth: thisMonthCount,
        totalSavings: savingsResult._sum.actualSavings || 0
      },
      categoryStats,
      departmentStats: departmentDistribution.map(d => ({
        department: d.submittedByDept,
        count: d._count.id
      })),
      monthlyTrend: Object.entries(monthlyStats).map(([month, stats]) => ({
        month,
        ...stats
      })).sort((a, b) => a.month.localeCompare(b.month)),
      topContributors: topContributors.map(tc => ({
        name: tc.submittedByName,
        count: tc._count.id
      }))
    })
  } catch (error) {
    console.error('İstatistikler yüklenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
