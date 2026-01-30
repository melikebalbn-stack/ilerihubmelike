import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Varlık listesi
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")
    const status = searchParams.get("status")
    const classification = searchParams.get("classification")

    const where: any = {}
    if (category) where.category = category
    if (status) where.status = status
    if (classification) where.classification = classification

    const assets = await prisma.iso27001Asset.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true, email: true, department: true } },
        custodian: { select: { id: true, name: true, email: true, department: true } },
        parentAsset: { select: { id: true, name: true, assetNumber: true } },
        _count: { select: { childAssets: true } },
      },
      orderBy: { assetNumber: "asc" },
    })

    // İstatistikler
    const stats = {
      total: assets.length,
      byCategory: {
        information: assets.filter(a => a.category === "INFORMATION").length,
        software: assets.filter(a => a.category === "SOFTWARE").length,
        hardware: assets.filter(a => a.category === "HARDWARE").length,
        network: assets.filter(a => a.category === "NETWORK").length,
        personnel: assets.filter(a => a.category === "PERSONNEL").length,
        physical: assets.filter(a => a.category === "PHYSICAL").length,
        service: assets.filter(a => a.category === "SERVICE").length,
      },
      byCriticality: {
        critical: assets.filter(a => a.criticality === "CRITICAL").length,
        high: assets.filter(a => a.criticality === "HIGH").length,
        medium: assets.filter(a => a.criticality === "MEDIUM").length,
        low: assets.filter(a => a.criticality === "LOW").length,
      },
      byStatus: {
        active: assets.filter(a => a.status === "ACTIVE").length,
        inactive: assets.filter(a => a.status === "INACTIVE").length,
        maintenance: assets.filter(a => a.status === "UNDER_MAINTENANCE").length,
        disposed: assets.filter(a => a.status === "DISPOSED").length,
      },
    }

    return NextResponse.json({ assets, stats })
  } catch (error) {
    console.error("Varlik listesi hatasi:", error)
    return NextResponse.json(
      { error: "Varliklar alinamadi" },
      { status: 500 }
    )
  }
}

// Yeni varlık oluştur
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

    const body = await request.json()

    // Sıradaki varlık numarasını al
    const lastAsset = await prisma.iso27001Asset.findFirst({
      orderBy: { assetNumber: "desc" },
    })

    let nextNumber = 1
    if (lastAsset?.assetNumber) {
      const match = lastAsset.assetNumber.match(/ASSET-(\d+)/)
      if (match) nextNumber = parseInt(match[1]) + 1
    }

    const assetNumber = `ASSET-${String(nextNumber).padStart(3, "0")}`

    // Varlık değerini hesapla (CIA)
    const assetValue = (body.confidentiality || 1) + (body.integrity || 1) + (body.availability || 1)

    // Kritiklik seviyesini CIA değerine göre otomatik belirle
    let criticality = body.criticality
    if (!criticality) {
      if (assetValue >= 12) criticality = "CRITICAL"
      else if (assetValue >= 9) criticality = "HIGH"
      else if (assetValue >= 6) criticality = "MEDIUM"
      else criticality = "LOW"
    }

    const asset = await prisma.iso27001Asset.create({
      data: {
        assetNumber,
        name: body.name,
        description: body.description,
        category: body.category,
        type: body.type,
        location: body.location,
        department: body.department,
        ownerId: body.ownerId || null,
        custodianId: body.custodianId || null,
        confidentiality: body.confidentiality || 1,
        integrity: body.integrity || 1,
        availability: body.availability || 1,
        assetValue,
        financialValue: body.financialValue,
        criticality,
        classification: body.classification || "INTERNAL",
        status: body.status || "ACTIVE",
        acquisitionDate: body.acquisitionDate ? new Date(body.acquisitionDate) : null,
        manufacturer: body.manufacturer,
        model: body.model,
        serialNumber: body.serialNumber,
        version: body.version,
        licenseType: body.licenseType,
        licenseExpiry: body.licenseExpiry ? new Date(body.licenseExpiry) : null,
        parentAssetId: body.parentAssetId || null,
        notes: body.notes,
        nextReviewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 yıl sonra
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        custodian: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json(asset, { status: 201 })
  } catch (error) {
    console.error("Varlik olusturma hatasi:", error)
    return NextResponse.json(
      { error: "Varlik olusturulamadi" },
      { status: 500 }
    )
  }
}
