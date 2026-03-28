import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Aktif değerlendirme kriterleri listesi
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

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
