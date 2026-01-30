import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Risk listesi
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const level = searchParams.get("level")
    const status = searchParams.get("status")
    const search = searchParams.get("search")

    const where: any = {}

    if (level) {
      where.riskLevel = level
    }

    if (status) {
      where.status = status
    }

    if (search) {
      where.OR = [
        { riskNumber: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { assetName: { contains: search, mode: "insensitive" } },
      ]
    }

    const risks = await prisma.iso27001Risk.findMany({
      where,
      orderBy: [{ riskScore: "desc" }, { identifiedDate: "desc" }],
    })

    // Frontend icin donustur
    const formatted = risks.map(r => ({
      id: r.id,
      riskNumber: r.riskNumber,
      title: r.title,
      description: r.description,
      category: r.assetType || "Diger",
      assetName: r.assetName,
      threatSource: r.threat,
      vulnerability: r.vulnerability,
      likelihood: r.likelihood,
      impact: r.impact,
      riskScore: r.riskScore,
      riskLevel: r.riskLevel,
      currentControls: r.relatedControls?.join(", ") || null,
      treatmentPlan: r.treatmentPlan,
      treatmentType: r.treatmentOption,
      residualLikelihood: null,
      residualImpact: null,
      residualRiskScore: r.residualRisk,
      residualRiskLevel: null,
      riskOwnerName: r.ownerName,
      riskOwnerEmail: r.ownerEmail,
      status: r.status,
      reviewDate: r.reviewDate,
      createdAt: r.identifiedDate,
    }))

    return NextResponse.json(formatted)
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
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

    const body = await request.json()
    const {
      title,
      description,
      category,
      assetName,
      threatSource,
      vulnerability,
      likelihood,
      impact,
      riskScore,
      riskLevel,
      treatmentPlan,
      treatmentType,
      riskOwnerName,
      riskOwnerEmail,
    } = body

    if (!title || !description || !assetName) {
      return NextResponse.json(
        { error: "Baslik, aciklama ve varlik adi zorunludur" },
        { status: 400 }
      )
    }

    // Risk numarasi olustur: ISO-RSK-YYYY-XXXX
    const year = new Date().getFullYear()
    const lastRisk = await prisma.iso27001Risk.findFirst({
      where: {
        riskNumber: {
          startsWith: `ISO-RSK-${year}`,
        },
      },
      orderBy: { riskNumber: "desc" },
      select: { riskNumber: true },
    })

    let nextNum = 1
    if (lastRisk) {
      const lastNum = parseInt(lastRisk.riskNumber.split("-")[3])
      nextNum = lastNum + 1
    }
    const riskNumber = `ISO-RSK-${year}-${String(nextNum).padStart(4, "0")}`

    // Kullanici bilgilerini al
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, email: true },
    })

    const risk = await prisma.iso27001Risk.create({
      data: {
        riskNumber,
        title,
        description,
        assetName,
        assetType: category || null,
        threat: threatSource || "Belirtilmedi",
        vulnerability: vulnerability || "Belirtilmedi",
        likelihood: likelihood || 3,
        impact: impact || 3,
        riskScore: riskScore || 9,
        riskLevel: riskLevel || "MEDIUM",
        treatmentPlan: treatmentPlan || null,
        treatmentOption: treatmentType || null,
        ownerId: user?.id || "",
        ownerName: riskOwnerName || user?.name || "",
        ownerEmail: riskOwnerEmail || user?.email || "",
        status: "IDENTIFIED",
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
