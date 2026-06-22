import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import * as XLSX from "xlsx"
import { requireSession } from "@/lib/auth/require-session"

const riskLevelLabels: Record<string, string> = {
  CRITICAL: "Kritik",
  HIGH: "Yuksek",
  MEDIUM: "Orta",
  LOW: "Dusuk",
}

const treatmentLabels: Record<string, string> = {
  AVOID: "Kacinma",
  MITIGATE: "Azaltma",
  TRANSFER: "Transfer",
  ACCEPT: "Kabul",
}

const statusLabels: Record<string, string> = {
  OPEN: "Acik",
  IN_TREATMENT: "Isleniyor",
  CLOSED: "Kapali",
  MONITORING: "Izleniyor",
}

const treatmentStatusLabels: Record<string, string> = {
  PLANNED: "Planlandi",
  IN_PROGRESS: "Devam Ediyor",
  COMPLETED: "Tamamlandi",
  MONITORING: "Izleniyor",
  CANCELLED: "Iptal",
}

export async function GET() {
  try {
    // PR-Y2.5-iso27001-A: requireSession — read-only export
    const { error } = await requireSession()
    if (error) return error

    const risks = await prisma.iso27001Risk.findMany({
      include: {
        asset: {
          select: { name: true, category: true },
        },
        threat: {
          select: { code: true, name: true, category: true },
        },
        treatmentPlans: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { riskNumber: "asc" },
    })

    const wb = XLSX.utils.book_new()

    // Sayfa 1: Risk Registeri
    const riskData = risks.map((r) => ({
      "Risk No": r.riskNumber,
      "Baslik": r.title,
      "Varlik": r.assetName,
      "Varlik Kategorisi": r.asset?.category || "-",
      "Varlik Degeri (VD)": r.assetValue,
      "Tehdit Kodu": r.threat?.code || "-",
      "Tehdit": r.threatName,
      "Senaryo": r.scenario,
      "Zafiyet": r.vulnerability || "-",
      "Mevcut Kontroller": r.existingControls || "-",
      "Olasilik (O)": r.likelihood,
      "Etki (E)": r.impact,
      "Risk Skoru (VDxOxE)": r.riskScore,
      "Risk Seviyesi": riskLevelLabels[r.riskLevel] || r.riskLevel,
      "Islem Turu": r.treatmentOption ? treatmentLabels[r.treatmentOption] || r.treatmentOption : "-",
      "Islem Ozeti": r.treatmentSummary || "-",
      "Artik Olasilik": r.residualLikelihood ?? "-",
      "Artik Etki": r.residualImpact ?? "-",
      "Artik Skor": r.residualRiskScore ?? "-",
      "Artik Seviye": r.residualRiskLevel ? riskLevelLabels[r.residualRiskLevel] || r.residualRiskLevel : "-",
      "Ilgili Kontroller": r.relatedControls.join(", ") || "-",
      "Sorumlu": r.ownerName,
      "Durum": statusLabels[r.status] || r.status,
      "Tanimlama Tarihi": r.identifiedDate.toISOString().split("T")[0],
    }))

    const wsRisks = XLSX.utils.json_to_sheet(riskData)

    // Sutun genislikleri
    wsRisks["!cols"] = [
      { wch: 8 },  // Risk No
      { wch: 30 }, // Baslik
      { wch: 25 }, // Varlik
      { wch: 15 }, // Varlik Kategorisi
      { wch: 6 },  // VD
      { wch: 8 },  // Tehdit Kodu
      { wch: 25 }, // Tehdit
      { wch: 40 }, // Senaryo
      { wch: 25 }, // Zafiyet
      { wch: 30 }, // Mevcut Kontroller
      { wch: 6 },  // O
      { wch: 6 },  // E
      { wch: 8 },  // Skor
      { wch: 10 }, // Seviye
      { wch: 10 }, // Islem Turu
      { wch: 30 }, // Islem Ozeti
      { wch: 6 },  // Artik O
      { wch: 6 },  // Artik E
      { wch: 8 },  // Artik Skor
      { wch: 10 }, // Artik Seviye
      { wch: 20 }, // Ilgili Kontroller
      { wch: 20 }, // Sorumlu
      { wch: 10 }, // Durum
      { wch: 12 }, // Tarih
    ]

    XLSX.utils.book_append_sheet(wb, wsRisks, "Risk Registeri")

    // Sayfa 2: Tedavi Planlari
    const treatmentData: any[] = []
    for (const risk of risks) {
      for (const plan of risk.treatmentPlans) {
        treatmentData.push({
          "Risk No": risk.riskNumber,
          "Risk Basligi": risk.title,
          "Islem Turu": treatmentLabels[plan.treatmentOption] || plan.treatmentOption,
          "Aciklama": plan.description,
          "Sorumlu": plan.responsibleName,
          "Hedef Tarih": plan.targetDate ? plan.targetDate.toISOString().split("T")[0] : "-",
          "Tamamlanma Tarihi": plan.completionDate ? plan.completionDate.toISOString().split("T")[0] : "-",
          "Durum": treatmentStatusLabels[plan.status] || plan.status,
          "Notlar": plan.notes || "-",
        })
      }
    }

    const wsTreatments = XLSX.utils.json_to_sheet(treatmentData)
    wsTreatments["!cols"] = [
      { wch: 8 },  // Risk No
      { wch: 30 }, // Risk Basligi
      { wch: 10 }, // Islem Turu
      { wch: 40 }, // Aciklama
      { wch: 20 }, // Sorumlu
      { wch: 12 }, // Hedef Tarih
      { wch: 12 }, // Tamamlanma
      { wch: 12 }, // Durum
      { wch: 30 }, // Notlar
    ]

    XLSX.utils.book_append_sheet(wb, wsTreatments, "Tedavi Planlari")

    // Sayfa 3: Istatistikler
    const totalRisks = risks.length
    const levelCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
    const statusCounts = { OPEN: 0, IN_TREATMENT: 0, CLOSED: 0, MONITORING: 0 }
    const treatmentCounts = { AVOID: 0, MITIGATE: 0, TRANSFER: 0, ACCEPT: 0 }

    for (const r of risks) {
      levelCounts[r.riskLevel as keyof typeof levelCounts]++
      statusCounts[r.status as keyof typeof statusCounts]++
      if (r.treatmentOption) {
        treatmentCounts[r.treatmentOption as keyof typeof treatmentCounts]++
      }
    }

    const statsData = [
      { "Metrik": "Toplam Risk", "Deger": totalRisks },
      { "Metrik": "", "Deger": "" },
      { "Metrik": "--- Seviye Dagilimi ---", "Deger": "" },
      { "Metrik": "Kritik", "Deger": levelCounts.CRITICAL },
      { "Metrik": "Yuksek", "Deger": levelCounts.HIGH },
      { "Metrik": "Orta", "Deger": levelCounts.MEDIUM },
      { "Metrik": "Dusuk", "Deger": levelCounts.LOW },
      { "Metrik": "", "Deger": "" },
      { "Metrik": "--- Durum Dagilimi ---", "Deger": "" },
      { "Metrik": "Acik", "Deger": statusCounts.OPEN },
      { "Metrik": "Isleniyor", "Deger": statusCounts.IN_TREATMENT },
      { "Metrik": "Kapali", "Deger": statusCounts.CLOSED },
      { "Metrik": "Izleniyor", "Deger": statusCounts.MONITORING },
      { "Metrik": "", "Deger": "" },
      { "Metrik": "--- Islem Turu Dagilimi ---", "Deger": "" },
      { "Metrik": "Kacinma", "Deger": treatmentCounts.AVOID },
      { "Metrik": "Azaltma", "Deger": treatmentCounts.MITIGATE },
      { "Metrik": "Transfer", "Deger": treatmentCounts.TRANSFER },
      { "Metrik": "Kabul", "Deger": treatmentCounts.ACCEPT },
    ]

    const wsStats = XLSX.utils.json_to_sheet(statsData)
    wsStats["!cols"] = [{ wch: 25 }, { wch: 10 }]

    XLSX.utils.book_append_sheet(wb, wsStats, "Istatistikler")

    // Excel dosyasini olustur
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

    const today = new Date().toISOString().split("T")[0]
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="ISO27001_Risk_Registeri_${today}.xlsx"`,
      },
    })
  } catch (error) {
    console.error("Excel export hatasi:", error)
    return NextResponse.json(
      { error: "Excel dosyasi olusturulamadi" },
      { status: 500 }
    )
  }
}
