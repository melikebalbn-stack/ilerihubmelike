import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// ISO 27001 Uyumluluk Raporu - JSON formatında
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

    // Tüm verileri paralel çek
    const [
      // Kontrol istatistikleri
      totalControls,
      implementedControls,
      partialControls,
      notImplementedControls,
      naControls,
      // Kategori bazlı kontroller
      orgControls,
      orgImplemented,
      peopleControls,
      peopleImplemented,
      physicalControls,
      physicalImplemented,
      techControls,
      techImplemented,
      // Doküman istatistikleri
      totalDocs,
      approvedDocs,
      pendingDocs,
      // Denetim istatistikleri
      totalAudits,
      completedAudits,
      openFindings,
      // Risk istatistikleri
      totalRisks,
      criticalRisks,
      highRisks,
      mediumRisks,
      lowRisks,
      // İmza istatistikleri
      totalSignatures,
    ] = await Promise.all([
      // Kontroller
      prisma.iso27001Control.count(),
      prisma.iso27001Control.count({ where: { status: { in: ["IMPLEMENTED", "EFFECTIVE"] } } }),
      prisma.iso27001Control.count({ where: { status: "PARTIALLY" } }),
      prisma.iso27001Control.count({ where: { status: "NOT_IMPLEMENTED" } }),
      prisma.iso27001Control.count({ where: { status: "NOT_APPLICABLE" } }),
      // Organizasyonel
      prisma.iso27001Control.count({ where: { category: "ORGANIZATIONAL" } }),
      prisma.iso27001Control.count({ where: { category: "ORGANIZATIONAL", status: { in: ["IMPLEMENTED", "EFFECTIVE"] } } }),
      // İnsan
      prisma.iso27001Control.count({ where: { category: "PEOPLE" } }),
      prisma.iso27001Control.count({ where: { category: "PEOPLE", status: { in: ["IMPLEMENTED", "EFFECTIVE"] } } }),
      // Fiziksel
      prisma.iso27001Control.count({ where: { category: "PHYSICAL" } }),
      prisma.iso27001Control.count({ where: { category: "PHYSICAL", status: { in: ["IMPLEMENTED", "EFFECTIVE"] } } }),
      // Teknolojik
      prisma.iso27001Control.count({ where: { category: "TECHNOLOGICAL" } }),
      prisma.iso27001Control.count({ where: { category: "TECHNOLOGICAL", status: { in: ["IMPLEMENTED", "EFFECTIVE"] } } }),
      // Dokümanlar
      prisma.iso27001Document.count({ where: { isActive: true, isLatestVersion: true } }),
      prisma.iso27001Document.count({ where: { isActive: true, isLatestVersion: true, status: { in: ["APPROVED", "PUBLISHED"] } } }),
      prisma.iso27001Document.count({ where: { isActive: true, isLatestVersion: true, status: "PENDING_APPROVAL" } }),
      // Denetimler
      prisma.iso27001Audit.count(),
      prisma.iso27001Audit.count({ where: { status: "COMPLETED" } }),
      prisma.iso27001AuditFinding.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
      // Riskler
      prisma.iso27001Risk.count({ where: { status: { not: "CLOSED" } } }),
      prisma.iso27001Risk.count({ where: { riskLevel: "CRITICAL", status: { not: "CLOSED" } } }),
      prisma.iso27001Risk.count({ where: { riskLevel: "HIGH", status: { not: "CLOSED" } } }),
      prisma.iso27001Risk.count({ where: { riskLevel: "MEDIUM", status: { not: "CLOSED" } } }),
      prisma.iso27001Risk.count({ where: { riskLevel: "LOW", status: { not: "CLOSED" } } }),
      // İmzalar
      prisma.iso27001Signature.count(),
    ])

    // Uyumluluk yüzdesi hesapla
    const applicableControls = totalControls - naControls
    const compliancePercentage = applicableControls > 0
      ? Math.round((implementedControls / applicableControls) * 100)
      : 0

    // Rapor verisi
    const reportData = {
      generatedAt: new Date().toISOString(),
      generatedBy: session.user.name || session.user.email,
      summary: {
        compliancePercentage,
        totalControls,
        applicableControls,
        implementedControls,
        partialControls,
        notImplementedControls,
        notApplicableControls: naControls,
      },
      categories: [
        {
          name: "Organizasyonel Kontroller (A.5)",
          total: orgControls,
          implemented: orgImplemented,
          percentage: orgControls > 0 ? Math.round((orgImplemented / orgControls) * 100) : 0,
        },
        {
          name: "Insan Kontrolleri (A.6)",
          total: peopleControls,
          implemented: peopleImplemented,
          percentage: peopleControls > 0 ? Math.round((peopleImplemented / peopleControls) * 100) : 0,
        },
        {
          name: "Fiziksel Kontroller (A.7)",
          total: physicalControls,
          implemented: physicalImplemented,
          percentage: physicalControls > 0 ? Math.round((physicalImplemented / physicalControls) * 100) : 0,
        },
        {
          name: "Teknolojik Kontroller (A.8)",
          total: techControls,
          implemented: techImplemented,
          percentage: techControls > 0 ? Math.round((techImplemented / techControls) * 100) : 0,
        },
      ],
      documents: {
        total: totalDocs,
        approved: approvedDocs,
        pendingApproval: pendingDocs,
        signatures: totalSignatures,
      },
      audits: {
        total: totalAudits,
        completed: completedAudits,
        openFindings,
      },
      risks: {
        total: totalRisks,
        critical: criticalRisks,
        high: highRisks,
        medium: mediumRisks,
        low: lowRisks,
      },
    }

    // JSON olarak döndür (PDF için client-side jspdf veya başka bir çözüm kullanılabilir)
    return NextResponse.json(reportData)
  } catch (error) {
    console.error("Rapor olusturma hatasi:", error)
    return NextResponse.json(
      { error: "Rapor olusturulamadi" },
      { status: 500 }
    )
  }
}
