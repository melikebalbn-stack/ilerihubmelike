import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth/require-session"
import { requireUser } from "@/lib/auth/require-user"

function calculateRiskLevel(score: number) {
  if (score >= 51) return "CRITICAL"
  if (score >= 31) return "HIGH"
  if (score >= 13) return "MEDIUM"
  return "LOW"
}

// Risk listesi + istatistikler
export async function GET(request: NextRequest) {
  try {
    // PR-Y2.5-iso27001-A: requireSession — sade auth
    const { error } = await requireSession()
    if (error) return error

    const { searchParams } = new URL(request.url)
    const level = searchParams.get("level")
    const status = searchParams.get("status")
    const search = searchParams.get("search")
    const assetId = searchParams.get("assetId")
    const threatCategory = searchParams.get("threatCategory")
    const includeStats = searchParams.get("stats") !== "false"

    const where: any = {}

    if (level) where.riskLevel = level
    if (status) where.status = status
    if (assetId) where.assetId = assetId

    if (threatCategory) {
      where.threat = { category: threatCategory }
    }

    if (search) {
      where.OR = [
        { riskNumber: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
        { assetName: { contains: search, mode: "insensitive" } },
        { threatName: { contains: search, mode: "insensitive" } },
        { scenario: { contains: search, mode: "insensitive" } },
      ]
    }

    const [risks, stats] = await Promise.all([
      prisma.iso27001Risk.findMany({
        where,
        include: {
          asset: {
            select: {
              id: true,
              name: true,
              category: true,
              confidentiality: true,
              integrity: true,
              availability: true,
            },
          },
          threat: {
            select: {
              id: true,
              code: true,
              name: true,
              category: true,
            },
          },
          treatmentPlans: {
            select: {
              id: true,
              treatmentOption: true,
              status: true,
              responsibleName: true,
              targetDate: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: [{ riskScore: "desc" }, { createdAt: "desc" }],
      }),
      includeStats
        ? Promise.all([
            // Seviye dagilimi
            prisma.iso27001Risk.groupBy({
              by: ["riskLevel"],
              _count: { _all: true },
            }),
            // Durum dagilimi
            prisma.iso27001Risk.groupBy({
              by: ["status"],
              _count: { _all: true },
            }),
            // Tedavi turu dagilimi
            prisma.iso27001Risk.groupBy({
              by: ["treatmentOption"],
              where: { treatmentOption: { not: null } },
              _count: { _all: true },
            }),
            // Kabul edilen risk sayisi (skor <= 12)
            prisma.iso27001Risk.count({
              where: { riskScore: { lte: 12 } },
            }),
          ])
        : null,
    ])

    const response: any = { risks }

    if (stats) {
      const [levelStats, statusStats, treatmentStats, acceptedCount] = stats
      response.stats = {
        total: risks.length,
        byLevel: {
          CRITICAL: levelStats.find((s) => s.riskLevel === "CRITICAL")?._count._all || 0,
          HIGH: levelStats.find((s) => s.riskLevel === "HIGH")?._count._all || 0,
          MEDIUM: levelStats.find((s) => s.riskLevel === "MEDIUM")?._count._all || 0,
          LOW: levelStats.find((s) => s.riskLevel === "LOW")?._count._all || 0,
        },
        byStatus: {
          OPEN: statusStats.find((s) => s.status === "OPEN")?._count._all || 0,
          IN_TREATMENT: statusStats.find((s) => s.status === "IN_TREATMENT")?._count._all || 0,
          CLOSED: statusStats.find((s) => s.status === "CLOSED")?._count._all || 0,
          MONITORING: statusStats.find((s) => s.status === "MONITORING")?._count._all || 0,
        },
        byTreatment: {
          AVOID: treatmentStats.find((s) => s.treatmentOption === "AVOID")?._count._all || 0,
          MITIGATE: treatmentStats.find((s) => s.treatmentOption === "MITIGATE")?._count._all || 0,
          TRANSFER: treatmentStats.find((s) => s.treatmentOption === "TRANSFER")?._count._all || 0,
          ACCEPT: treatmentStats.find((s) => s.treatmentOption === "ACCEPT")?._count._all || 0,
        },
        acceptedCount,
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Risk listesi hatasi:", error)
    return NextResponse.json(
      { error: "Riskler alinamadi" },
      { status: 500 }
    )
  }
}

// Yeni risk olustur
export async function POST(request: NextRequest) {
  try {
    // PR-Y2.5-iso27001-A: requireUser — DB user (id, name, email) gerekli
    const { user, error } = await requireUser()
    if (error) return error

    const body = await request.json()
    const {
      title,
      description,
      assetId,
      assetName: bodyAssetName,
      assetValue: bodyAssetValue,
      threatId,
      threatName: bodyThreatName,
      scenario,
      vulnerability,
      likelihood,
      impact,
      existingControls,
      treatmentOption,
      treatmentSummary,
      relatedControls,
      ownerName,
    } = body
    // PR-Y2.5: input boundary normalization — ownerEmail body input lowercase
    const ownerEmail = typeof body.ownerEmail === 'string' && body.ownerEmail.trim() !== ''
      ? body.ownerEmail.toLowerCase()
      : null

    if (!title || !scenario) {
      return NextResponse.json(
        { error: "Baslik ve senaryo zorunludur" },
        { status: 400 }
      )
    }

    // Varlik bilgilerini al
    let assetName = bodyAssetName || "Belirtilmedi"
    let assetValue = bodyAssetValue || 1
    if (assetId) {
      const asset = await prisma.iso27001Asset.findUnique({
        where: { id: assetId },
        select: { name: true, confidentiality: true, integrity: true, availability: true },
      })
      if (asset) {
        assetName = asset.name
        assetValue = Math.min(3, Math.max(asset.confidentiality, asset.integrity, asset.availability))
      }
    }

    // Tehdit bilgilerini al
    let threatName = bodyThreatName || "Belirtilmedi"
    if (threatId) {
      const threat = await prisma.iso27001Threat.findUnique({
        where: { id: threatId },
        select: { name: true },
      })
      if (threat) threatName = threat.name
    }

    // Risk skoru hesapla
    const l = likelihood || 3
    const i = impact || 3
    const riskScore = assetValue * l * i
    const riskLevel = calculateRiskLevel(riskScore)

    // Risk numarasi olustur: R-XXX
    const lastRisk = await prisma.iso27001Risk.findFirst({
      orderBy: { riskNumber: "desc" },
      select: { riskNumber: true },
    })

    let nextNum = 1
    if (lastRisk) {
      const num = parseInt(lastRisk.riskNumber.replace("R-", ""))
      if (!isNaN(num)) nextNum = num + 1
    }
    const riskNumber = `R-${String(nextNum).padStart(3, "0")}`

    // PR-Y2.5: requireUser zaten DB user objesini verdi, ekstra findUnique gereksiz

    const risk = await prisma.iso27001Risk.create({
      data: {
        riskNumber,
        title,
        description: description || null,
        assetId: assetId || null,
        assetName,
        assetValue,
        threatId: threatId || null,
        threatName,
        scenario,
        vulnerability: vulnerability || null,
        existingControls: existingControls || null,
        likelihood: l,
        impact: i,
        riskScore,
        riskLevel,
        treatmentOption: treatmentOption || null,
        treatmentSummary: treatmentSummary || null,
        relatedControls: relatedControls || [],
        ownerId: user.id,
        ownerName: ownerName || user.name || user.email,
        ownerEmail: ownerEmail || user.email,
        status: riskScore <= 12 ? "MONITORING" : "OPEN",
      },
      include: {
        asset: { select: { id: true, name: true, category: true } },
        threat: { select: { id: true, code: true, name: true, category: true } },
      },
    })

    return NextResponse.json({
      success: true,
      risk,
      message: "Risk olusturuldu",
    })
  } catch (error) {
    console.error("Risk olusturma hatasi:", error)
    return NextResponse.json(
      { error: "Risk olusturulamadi" },
      { status: 500 }
    )
  }
}
