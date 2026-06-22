import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth/require-session"

// Aktif değerlendirme kriterleri listesi
export async function GET(request: NextRequest) {
  try {
    // PR-Y2.5-iso27001-B: requireSession
    const { error } = await requireSession()
    if (error) return error

    const { searchParams } = new URL(request.url)
    const evaluationType = searchParams.get("evaluationType")

    const where: any = { isActive: true }

    if (evaluationType) {
      where.evaluationType = evaluationType
    }

    const criteria = await prisma.supplierCriteria.findMany({
      where,
      orderBy: { sortOrder: "asc" },
    })

    return NextResponse.json({ criteria })
  } catch (error) {
    console.error("Kriter listesi hatası:", error)
    return NextResponse.json(
      { error: "Kriterler alınamadı" },
      { status: 500 }
    )
  }
}
