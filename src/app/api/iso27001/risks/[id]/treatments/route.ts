import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth/require-session"

// Risk'e ait tedavi planlarini listele
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-iso27001-A: requireSession
    const { error } = await requireSession()
    if (error) return error

    const { id } = await params

    const risk = await prisma.iso27001Risk.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!risk) {
      return NextResponse.json({ error: "Risk bulunamadi" }, { status: 404 })
    }

    const plans = await prisma.iso27001RiskTreatmentPlan.findMany({
      where: { riskId: id },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(plans)
  } catch (error) {
    console.error("Tedavi planlari hatasi:", error)
    return NextResponse.json(
      { error: "Tedavi planlari alinamadi" },
      { status: 500 }
    )
  }
}

// Yeni tedavi plani olustur
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-iso27001-A: requireSession
    const { error } = await requireSession()
    if (error) return error

    const { id } = await params
    const body = await request.json()

    const risk = await prisma.iso27001Risk.findUnique({
      where: { id },
      select: { id: true, status: true },
    })

    if (!risk) {
      return NextResponse.json({ error: "Risk bulunamadi" }, { status: 404 })
    }

    const { treatmentOption, description, responsibleName, targetDate, notes } = body
    // PR-Y2.5: input boundary normalization
    const responsibleEmail = typeof body.responsibleEmail === 'string' && body.responsibleEmail.trim() !== ''
      ? body.responsibleEmail.toLowerCase()
      : null

    if (!treatmentOption || !description || !responsibleName) {
      return NextResponse.json(
        { error: "Islem turu, aciklama ve sorumlu kisi zorunludur" },
        { status: 400 }
      )
    }

    const plan = await prisma.iso27001RiskTreatmentPlan.create({
      data: {
        riskId: id,
        treatmentOption,
        description,
        responsibleName,
        responsibleEmail,
        targetDate: targetDate ? new Date(targetDate) : null,
        notes: notes || null,
      },
    })

    // Risk durumunu IN_TREATMENT yap
    if (risk.status === "OPEN") {
      await prisma.iso27001Risk.update({
        where: { id },
        data: { status: "IN_TREATMENT" },
      })
    }

    return NextResponse.json({
      success: true,
      plan,
      message: "Tedavi plani olusturuldu",
    })
  } catch (error) {
    console.error("Tedavi plani olusturma hatasi:", error)
    return NextResponse.json(
      { error: "Tedavi plani olusturulamadi" },
      { status: 500 }
    )
  }
}
