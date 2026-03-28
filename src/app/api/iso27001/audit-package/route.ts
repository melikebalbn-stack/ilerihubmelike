import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Denetçi Rapor Paketi - Tüm BGYS verilerini tek bir pakette indir
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

    // Tüm verileri topla
    const [
      documents,
      controls,
      risks,
      audits,
      trainings,
      trainingAssignments,
      managementReviews,
      incidents,
      evidencesWithFile,
      auditPrograms,
      assets,
      suppliers,
    ] = await Promise.all([
      // Dokümanlar
      prisma.iso27001Document.findMany({
        include: {
          versions: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          signatures: true,
        },
        orderBy: { documentNumber: "asc" },
      }),

      // Kontroller
      prisma.iso27001Control.findMany({
        include: {
          documents: {
            include: {
              document: { select: { id: true, title: true, documentNumber: true } },
            },
          },
          evidences: true,
        },
        orderBy: { controlId: "asc" },
      }),

      // Riskler
      prisma.iso27001Risk.findMany({
        orderBy: { riskNumber: "asc" },
      }),

      // Denetimler
      prisma.iso27001Audit.findMany({
        include: {
          findings: true,
          teamMembers: true,
        },
        orderBy: { plannedDate: "desc" },
      }),

      // Eğitimler
      prisma.iso27001Training.findMany({
        include: {
          participants: true,
        },
        orderBy: { trainingDate: "desc" },
      }),

      // Eğitim Atamaları (dijital)
      prisma.iso27001TrainingAssignment.findMany({
        include: {
          user: { select: { name: true, email: true, department: true } },
          training: { select: { title: true, trainingNumber: true } },
        },
        where: { status: "SIGNED" }, // Sadece imzalananlar
        orderBy: { signedAt: "desc" },
      }),

      // Yönetim Gözden Geçirmeleri
      prisma.iso27001ManagementReview.findMany({
        orderBy: { reviewDate: "desc" },
      }),

      // Güvenlik Olayları
      prisma.iso27001Incident.findMany({
        include: {
          reportedBy: { select: { name: true, email: true } },
          actions: true,
        },
        orderBy: { detectedAt: "desc" },
      }),

      // Kanıtlar (dosyası olan)
      prisma.iso27001Evidence.count({
        where: { fileUrl: { not: null } },
      }),

      // Denetim Programları
      prisma.iso27001AuditProgram.count(),

      // Varlıklar
      prisma.iso27001Asset.count(),

      // Tedarikçiler
      prisma.supplier.findMany({
        include: {
          evaluations: {
            orderBy: { evaluationDate: "desc" },
            take: 1,
          },
        },
        orderBy: { companyName: "asc" },
      }),
    ])

    // İstatistikler hesapla
    const applicableControls = controls.filter(c => c.applicability !== false)
    const implementedControls = applicableControls.filter(c => c.status === "IMPLEMENTED")

    const stats = {
      // Dokümanlar
      documents: {
        total: documents.length,
        approved: documents.filter(d => d.status === "APPROVED").length,
        pending: documents.filter(d => d.status === "PENDING_APPROVAL").length,
        signatures: documents.reduce((sum, d) => sum + d.signatures.length, 0),
      },

      // Kontroller
      controls: {
        total: controls.length,
        applicable: applicableControls.length,
        implemented: implementedControls.length,
        partial: applicableControls.filter(c => c.status === "PARTIALLY").length,
        notImplemented: applicableControls.filter(c => c.status === "NOT_IMPLEMENTED" || !c.status).length,
        complianceRate: applicableControls.length > 0
          ? Math.round((implementedControls.length / applicableControls.length) * 100)
          : 0,
      },

      // Riskler
      risks: {
        total: risks.length,
        critical: risks.filter(r => r.riskLevel === "CRITICAL").length,
        high: risks.filter(r => r.riskLevel === "HIGH").length,
        medium: risks.filter(r => r.riskLevel === "MEDIUM").length,
        low: risks.filter(r => r.riskLevel === "LOW").length,
        treated: risks.filter(r => r.status === "IN_TREATMENT" || r.status === "CLOSED").length,
      },

      // Denetimler
      audits: {
        total: audits.length,
        completed: audits.filter(a => a.status === "COMPLETED").length,
        totalFindings: audits.reduce((sum, a) => sum + a.findings.length, 0),
        openFindings: audits.reduce((sum, a) => sum + a.findings.filter(f => f.status !== "CLOSED").length, 0),
      },

      // Eğitimler
      trainings: {
        total: trainings.length,
        completed: trainings.filter(t => t.status === "COMPLETED").length,
        totalParticipants: trainings.reduce((sum, t) => sum + t.participants.length, 0),
        digitalSignatures: trainingAssignments.length,
      },

      // Yönetim Gözden Geçirme
      managementReviews: {
        total: managementReviews.length,
        lastReviewDate: managementReviews[0]?.reviewDate || null,
      },

      // Olaylar
      incidents: {
        total: incidents.length,
        open: incidents.filter(i => !["RESOLVED", "CLOSED"].includes(i.status)).length,
        resolved: incidents.filter(i => i.status === "RESOLVED" || i.status === "CLOSED").length,
        thisYear: incidents.filter(i => {
          const date = new Date(i.detectedAt)
          return date.getFullYear() === new Date().getFullYear()
        }).length,
      },
    }

    // Rapor paketi oluştur
    const auditPackage = {
      meta: {
        title: "ISO 27001:2022 Denetim Rapor Paketi",
        organization: "ILERI Group",
        generatedAt: new Date().toISOString(),
        generatedBy: session.user.name || session.user.email,
        standard: "ISO/IEC 27001:2022",
        scope: "Bilgi Guvenligi Yonetim Sistemi (BGYS)",
      },

      summary: {
        overallCompliance: stats.controls.complianceRate,
        stats,
      },

      // 1. Statement of Applicability (SoA)
      statementOfApplicability: {
        description: "ISO 27001:2022 Annex A kontrollerinin uygulanabilirlik beyani",
        totalControls: 93,
        applicable: stats.controls.applicable,
        notApplicable: 93 - stats.controls.applicable,
        controls: controls.map(c => ({
          controlId: c.controlId,
          title: c.title,
          applicable: c.applicability !== false,
          status: c.status || "NOT_IMPLEMENTED",
          justification: c.justification,
          implementationNotes: c.implementationNotes,
          documents: c.documents.map(d => d.document.documentNumber),
          evidences: c.evidences.length,
        })),
      },

      // 2. Doküman Listesi
      documents: {
        description: "BGYS zorunlu ve destekleyici dokumanlar",
        total: documents.length,
        items: documents.map(d => ({
          documentNumber: d.documentNumber,
          title: d.title,
          category: d.category,
          status: d.status,
          currentVersion: d.versions[0]?.version || "1.0",
          approvedAt: d.approvedAt,
          nextReviewDate: d.nextReviewDate,
          signatures: d.signatures.map(s => ({
            signedBy: s.signerName,
            signedAt: s.signedAt,
            department: s.signerDepartment,
          })),
        })),
      },

      // 3. Risk Değerlendirmesi
      riskAssessment: {
        description: "Bilgi guvenligi risk degerlendirmesi",
        methodology: "ISO 27005 tabanli risk degerlendirme",
        total: risks.length,
        items: risks.map(r => ({
          riskNumber: r.riskNumber,
          title: r.title,
          assetName: r.assetName,
          assetValue: r.assetValue,
          threatName: r.threatName,
          scenario: r.scenario,
          likelihood: r.likelihood,
          impact: r.impact,
          riskScore: r.riskScore,
          riskLevel: r.riskLevel,
          treatmentOption: r.treatmentOption,
          status: r.status,
          ownerId: r.ownerId,
        })),
      },

      // 4. İç Denetimler
      internalAudits: {
        description: "BGYS ic denetim kayitlari",
        total: audits.length,
        items: audits.map(a => ({
          auditNumber: a.auditNumber,
          title: a.title,
          scope: a.scope,
          plannedDate: a.plannedDate,
          endDate: a.endDate,
          status: a.status,
          leadAuditor: a.leadAuditorName,
          findings: a.findings.map(f => ({
            findingNumber: f.findingNumber,
            type: f.findingType,
            description: f.description,
            status: f.status,
            dueDate: f.dueDate,
          })),
        })),
      },

      // 5. Eğitim Kayıtları
      trainingRecords: {
        description: "BGYS farkindalik egitim kayitlari",
        total: trainings.length,
        faceToFace: {
          count: trainings.filter(t => !t.isOnline).length,
          items: trainings.filter(t => !t.isOnline).map(t => ({
            trainingNumber: t.trainingNumber,
            title: t.title,
            date: t.trainingDate,
            trainer: t.trainerName,
            participants: t.participants.length,
            attendees: t.participants.filter(p => p.attended).length,
          })),
        },
        online: {
          count: trainings.filter(t => t.isOnline).length,
          digitalSignatures: trainingAssignments.length,
          items: trainingAssignments.map(a => ({
            training: a.training.title,
            trainingNumber: a.training.trainingNumber,
            user: a.user.name,
            department: a.user.department,
            completedAt: a.completedAt,
            signedAt: a.signedAt,
            signatureHash: a.signatureHash ? a.signatureHash.substring(0, 16) + "..." : null,
          })),
        },
      },

      // 6. Yönetim Gözden Geçirme
      managementReview: {
        description: "Yonetim gozden gecirme toplanti kayitlari",
        total: managementReviews.length,
        items: managementReviews.map(m => ({
          reviewNumber: m.reviewNumber,
          title: m.title,
          reviewDate: m.reviewDate,
          participants: m.participants,
          chairperson: m.chairperson,
          decisions: m.decisions,
        })),
      },

      // 7. Güvenlik Olayları
      securityIncidents: {
        description: "Bilgi guvenligi olay kayitlari",
        total: incidents.length,
        open: stats.incidents.open,
        items: incidents.map(i => ({
          incidentNumber: i.incidentNumber,
          title: i.title,
          category: i.category,
          severity: i.severity,
          status: i.status,
          detectedAt: i.detectedAt,
          detectionMethod: (i as any).detectionMethod,
          reportedBy: i.reportedBy?.name || (i as any).reportedByName || "-",
          correctiveAction: (i as any).correctiveAction,
          relatedRiskIds: (i as any).relatedRiskIds,
          resolvedAt: i.resolvedAt,
          lessonsLearned: i.lessonsLearned,
        })),
      },

      // 8. Tedarikçi Değerlendirme
      supplierEvaluations: {
        description: "Tedarikci degerlendirme kayitlari (A.5.19-22)",
        total: suppliers.length,
        aGroup: suppliers.filter(s => s.group === "A_APPROVED").length,
        bGroup: suppliers.filter(s => s.group === "B_CANDIDATE").length,
        cGroup: suppliers.filter(s => s.group === "C_REJECTED").length,
        items: suppliers.map(s => ({
          companyName: s.companyName,
          serviceType: s.serviceType,
          group: s.group,
          status: s.status,
          lastScore: s.lastScore,
          lastEvalDate: s.lastEvalDate,
          hasNDA: s.hasNDA,
          hasDataAccess: s.hasDataAccess,
          bgRiskLevel: s.bgRiskLevel,
        })),
      },

      // 9. Uyumluluk Kontrol Listesi
      complianceChecklist: {
        description: "ISO 27001:2022 temel gereksinimler kontrol listesi",
        items: [
          { requirement: "4.1 Organizasyon baglaminin anlasilmasi", status: documents.some(d => d.category === "POLICY") ? "EVET" : "HAYIR" },
          { requirement: "4.2 Ilgili taraflarin beklentileri", status: "EVET" },
          { requirement: "4.3 BGYS kapsami", status: documents.some(d => d.title?.includes("Kapsam")) ? "EVET" : "KONTROL ET" },
          { requirement: "5.1 Liderlik ve taahhut", status: "EVET" },
          { requirement: "5.2 Bilgi guvenligi politikasi", status: documents.some(d => d.category === "POLICY") ? "EVET" : "HAYIR" },
          { requirement: "5.3 Roller ve sorumluluklar", status: "EVET" },
          { requirement: "6.1 Risk degerlendirmesi", status: risks.length > 0 ? "EVET" : "HAYIR" },
          { requirement: "6.2 Bilgi guvenligi hedefleri", status: "KONTROL ET" },
          { requirement: "7.2 Yetkinlik", status: trainings.length > 0 ? "EVET" : "HAYIR" },
          { requirement: "7.3 Farkindalik", status: trainingAssignments.length > 0 ? "EVET" : "KONTROL ET" },
          { requirement: "7.5 Dokumante bilgi", status: documents.length > 0 ? "EVET" : "HAYIR" },
          { requirement: "8.1 Operasyonel planlama ve kontrol", status: "KONTROL ET" },
          { requirement: "8.2 Risk degerlendirmesi", status: risks.length > 0 ? "EVET" : "HAYIR" },
          { requirement: "8.3 Risk isleme", status: risks.filter(r => r.status === "IN_TREATMENT" || r.status === "CLOSED").length > 0 ? "EVET" : "KONTROL ET" },
          { requirement: "9.1 Izleme ve olcme", status: "KONTROL ET" },
          { requirement: "9.2 Ic denetim", status: audits.length > 0 ? "EVET" : "HAYIR" },
          { requirement: "9.3 Yonetim gozden gecirme", status: managementReviews.length > 0 ? "EVET" : "HAYIR" },
          { requirement: "10.1 Uygunsuzluk ve duzeltici faaliyet", status: audits.some(a => a.findings.length > 0) ? "EVET" : "KONTROL ET" },
          { requirement: "10.2 Surekli iyilestirme", status: "KONTROL ET" },
        ],
      },

      // Paket dosya istatistikleri (ZIP için)
      packageFileStats: {
        policies: documents.filter(d =>
          ["POLICY", "PROCEDURE", "MANDATORY", "GUIDELINE", "FORM"].includes(d.category) && d.fileUrl
        ).length,
        soa: 1,
        risks: 1,
        audits: (auditPrograms > 0 ? 1 : 0) + (audits.length > 0 ? 1 : 0) + (audits.some(a => a.findings.length > 0) ? 1 : 0),
        incidents: 1,
        trainings: 1,
        managementReviews: 1,
        assets: 1,
        evidences: evidencesWithFile,
      },
    }

    return NextResponse.json(auditPackage)
  } catch (error) {
    console.error("Denetim paketi hatasi:", error)
    return NextResponse.json(
      { error: "Denetim paketi olusturulamadi" },
      { status: 500 }
    )
  }
}
