import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET - NCR'leri listele
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ message: "Yetkisiz erişim" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")
    const source = searchParams.get("source")
    const status = searchParams.get("status")

    const where: any = {}

    if (search) {
      where.OR = [
        { ncrNumber: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
        { productId: { contains: search, mode: "insensitive" } },
      ]
    }

    if (source) {
      where.category = source
    }

    if (status) {
      where.status = status
    }

    const ncrs = await prisma.qdmsNonConformance.findMany({
      where,
      include: {
        detectedBy: {
          select: { id: true, name: true },
        },
        department: {
          select: { id: true, name: true },
        },
      },
      orderBy: { detectedAt: "desc" },
    })

    // Map to frontend expected format
    const result = ncrs.map(ncr => ({
      ...ncr,
      reportedBy: ncr.detectedBy,
      detectedDate: ncr.detectedAt,
      source: ncr.category,
      severity: ncr.level,
      productCode: ncr.productId,
      lotNumber: ncr.batchNumber,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error("NCR listesi hatası:", error)
    return NextResponse.json({ message: "Sunucu hatası" }, { status: 500 })
  }
}

// POST - Yeni NCR oluştur
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ message: "Yetkisiz erişim" }, { status: 401 })
    }

    const body = await request.json()
    const { title, source, severity, description, quantity, productCode, lotNumber, departmentId } = body

    // Validasyon
    if (!title || !source) {
      return NextResponse.json(
        { message: "Başlık ve kaynak zorunludur" },
        { status: 400 }
      )
    }

    // NCR numarası oluştur
    const year = new Date().getFullYear()
    const count = await prisma.qdmsNonConformance.count({
      where: {
        ncrNumber: { startsWith: `NCR-${year}` },
      },
    })
    const ncrNumber = `NCR-${year}-${String(count + 1).padStart(3, "0")}`

    // Map severity to level enum
    const levelMap: Record<string, string> = {
      MINOR: "MINOR",
      MAJOR: "MAJOR",
      CRITICAL: "CRITICAL",
    }

    const ncr = await prisma.qdmsNonConformance.create({
      data: {
        ncrNumber,
        title,
        category: source,
        level: (levelMap[severity] || "MINOR") as any,
        description: description || "",
        quantity: quantity || 1,
        productId: productCode || null,
        batchNumber: lotNumber || null,
        status: "OPEN",
        detectedAt: new Date(),
        detectedById: session.user.id,
        departmentId: departmentId || null,
      },
      include: {
        detectedBy: {
          select: { id: true, name: true },
        },
        department: {
          select: { id: true, name: true },
        },
      },
    })

    // Map to frontend expected format
    const result = {
      ...ncr,
      reportedBy: ncr.detectedBy,
      detectedDate: ncr.detectedAt,
      source: ncr.category,
      severity: ncr.level,
      productCode: ncr.productId,
      lotNumber: ncr.batchNumber,
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error("NCR oluşturma hatası:", error)
    return NextResponse.json({ message: "Sunucu hatası" }, { status: 500 })
  }
}
