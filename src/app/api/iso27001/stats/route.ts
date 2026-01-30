import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Dashboard istatistikleri - Optimize edilmiş (26 sorgu → 10 sorgu)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    const now = new Date()

    // Optimize edilmiş sorgular - groupBy kullanarak tek sorguda birden fazla count alıyoruz
    const [
      // 1. Doküman istatistikleri - groupBy ile tek sorgu
      docStats,
      reviewNeededDocs,
      // 2. İmza istatistikleri - tek sorgu
      totalSignatures,
      // 3. Kontrol istatistikleri - status ve category bazlı groupBy
      controlStatusStats,
      controlCategoryStats,
      // 4. Denetim istatistikleri - groupBy ile tek sorgu
      auditStats,
      openFindings,
      // 5. Risk istatistikleri - groupBy ile tek sorgu
      riskStats,
      // 6. Eğitim istatistikleri - groupBy ile tek sorgu
      trainingStats,
      digitalSignatures,
      // 7. Olay istatistikleri - groupBy ile tek sorgu
      incidentStats,
      // 8. Yönetim gözden geçirme
      reviewStats,
    ] = await Promise.all([
      // Doküman status grupları
      prisma.iso27001Document.groupBy({
        by: ['status'],
        where: { isActive: true, isLatestVersion: true },
        _count: { _all: true }
      }),
      // Gözden geçirilmesi gereken dokümanlar (bu özel filtre için ayrı sorgu gerekli)
      prisma.iso27001Document.count({
        where: {
          isActive: true,
          isLatestVersion: true,
          nextReviewDate: { lte: thirtyDaysFromNow, gte: now },
        },
      }),
      // İmzalar
      prisma.iso27001Signature.count(),
      // Kontrol status grupları
      prisma.iso27001Control.groupBy({
        by: ['status'],
        _count: { _all: true }
      }),
      // Kontrol kategori-status grupları (sadece uygulanan/etkin kontroller için)
      prisma.iso27001Control.groupBy({
        by: ['category', 'status'],
        where: { status: { in: ['IMPLEMENTED', 'EFFECTIVE'] } },
        _count: { _all: true }
      }),
      // Denetim status grupları
      prisma.iso27001Audit.groupBy({
        by: ['status'],
        _count: { _all: true }
      }),
      // Açık bulgular
      prisma.iso27001AuditFinding.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
      // Risk grupları (sadece kapalı olmayanlar)
      prisma.iso27001Risk.groupBy({
        by: ['riskLevel'],
        where: { status: { not: "CLOSED" } },
        _count: { _all: true }
      }),
      // Eğitim status grupları
      prisma.iso27001Training.groupBy({
        by: ['status'],
        _count: { _all: true }
      }),
      // Dijital imzalar
      prisma.iso27001TrainingAssignment.count({ where: { status: "SIGNED" } }),
      // Olay status grupları
      prisma.iso27001Incident.groupBy({
        by: ['status'],
        _count: { _all: true }
      }),
      // Yönetim gözden geçirme - count ve son tarih birlikte
      prisma.iso27001ManagementReview.aggregate({
        _count: { _all: true },
        _max: { reviewDate: true }
      }),
    ])

    // Doküman istatistiklerini hesapla
    const totalDocs = docStats.reduce((sum, s) => sum + s._count._all, 0)
    const approvedDocs = docStats
      .filter(s => s.status === 'APPROVED' || s.status === 'PUBLISHED')
      .reduce((sum, s) => sum + s._count._all, 0)
    const pendingDocs = docStats.find(s => s.status === 'PENDING_APPROVAL')?._count._all || 0

    // Kontrol istatistiklerini hesapla
    const totalControls = controlStatusStats.reduce((sum, s) => sum + s._count._all, 0)
    const implementedControls = controlStatusStats
      .filter(s => s.status === 'IMPLEMENTED' || s.status === 'EFFECTIVE')
      .reduce((sum, s) => sum + s._count._all, 0)
    const partialControls = controlStatusStats.find(s => s.status === 'PARTIALLY')?._count._all || 0
    const notImplementedControls = controlStatusStats.find(s => s.status === 'NOT_IMPLEMENTED')?._count._all || 0
    const naControls = controlStatusStats.find(s => s.status === 'NOT_APPLICABLE')?._count._all || 0

    // Kategori bazlı uygulanan kontroller
    const getCategoryImplemented = (category: string) =>
      controlCategoryStats
        .filter(s => s.category === category)
        .reduce((sum, s) => sum + s._count._all, 0)

    // Denetim istatistiklerini hesapla
    const plannedAudits = auditStats.find(s => s.status === 'PLANNED')?._count._all || 0
    const inProgressAudits = auditStats.find(s => s.status === 'IN_PROGRESS')?._count._all || 0

    // Risk istatistiklerini hesapla
    const totalRisks = riskStats.reduce((sum, s) => sum + s._count._all, 0)
    const highRisks = riskStats.find(s => s.riskLevel === 'HIGH')?._count._all || 0
    const mediumRisks = riskStats.find(s => s.riskLevel === 'MEDIUM')?._count._all || 0
    const lowRisks = riskStats.find(s => s.riskLevel === 'LOW')?._count._all || 0

    // Eğitim istatistiklerini hesapla
    const totalTrainings = trainingStats.reduce((sum, s) => sum + s._count._all, 0)
    const completedTrainings = trainingStats.find(s => s.status === 'COMPLETED')?._count._all || 0

    // Olay istatistiklerini hesapla
    const totalIncidents = incidentStats.reduce((sum, s) => sum + s._count._all, 0)
    const resolvedIncidents = incidentStats
      .filter(s => s.status === 'RESOLVED' || s.status === 'CLOSED')
      .reduce((sum, s) => sum + s._count._all, 0)
    const openIncidents = totalIncidents - resolvedIncidents

    return NextResponse.json({
      documents: {
        total: totalDocs,
        approved: approvedDocs,
        pendingApproval: pendingDocs,
        needsReview: reviewNeededDocs,
      },
      controls: {
        total: totalControls || 93, // Eğer henüz kontroller eklenmemişse 93 göster
        implemented: implementedControls,
        partiallyImplemented: partialControls,
        notImplemented: notImplementedControls,
        notApplicable: naControls,
        // Kategori bazlı
        byCategory: {
          organizational: { total: 37, implemented: getCategoryImplemented('ORGANIZATIONAL') },
          people: { total: 8, implemented: getCategoryImplemented('PEOPLE') },
          physical: { total: 14, implemented: getCategoryImplemented('PHYSICAL') },
          technological: { total: 34, implemented: getCategoryImplemented('TECHNOLOGICAL') },
        },
      },
      signatures: {
        pending: 0, // Bekleyen imza konsepti yok, tüm imzalar anlık atılıyor
        completed: totalSignatures,
      },
      audits: {
        planned: plannedAudits,
        inProgress: inProgressAudits,
        openFindings: openFindings,
      },
      risks: {
        total: totalRisks,
        high: highRisks,
        medium: mediumRisks,
        low: lowRisks,
      },
      trainings: {
        total: totalTrainings,
        completed: completedTrainings,
        digitalSignatures: digitalSignatures,
      },
      incidents: {
        total: totalIncidents,
        open: openIncidents,
        resolved: resolvedIncidents,
      },
      managementReview: {
        total: reviewStats._count._all,
        lastReviewDate: reviewStats._max.reviewDate?.toISOString() || null,
      },
    })
  } catch (error) {
    console.error("Stats hatasi:", error)
    return NextResponse.json(
      { error: "Istatistikler alinamadi" },
      { status: 500 }
    )
  }
}
