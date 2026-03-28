import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Risk'e ait tedavi planlarini listele
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
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const risk = await prisma.iso27001Risk.findUnique({
      where: { id },
      select: { id: true, status: true },
    })

    if (!risk) {
      return NextResponse.json({ error: "Risk bulunamadi" }, { status: 404 })
    }

    const { treatmentOption, description, responsibleName, responsibleEmail, targetDate, notes } = body

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
        responsibleEmail: responsibleEmail || null,
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
