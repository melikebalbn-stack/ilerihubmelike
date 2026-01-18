import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Risk seviyesi hesaplama
function calculateRiskLevel(likelihood: number, impact: number): string {
  const score = likelihood * impact
  if (score >= 20) return "CRITICAL"
  if (score >= 12) return "HIGH"
  if (score >= 6) return "MEDIUM"
  return "LOW"
}

// GET - Riskleri listele
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ message: "Yetkisiz erişim" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")
    const category = searchParams.get("category")
    const status = searchParams.get("status")
    const riskLevel = searchParams.get("riskLevel")

    const where: any = {}

    if (search) {
      where.OR = [
        { riskNumber: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ]
    }

    if (category) {
      where.category = category
    }

    if (status) {
      where.status = status
    }

    if (riskLevel) {
      where.riskLevel = riskLevel
    }

    const risks = await prisma.qdmsRisk.findMany({
      where,
      include: {
        responsible: {
          select: { id: true, name: true },
        },
        department: {
          select: { id: true, name: true },
        },
      },
      orderBy: [
        { riskLevel: "desc" },
        { updatedAt: "desc" },
      ],
    })

    // Map to frontend expected format
    const result = risks.map(risk => ({
      ...risk,
      owner: risk.responsible,
      probability: risk.likelihood,
      identifiedDate: risk.createdAt,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error("Risk listesi hatası:", error)
    return NextResponse.json({ message: "Sunucu hatası" }, { status: 500 })
  }
}

// POST - Yeni risk oluştur
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ message: "Yetkisiz erişim" }, { status: 401 })
    }

    const body = await request.json()
    const { title, description, category, probability, impact, departmentId } = body

    // Validasyon
    if (!title || !category) {
      return NextResponse.json(
        { message: "Başlık ve kategori zorunludur" },
        { status: 400 }
      )
    }

    // Risk numarası oluştur
    const year = new Date().getFullYear()
    const count = await prisma.qdmsRisk.count({
      where: {
        riskNumber: { startsWith: `RISK-${year}` },
      },
    })
    const riskNumber = `RISK-${year}-${String(count + 1).padStart(3, "0")}`

    // Risk seviyesini hesapla
    const likelihood = probability || 3
    const imp = impact || 3
    const riskScore = likelihood * imp
    const riskLevel = calculateRiskLevel(likelihood, imp)

    // Gözden geçirme tarihini hesapla (6 ay sonra)
    const reviewDate = new Date()
    reviewDate.setMonth(reviewDate.getMonth() + 6)

    const risk = await prisma.qdmsRisk.create({
      data: {
        riskNumber,
        title,
        description: description || "",
        category,
        likelihood,
        impact: imp,
        riskScore,
        riskLevel: riskLevel as any,
        status: "OPEN",
        reviewDate,
        createdById: session.user.id,
        responsibleId: session.user.id,
        departmentId: departmentId || null,
      },
      include: {
        responsible: {
          select: { id: true, name: true },
        },
        department: {
          select: { id: true, name: true },
        },
      },
    })

    // Map to frontend expected format
    const result = {
      ...risk,
      owner: risk.responsible,
      probability: risk.likelihood,
      identifiedDate: risk.createdAt,
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error("Risk oluşturma hatası:", error)
    return NextResponse.json({ message: "Sunucu hatası" }, { status: 500 })
  }
}
