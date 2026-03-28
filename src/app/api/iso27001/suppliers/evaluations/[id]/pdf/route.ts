import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateSupplierEvaluationPDFBuffer, SupplierEvaluationForPDF } from "@/lib/pdf/supplier-evaluation-pdf"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
    }

    const { id } = await params

    const evaluation = await prisma.supplierEvaluation.findUnique({
      where: { id },
      include: {
        supplier: {
          select: {
            companyName: true,
            serviceType: true,
          },
        },
        criteria: {
          include: {
            criteria: true,
          },
          orderBy: {
            criteria: {
              sortOrder: "asc",
            },
          },
        },
      },
    })

    if (!evaluation) {
      return NextResponse.json({ error: "Değerlendirme bulunamadı" }, { status: 404 })
    }

    // Evaluation verisini PDF formatına dönüştür
    const evaluationForPDF: SupplierEvaluationForPDF = {
      evaluationNo: evaluation.evaluationNo,
      companyName: evaluation.supplier.companyName,
      serviceType: evaluation.supplier.serviceType,
      evaluationDate: evaluation.evaluationDate.toISOString(),
      period: evaluation.period || undefined,
      criteriaScores: evaluation.criteria.map((cs) => ({
        code: cs.criteria.code,
        name: cs.criteria.name,
        description: cs.criteria.description || undefined,
        maxScore: cs.criteria.maxScore,
        score: cs.score,
        notes: cs.notes || undefined,
      })),
      totalScore: evaluation.totalScore,
      resultGroup: evaluation.resultGroup,
      isApproved: evaluation.isApproved,
      evaluatorName: evaluation.evaluatorName,
      evaluatorTitle: evaluation.evaluatorTitle || undefined,
      generalNotes: evaluation.generalNotes || undefined,
      improvements: evaluation.improvements || undefined,
    }

    // PDF oluştur
    const pdfBuffer = await generateSupplierEvaluationPDFBuffer(evaluationForPDF)

    // Dosya adını oluştur
    const fileName = `Tedarikci_Degerlendirme_${evaluation.evaluationNo.replace(/[/\\?%*:|"<>]/g, "-")}.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error("Tedarikçi değerlendirme PDF oluşturulurken hata:", error)
    return NextResponse.json({ error: "PDF oluşturulamadı" }, { status: 500 })
  }
}
