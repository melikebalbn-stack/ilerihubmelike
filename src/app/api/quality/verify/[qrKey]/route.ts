import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * Public verify endpoint — auth gerektirmez. QR taranınca veya verify URL açılınca
 * çağrılır. Sadece finalize edilmiş raporları döndürür. Minimum disclosure:
 * drawingNo + revision döndürülmez (PR-KALITE-5 kararı).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ qrKey: string }> },
) {
  const { qrKey } = await params

  if (!qrKey || qrKey.length < 16) {
    return NextResponse.json({ valid: false }, { status: 200 })
  }

  const report = await prisma.measurementReport.findUnique({
    where: { qrKey },
    select: {
      reportNo: true,
      partName: true,
      lotNo: true,
      result: true,
      finalizedAt: true,
    },
  })

  if (!report || !report.finalizedAt) {
    return NextResponse.json({ valid: false }, { status: 200 })
  }

  return NextResponse.json({
    valid: true,
    reportNo: report.reportNo,
    partName: report.partName,
    lotNo: report.lotNo,
    result: report.result,
    finalizedAt: report.finalizedAt.toISOString(),
  })
}
