import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Tehdit listesi
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")
    const search = searchParams.get("search")

    const where: any = {}

    if (category) {
      where.category = category
    }

    if (search) {
      where.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ]
    }

    const threats = await prisma.iso27001Threat.findMany({
      where,
      include: {
        _count: {
          select: { risks: true },
        },
      },
      orderBy: { code: "asc" },
    })

    return NextResponse.json(threats)
  } catch (error) {
    console.error("Tehdit listesi hatasi:", error)
    return NextResponse.json(
      { error: "Tehditler alinamadi" },
      { status: 500 }
    )
  }
}

// Yeni tehdit olustur
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

    const body = await request.json()
    const { name, category, description, affectedAssetTypes, typicalLikelihood, typicalImpact } = body

    if (!name || !category) {
      return NextResponse.json(
        { error: "Tehdit adi ve kategorisi zorunludur" },
        { status: 400 }
      )
    }

    // Otomatik kod olustur (T-XX)
    const lastThreat = await prisma.iso27001Threat.findFirst({
      orderBy: { code: "desc" },
      select: { code: true },
    })

    let nextNum = 1
    if (lastThreat) {
      const num = parseInt(lastThreat.code.replace("T-", ""))
      if (!isNaN(num)) nextNum = num + 1
    }
    const code = `T-${String(nextNum).padStart(2, "0")}`

    const threat = await prisma.iso27001Threat.create({
      data: {
        code,
        name,
        category,
        description: description || null,
        affectedAssetTypes: affectedAssetTypes || null,
        typicalLikelihood: typicalLikelihood || 3,
        typicalImpact: typicalImpact || 3,
      },
    })

    return NextResponse.json({
      success: true,
      threat,
      message: "Tehdit olusturuldu",
    })
  } catch (error) {
    console.error("Tehdit olusturma hatasi:", error)
    return NextResponse.json(
      { error: "Tehdit olusturulamadi" },
      { status: 500 }
    )
  }
}
