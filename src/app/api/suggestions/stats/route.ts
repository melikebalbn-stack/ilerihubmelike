import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { oneriGorunurlugu, gorunurlukFiltresi } from '@/lib/suggestions/gorunurluk'

// GET - İstatistikleri getir
//
// SAYAÇLAR KULLANICIYA GÖRE SÜZÜLÜR. Eskiden hiç süzülmüyordu: herkes "Toplam Öneri 4"
// görüyor ama listede yalnız kendi önerisi çıkıyordu. Görünürlük kuralı liste ucuyla
// AYNI KAYNAKTAN gelir (gorunurluk.ts) — kopyalanmaz.
export async function GET() {
  try {
    // PR-Y2.5-suggestions: requireSession
    const { session, error } = await requireSession()
    if (error) return error

    const gorunurluk = await oneriGorunurlugu({
      userEmail: session.user.email ?? '',
      distinguishedName: (session.user as { distinguishedName?: string }).distinguishedName,
    })
    // Tüm sayaç sorgularının ortak tabanı. Kurul üyesinde boş ({}) → eski davranış.
    const gorunur = gorunurlukFiltresi(gorunurluk)

    // Tarih hesaplamaları
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    // FIX #12: Tüm sorguları paralel çalıştır ve groupBy kullan
    const [
      statusGroups,
      thisMonthCount,
      savingsResult,
      categoryDistribution,
      categories,
      departmentDistribution,
      monthlyTrend,
      topContributors
    ] = await Promise.all([
      // 1. Status bazlı count'lar (tek sorgu ile tüm status'lar)
      prisma.suggestion.groupBy({
        by: ['status'],
        where: { ...gorunur, isActive: true },
        _count: { id: true }
      }),

      // 2. Bu ayki öneriler
      prisma.suggestion.count({
        where: {
          ...gorunur,
          isActive: true,
          submittedAt: { gte: startOfMonth }
        }
      }),

      // 3. Toplam tasarruf
      prisma.suggestion.aggregate({
        where: {
          ...gorunur,
          isActive: true,
          status: 'IMPLEMENTED',
          actualSavings: { not: null }
        },
        _sum: { actualSavings: true }
      }),

      // 4. Kategori bazlı dağılım
      prisma.suggestion.groupBy({
        by: ['categoryId'],
        where: { ...gorunur, isActive: true },
        _count: { id: true }
      }),

      // 5. Kategori isimleri
      prisma.suggestionCategory.findMany({
        select: { id: true, name: true, color: true }
      }),

      // 6. Departman bazlı dağılım
      prisma.suggestion.groupBy({
        by: ['submittedByDept'],
        where: {
          ...gorunur,
          isActive: true,
          submittedByDept: { not: null }
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10
      }),

      // 7. Aylık trend (son 6 ay)
      prisma.suggestion.findMany({
        where: {
          ...gorunur,
          isActive: true,
          submittedAt: { gte: sixMonthsAgo }
        },
        select: { submittedAt: true, status: true }
      }),

      // 8. En aktif kullanıcılar
      prisma.suggestion.groupBy({
        by: ['submittedBy', 'submittedByName'],
        where: {
          ...gorunur,
          isActive: true,
          isAnonymous: false
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5
      })
    ])

    // Status count'larını map'le
    const statusCounts: Record<string, number> = {}
    let total = 0
    for (const group of statusGroups) {
      statusCounts[group.status] = group._count.id
      total += group._count.id
    }

    // Pending: SUBMITTED, UNDER_REVIEW, PENDING_APPROVAL
    const pendingCount = (statusCounts['SUBMITTED'] || 0) +
                        (statusCounts['UNDER_REVIEW'] || 0) +
                        (statusCounts['PENDING_APPROVAL'] || 0)

    // Approved: APPROVED, IN_PROGRESS
    const approvedCount = (statusCounts['APPROVED'] || 0) +
                         (statusCounts['IN_PROGRESS'] || 0)

    // Kategori istatistikleri
    const categoryStats = categoryDistribution.map(cd => {
      const cat = categories.find(c => c.id === cd.categoryId)
      return {
        categoryId: cd.categoryId,
        name: cat?.name || 'Kategorisiz',
        color: cat?.color || '#6b7280',
        count: cd._count.id
      }
    })

    // Aylara göre grupla
    const monthlyStats: Record<string, { submitted: number; implemented: number }> = {}
    monthlyTrend.forEach(s => {
      const month = s.submittedAt.toISOString().substring(0, 7)
      if (!monthlyStats[month]) {
        monthlyStats[month] = { submitted: 0, implemented: 0 }
      }
      monthlyStats[month].submitted++
      if (s.status === 'IMPLEMENTED') {
        monthlyStats[month].implemented++
      }
    })

    return NextResponse.json({
      overview: {
        total,
        pending: pendingCount,
        approved: approvedCount,
        implemented: statusCounts['IMPLEMENTED'] || 0,
        rejected: statusCounts['REJECTED'] || 0,
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
