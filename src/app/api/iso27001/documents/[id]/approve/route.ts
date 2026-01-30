import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Doküman onaylama
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

    const document = await prisma.iso27001Document.findUnique({
      where: { id },
    })

    if (!document) {
      return NextResponse.json({ error: "Dokuman bulunamadi" }, { status: 404 })
    }

    if (document.status !== "PENDING_APPROVAL" && document.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Bu dokuman onay bekleyen durumda degil" },
        { status: 400 }
      )
    }

    // Dokümanı onayla
    const updated = await prisma.iso27001Document.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedById: session.user.id || "",
        approvedByName: session.user.name || "",
        approvedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      document: updated,
      message: "Dokuman onaylandi",
    })
  } catch (error) {
    console.error("Dokuman onaylama hatasi:", error)
    return NextResponse.json(
      { error: "Dokuman onaylanamadi" },
      { status: 500 }
    )
  }
}
