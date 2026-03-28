import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Tek varlık detayı
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

    const asset = await prisma.iso27001Asset.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true, department: true } },
        custodian: { select: { id: true, name: true, email: true, department: true } },
        parentAsset: { select: { id: true, name: true, assetNumber: true } },
        childAssets: {
          select: { id: true, name: true, assetNumber: true, category: true, status: true },
        },
      },
    })

    if (!asset) {
      return NextResponse.json({ error: "Varlik bulunamadi" }, { status: 404 })
    }

    return NextResponse.json(asset)
  } catch (error) {
    console.error("Varlik detay hatasi:", error)
    return NextResponse.json(
      { error: "Varlik alinamadi" },
      { status: 500 }
    )
  }
}

// Varlık güncelle
export async function PUT(
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

    // Varlık değerini hesapla (CIA)
    const assetValue = (body.confidentiality || 1) + (body.integrity || 1) + (body.availability || 1)

    const asset = await prisma.iso27001Asset.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        category: body.category,
        type: body.type,
        location: body.location,
        department: body.department,
        ownerId: body.ownerId || null,
        custodianId: body.custodianId || null,
        confidentiality: body.confidentiality,
        integrity: body.integrity,
        availability: body.availability,
        assetValue,
        financialValue: body.financialValue,
        criticality: body.criticality,
        classification: body.classification,
        status: body.status,
        acquisitionDate: body.acquisitionDate ? new Date(body.acquisitionDate) : null,
        disposalDate: body.disposalDate ? new Date(body.disposalDate) : null,
        manufacturer: body.manufacturer,
        model: body.model,
        serialNumber: body.serialNumber,
        version: body.version,
        licenseType: body.licenseType,
        licenseExpiry: body.licenseExpiry ? new Date(body.licenseExpiry) : null,
        hostname: body.hostname,
        ipAddress: body.ipAddress,
        macAddress: body.macAddress,
        operatingSystem: body.operatingSystem,
        processor: body.processor,
        ram: body.ram,
        diskSize: body.diskSize,
        barcode: body.barcode,
        warrantyEndDate: body.warrantyEndDate ? new Date(body.warrantyEndDate) : null,
        assignedTo: body.assignedTo,
        assignedToEmail: body.assignedToEmail,
        parentAssetId: body.parentAssetId || null,
        notes: body.notes,
        lastReviewDate: body.lastReviewDate ? new Date(body.lastReviewDate) : undefined,
        nextReviewDate: body.nextReviewDate ? new Date(body.nextReviewDate) : undefined,
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        custodian: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json(asset)
  } catch (error) {
    console.error("Varlik guncelleme hatasi:", error)
    return NextResponse.json(
      { error: "Varlik guncellenemedi" },
      { status: 500 }
    )
  }
}

// Varlık sil
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

    // Alt varlıkları kontrol et
    const childCount = await prisma.iso27001Asset.count({
      where: { parentAssetId: id },
    })

    if (childCount > 0) {
      return NextResponse.json(
        { error: "Bu varligin alt varliklari var. Oncelikle alt varliklari silin veya tasiyin." },
        { status: 400 }
      )
    }

    await prisma.iso27001Asset.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Varlik silme hatasi:", error)
    return NextResponse.json(
      { error: "Varlik silinemedi" },
      { status: 500 }
    )
  }
}
