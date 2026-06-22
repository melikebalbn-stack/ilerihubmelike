import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateSupplierEvaluationPDFBuffer, SupplierEvaluationForPDF } from "@/lib/pdf/supplier-evaluation-pdf"
import { requireSession } from "@/lib/auth/require-session"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-iso27001-B: requireSession (read-only PDF)
    const { error } = await requireSession()
    if (error) return error

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
