import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth/require-session"

// Tedavi plani guncelle
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; treatmentId: string }> }
) {
  try {
    // PR-Y2.5-iso27001-A: requireSession
    const { error } = await requireSession()
    if (error) return error

    const { id, treatmentId } = await params
    const body = await request.json()

    const existing = await prisma.iso27001RiskTreatmentPlan.findFirst({
      where: { id: treatmentId, riskId: id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Tedavi plani bulunamadi" }, { status: 404 })
    }

    const updateData: any = {}
    if (body.treatmentOption !== undefined) updateData.treatmentOption = body.treatmentOption
    if (body.description !== undefined) updateData.description = body.description
    if (body.responsibleName !== undefined) updateData.responsibleName = body.responsibleName
    // PR-Y2.5: input boundary normalization — DB email lowercase invariant
    if (body.responsibleEmail !== undefined) {
      updateData.responsibleEmail = typeof body.responsibleEmail === 'string' && body.responsibleEmail.trim() !== ''
        ? body.responsibleEmail.toLowerCase()
        : null
    }
    if (body.targetDate !== undefined) updateData.targetDate = body.targetDate ? new Date(body.targetDate) : null
    if (body.completionDate !== undefined) updateData.completionDate = body.completionDate ? new Date(body.completionDate) : null
    if (body.status !== undefined) updateData.status = body.status
    if (body.notes !== undefined) updateData.notes = body.notes

    const plan = await prisma.iso27001RiskTreatmentPlan.update({
      where: { id: treatmentId },
      data: updateData,
    })

    // Tamamlanan plan varsa risk durumunu guncelle
    if (body.status === "COMPLETED") {
      const remainingPlans = await prisma.iso27001RiskTreatmentPlan.count({
        where: {
          riskId: id,
          status: { notIn: ["COMPLETED", "CANCELLED"] },
        },
      })

      if (remainingPlans === 0) {
        await prisma.iso27001Risk.update({
          where: { id },
          data: { status: "MONITORING" },
        })
      }
    }

    return NextResponse.json({
      success: true,
      plan,
      message: "Tedavi plani guncellendi",
    })
  } catch (error) {
    console.error("Tedavi plani guncelleme hatasi:", error)
    return NextResponse.json(
      { error: "Tedavi plani guncellenemedi" },
      { status: 500 }
    )
  }
}

// Tedavi plani sil
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; treatmentId: string }> }
) {
  try {
    // PR-Y2.5-iso27001-A: requireSession
    const { error } = await requireSession()
    if (error) return error

    const { id, treatmentId } = await params

    const existing = await prisma.iso27001RiskTreatmentPlan.findFirst({
      where: { id: treatmentId, riskId: id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Tedavi plani bulunamadi" }, { status: 404 })
    }

    await prisma.iso27001RiskTreatmentPlan.delete({ where: { id: treatmentId } })

    return NextResponse.json({
      success: true,
      message: "Tedavi plani silindi",
    })
  } catch (error) {
    console.error("Tedavi plani silme hatasi:", error)
    return NextResponse.json(
      { error: "Tedavi plani silinemedi" },
      { status: 500 }
    )
  }
}
