import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Değerlendirme listesi
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const supplierId = searchParams.get("supplierId")

    const where: any = {}
    if (supplierId) where.supplierId = supplierId

    const evaluations = await prisma.supplierEvaluation.findMany({
      where,
      include: {
        supplier: {
          select: { companyName: true },
        },
        criteria: {
          include: {
            criteria: true,
          },
        },
      },
      orderBy: { evaluationDate: "desc" },
    })

    return NextResponse.json({ evaluations })
  } catch (error) {
    console.error("Değerlendirme listesi hatası:", error)
    return NextResponse.json(
      { error: "Değerlendirmeler alınamadı" },
      { status: 500 }
    )
  }
}

// Yeni değerlendirme oluştur
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

    const body = await request.json()
    const {
      supplierId,
      evaluationDate,
      criteriaScores,
      period,
      evaluationType,
      generalNotes,
      improvements,
      evaluatorTitle,
    } = body

    if (!supplierId || !evaluationDate || !criteriaScores || criteriaScores.length === 0) {
      return NextResponse.json(
        { error: "Tedarikçi, tarih ve kriter puanları zorunludur" },
        { status: 400 }
      )
    }

    // Tedarikçi kontrolü
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    })

    if (!supplier) {
      return NextResponse.json({ error: "Tedarikçi bulunamadı" }, { status: 404 })
    }

    // Kullanıcı bilgileri
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true },
    })

    if (!user) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 })
    }

    // Değerlendirme numarası oluştur: DEG-YYYY-NNN
    const year = new Date().getFullYear()
    const count = await prisma.supplierEvaluation.count({
      where: {
        evaluationNo: {
          startsWith: `DEG-${year}`,
        },
      },
    })
    const evaluationNo = `DEG-${year}-${String(count + 1).padStart(3, "0")}`

    // Toplam puan hesapla
    const totalScore = criteriaScores.reduce(
      (sum: number, cs: { score: number }) => sum + cs.score,
      0
    )

    // Sonuç grubu belirle
    let resultGroup: "A_APPROVED" | "B_CANDIDATE" | "C_REJECTED"
    if (totalScore >= 70) {
      resultGroup = "A_APPROVED"
    } else if (totalScore >= 50) {
      resultGroup = "B_CANDIDATE"
    } else {
      resultGroup = "C_REJECTED"
    }

    const isApproved = totalScore >= 50

    // Değerlendirme oluştur
    const evaluation = await prisma.supplierEvaluation.create({
      data: {
        evaluationNo,
        supplierId,
        evaluationDate: new Date(evaluationDate),
        evaluationType: evaluationType || "SERVICE",
        period: period || null,
        totalScore,
        resultGroup,
        isApproved,
        evaluatorName: user.name || "",
        evaluatorTitle: evaluatorTitle || null,
        generalNotes: generalNotes || null,
        improvements: improvements || null,
        status: "COMPLETED",
        createdById: user.id,
        criteria: {
          create: criteriaScores.map((cs: { criteriaId: string; score: number; notes?: string }) => ({
            criteriaId: cs.criteriaId,
            score: cs.score,
            notes: cs.notes || null,
          })),
        },
      },
      include: {
        supplier: {
          select: { companyName: true },
        },
        criteria: {
          include: {
            criteria: true,
          },
        },
      },
    })

    // Tedarikçi son değerlendirme bilgilerini güncelle
    await prisma.supplier.update({
      where: { id: supplierId },
      data: {
        lastScore: totalScore,
        lastEvalDate: new Date(evaluationDate),
        group: resultGroup,
      },
    })

    return NextResponse.json({
      success: true,
      evaluation,
    })
  } catch (error) {
    console.error("Değerlendirme oluşturma hatası:", error)
    return NextResponse.json(
      { error: "Değerlendirme oluşturulamadı" },
      { status: 500 }
    )
  }
}
