import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth/require-session"
import { requireBgysSorumlu } from "@/lib/permissions/bgys"

// Tek tehdit detayi
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-iso27001-C: requireSession (read-only detay)
    const { error } = await requireSession()
    if (error) return error

    const { id } = await params

    const threat = await prisma.iso27001Threat.findUnique({
      where: { id },
      include: {
        risks: {
          select: {
            id: true,
            riskNumber: true,
            title: true,
            riskLevel: true,
            status: true,
          },
          orderBy: { riskScore: "desc" },
        },
      },
    })

    if (!threat) {
      return NextResponse.json({ error: "Tehdit bulunamadi" }, { status: 404 })
    }

    return NextResponse.json(threat)
  } catch (error) {
    console.error("Tehdit detay hatasi:", error)
    return NextResponse.json(
      { error: "Tehdit alinamadi" },
      { status: 500 }
    )
  }
}

// Tehdit guncelle
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-iso27001-C: requireBgysSorumlu (admin CRUD)
    const { error } = await requireBgysSorumlu()
    if (error) return error

    const { id } = await params
    const body = await request.json()

    const existing = await prisma.iso27001Threat.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Tehdit bulunamadi" }, { status: 404 })
    }

    const updateData: any = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.category !== undefined) updateData.category = body.category
    if (body.description !== undefined) updateData.description = body.description
    if (body.affectedAssetTypes !== undefined) updateData.affectedAssetTypes = body.affectedAssetTypes
    if (body.typicalLikelihood !== undefined) updateData.typicalLikelihood = body.typicalLikelihood
    if (body.typicalImpact !== undefined) updateData.typicalImpact = body.typicalImpact

    const threat = await prisma.iso27001Threat.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      threat,
      message: "Tehdit guncellendi",
    })
  } catch (error) {
    console.error("Tehdit guncelleme hatasi:", error)
    return NextResponse.json(
      { error: "Tehdit guncellenemedi" },
      { status: 500 }
    )
  }
}

// Tehdit sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-iso27001-C: requireBgysSorumlu (admin CRUD)
    const { error } = await requireBgysSorumlu()
    if (error) return error

    const { id } = await params

    const existing = await prisma.iso27001Threat.findUnique({
      where: { id },
      include: { _count: { select: { risks: true } } },
    })

    if (!existing) {
      return NextResponse.json({ error: "Tehdit bulunamadi" }, { status: 404 })
    }

    if (existing._count.risks > 0) {
      return NextResponse.json(
        { error: `Bu tehdit ${existing._count.risks} risk ile iliskili. Once risklerdeki baglantilari kaldirin.` },
        { status: 400 }
      )
    }

    await prisma.iso27001Threat.delete({ where: { id } })

    return NextResponse.json({
      success: true,
      message: `${existing.code} - ${existing.name} silindi`,
    })
  } catch (error) {
    console.error("Tehdit silme hatasi:", error)
    return NextResponse.json(
      { error: "Tehdit silinemedi" },
      { status: 500 }
    )
  }
}
