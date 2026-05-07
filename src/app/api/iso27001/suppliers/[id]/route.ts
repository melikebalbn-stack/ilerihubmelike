import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth/require-session"

// Tedarikçi detayı
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-iso27001-B: requireSession
    const { error } = await requireSession()
    if (error) return error

    const { id } = await params

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        evaluations: {
          include: {
            criteria: {
              include: {
                criteria: true,
              },
            },
          },
          orderBy: { evaluationDate: "desc" },
        },
      },
    })

    if (!supplier) {
      return NextResponse.json({ error: "Tedarikçi bulunamadı" }, { status: 404 })
    }

    return NextResponse.json(supplier)
  } catch (error) {
    console.error("Tedarikçi detay hatası:", error)
    return NextResponse.json(
      { error: "Tedarikçi alınamadı" },
      { status: 500 }
    )
  }
}

// Tedarikçi güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-iso27001-B: requireSession
    const { error } = await requireSession()
    if (error) return error

    const { id } = await params
    const body = await request.json()

    const existing = await prisma.supplier.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Tedarikçi bulunamadı" }, { status: 404 })
    }

    const updateData: any = {}

    if (body.companyName !== undefined) updateData.companyName = body.companyName
    if (body.contactPerson !== undefined) updateData.contactPerson = body.contactPerson
    if (body.phone !== undefined) updateData.phone = body.phone
    // PR-Y2.5: input boundary normalization — DB email lowercase invariant
    if (body.email !== undefined) {
      updateData.email = typeof body.email === 'string' && body.email.trim() !== ''
        ? body.email.toLowerCase()
        : null
    }
    if (body.address !== undefined) updateData.address = body.address
    if (body.taxNumber !== undefined) updateData.taxNumber = body.taxNumber
    if (body.serviceType !== undefined) updateData.serviceType = body.serviceType
    if (body.group !== undefined) updateData.group = body.group
    if (body.status !== undefined) updateData.status = body.status
    if (body.hasNDA !== undefined) updateData.hasNDA = body.hasNDA
    if (body.ndaDate !== undefined) updateData.ndaDate = body.ndaDate ? new Date(body.ndaDate) : null
    if (body.ndaExpiry !== undefined) updateData.ndaExpiry = body.ndaExpiry ? new Date(body.ndaExpiry) : null
    if (body.hasDataAccess !== undefined) updateData.hasDataAccess = body.hasDataAccess
    if (body.bgRiskLevel !== undefined) updateData.bgRiskLevel = body.bgRiskLevel
    if (body.notes !== undefined) updateData.notes = body.notes

    const supplier = await prisma.supplier.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      supplier,
    })
  } catch (error) {
    console.error("Tedarikçi güncelleme hatası:", error)
    return NextResponse.json(
      { error: "Tedarikçi güncellenemedi" },
      { status: 500 }
    )
  }
}

// Tedarikçi sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-iso27001-B: requireSession
    const { error } = await requireSession()
    if (error) return error

    const { id } = await params

    const existing = await prisma.supplier.findUnique({
      where: { id },
      select: { id: true, companyName: true },
    })

    if (!existing) {
      return NextResponse.json({ error: "Tedarikçi bulunamadı" }, { status: 404 })
    }

    await prisma.supplier.delete({ where: { id } })

    return NextResponse.json({
      success: true,
      message: `${existing.companyName} tedarikçisi silindi`,
    })
  } catch (error) {
    console.error("Tedarikçi silme hatası:", error)
    return NextResponse.json(
      { error: "Tedarikçi silinemedi" },
      { status: 500 }
    )
  }
}
