import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth/require-session"

// GET - Şikayetleri listele
export async function GET(request: NextRequest) {
  try {
    // PR-Y2.5-qdms: requireSession (userId JWT'de mevcut)
    const { userId, error } = await requireSession()
    if (error) return error

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")
    const category = searchParams.get("category")
    const status = searchParams.get("status")

    const where: any = {}

    if (search) {
      where.OR = [
        { complaintNumber: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
      ]
    }

    if (category) {
      where.category = category
    }

    if (status) {
      where.status = status
    }

    const complaints = await prisma.qdmsCustomerComplaint.findMany({
      where,
      include: {
        responsible: {
          select: { id: true, name: true },
        },
      },
      orderBy: { receivedAt: "desc" },
    })

    // Map to frontend expected format
    const result = complaints.map(c => ({
      ...c,
      assignedTo: c.responsible,
      receivedDate: c.receivedAt,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error("Şikayet listesi hatası:", error)
    return NextResponse.json({ message: "Sunucu hatası" }, { status: 500 })
  }
}

// POST - Yeni şikayet oluştur
export async function POST(request: NextRequest) {
  try {
    // PR-Y2.5-qdms: requireSession (userId JWT'de mevcut)
    const { userId, error } = await requireSession()
    if (error) return error

    const body = await request.json()
    const { title, category, priority, customerName, customerContact, customerEmail, description, productCode } = body

    // Validasyon
    if (!title || !category || !customerName) {
      return NextResponse.json(
        { message: "Başlık, kategori ve müşteri adı zorunludur" },
        { status: 400 }
      )
    }

    // Şikayet numarası oluştur
    const year = new Date().getFullYear()
    const count = await prisma.qdmsCustomerComplaint.count({
      where: {
        complaintNumber: { startsWith: `CMP-${year}` },
      },
    })
    const complaintNumber = `CMP-${year}-${String(count + 1).padStart(3, "0")}`

    const complaint = await prisma.qdmsCustomerComplaint.create({
      data: {
        complaintNumber,
        title,
        category,
        priority: priority || "MEDIUM",
        customerName,
        customerContact,
        customerEmail,
        description: description || "",
        productId: productCode || null,
        status: "OPEN",
        receivedAt: new Date(),
        receivedById: userId,
      },
      include: {
        responsible: {
          select: { id: true, name: true },
        },
      },
    })

    // Map to frontend expected format
    const result = {
      ...complaint,
      assignedTo: complaint.responsible,
      receivedDate: complaint.receivedAt,
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error("Şikayet oluşturma hatası:", error)
    return NextResponse.json({ message: "Sunucu hatası" }, { status: 500 })
  }
}
