import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

function calculateRiskLevel(score: number) {
  if (score >= 51) return "CRITICAL"
  if (score >= 31) return "HIGH"
  if (score >= 13) return "MEDIUM"
  return "LOW"
}

// Tek risk detayi
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

    const { id } = await params

    const risk = await prisma.iso27001Risk.findUnique({
      where: { id },
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
            description: true,
          },
        },
        treatmentPlans: {
          orderBy: { createdAt: "desc" },
        },
      },
    })

    if (!risk) {
      return NextResponse.json({ error: "Risk bulunamadi" }, { status: 404 })
    }

    return NextResponse.json(risk)
  } catch (error) {
    console.error("Risk detay hatasi:", error)
    return NextResponse.json(
      { error: "Risk alinamadi" },
      { status: 500 }
    )
  }
}

// Risk guncelle
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const existing = await prisma.iso27001Risk.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Risk bulunamadi" }, { status: 404 })
    }

    const updateData: any = {}

    // Temel alanlar
    if (body.title !== undefined) updateData.title = body.title
    if (body.description !== undefined) updateData.description = body.description
    if (body.scenario !== undefined) updateData.scenario = body.scenario
    if (body.vulnerability !== undefined) updateData.vulnerability = body.vulnerability
    if (body.existingControls !== undefined) updateData.existingControls = body.existingControls
    if (body.treatmentOption !== undefined) updateData.treatmentOption = body.treatmentOption
    if (body.treatmentSummary !== undefined) updateData.treatmentSummary = body.treatmentSummary
    if (body.relatedControls !== undefined) updateData.relatedControls = body.relatedControls
    if (body.ownerName !== undefined) updateData.ownerName = body.ownerName
    if (body.ownerEmail !== undefined) updateData.ownerEmail = body.ownerEmail
    if (body.status !== undefined) updateData.status = body.status
    if (body.reviewDate !== undefined) updateData.reviewDate = body.reviewDate ? new Date(body.reviewDate) : null
    if (body.nextReviewDate !== undefined) updateData.nextReviewDate = body.nextReviewDate ? new Date(body.nextReviewDate) : null

    // Varlik degisikligi
    if (body.assetId !== undefined) {
      updateData.assetId = body.assetId || null
      if (body.assetId) {
        const asset = await prisma.iso27001Asset.findUnique({
          where: { id: body.assetId },
          select: { name: true, confidentiality: true, integrity: true, availability: true },
        })
        if (asset) {
          updateData.assetName = asset.name
          updateData.assetValue = Math.min(3, Math.max(asset.confidentiality, asset.integrity, asset.availability))
        }
      } else {
        updateData.assetName = body.assetName || existing.assetName
        updateData.assetValue = body.assetValue || existing.assetValue
      }
    }
    if (body.assetValue !== undefined && body.assetId === undefined) {
      updateData.assetValue = body.assetValue
    }

    // Tehdit degisikligi
    if (body.threatId !== undefined) {
      updateData.threatId = body.threatId || null
      if (body.threatId) {
        const threat = await prisma.iso27001Threat.findUnique({
          where: { id: body.threatId },
          select: { name: true },
        })
        if (threat) updateData.threatName = threat.name
      } else {
        updateData.threatName = body.threatName || existing.threatName
      }
    }

    // Risk skoru yeniden hesapla
    const assetValue = updateData.assetValue ?? existing.assetValue
    const likelihood = body.likelihood ?? existing.likelihood
    const impact = body.impact ?? existing.impact

    if (body.likelihood !== undefined) updateData.likelihood = likelihood
    if (body.impact !== undefined) updateData.impact = impact

    // Herhangi bir degisiklik varsa skor yeniden hesapla
    if (body.assetValue !== undefined || body.assetId !== undefined ||
        body.likelihood !== undefined || body.impact !== undefined) {
      updateData.riskScore = assetValue * likelihood * impact
      updateData.riskLevel = calculateRiskLevel(updateData.riskScore)
    }

    // Artik risk
    if (body.residualLikelihood !== undefined || body.residualImpact !== undefined) {
      const rl = body.residualLikelihood ?? existing.residualLikelihood ?? likelihood
      const ri = body.residualImpact ?? existing.residualImpact ?? impact
      updateData.residualLikelihood = rl
      updateData.residualImpact = ri
      updateData.residualRiskScore = assetValue * rl * ri
      updateData.residualRiskLevel = calculateRiskLevel(updateData.residualRiskScore)
    }

    const risk = await prisma.iso27001Risk.update({
      where: { id },
      data: updateData,
      include: {
        asset: { select: { id: true, name: true, category: true } },
        threat: { select: { id: true, code: true, name: true, category: true } },
      },
    })

    return NextResponse.json({
      success: true,
      risk,
      message: "Risk guncellendi",
    })
  } catch (error) {
    console.error("Risk guncelleme hatasi:", error)
    return NextResponse.json(
      { error: "Risk guncellenemedi" },
      { status: 500 }
    )
  }
}

// Risk sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

    const { id } = await params

    const existing = await prisma.iso27001Risk.findUnique({
      where: { id },
      select: { id: true, riskNumber: true },
    })

    if (!existing) {
      return NextResponse.json({ error: "Risk bulunamadi" }, { status: 404 })
    }

    await prisma.iso27001Risk.delete({ where: { id } })

    return NextResponse.json({
      success: true,
      message: `${existing.riskNumber} numarali risk silindi`,
    })
  } catch (error) {
    console.error("Risk silme hatasi:", error)
    return NextResponse.json(
      { error: "Risk silinemedi" },
      { status: 500 }
    )
  }
}
