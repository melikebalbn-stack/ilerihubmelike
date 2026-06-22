import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth/require-session"

// GET - Tedarikçileri listele
export async function GET(request: NextRequest) {
  try {
    // PR-Y2.5-qdms: requireSession (basit auth gate)
    const { error } = await requireSession()
    if (error) return error

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")
    const category = searchParams.get("category")
    const status = searchParams.get("status")

    const where: any = {}

    if (search) {
      where.OR = [
        { supplierCode: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { contactPerson: { contains: search, mode: "insensitive" } },
      ]
    }

    if (category) {
      where.category = category
    }

    if (status) {
      where.status = status
    }

    const suppliers = await prisma.qdmsSupplier.findMany({
      where,
      orderBy: [
        { status: "asc" },
        { name: "asc" },
      ],
    })

    return NextResponse.json(suppliers)
  } catch (error) {
    console.error("Tedarikçi listesi hatası:", error)
    return NextResponse.json({ message: "Sunucu hatası" }, { status: 500 })
  }
}

// POST - Yeni tedarikçi oluştur
export async function POST(request: NextRequest) {
  try {
    // PR-Y2.5-qdms: requireSession (basit auth gate)
    const { error } = await requireSession()
    if (error) return error

    const body = await request.json()
    const { name, category, contactPerson, email, phone, address } = body

    // Validasyon
    if (!name || !category) {
      return NextResponse.json(
        { message: "Tedarikçi adı ve kategori zorunludur" },
        { status: 400 }
      )
    }

    // Tedarikçi kodu oluştur
    const count = await prisma.qdmsSupplier.count()
    const supplierCode = `SUP-${String(count + 1).padStart(4, "0")}`

    const supplier = await prisma.qdmsSupplier.create({
      data: {
        supplierCode,
        name,
        category,
        contactPerson,
        email,
        phone,
        address,
        status: "PENDING",
      },
    })

    return NextResponse.json(supplier, { status: 201 })
  } catch (error) {
    console.error("Tedarikçi oluşturma hatası:", error)
    return NextResponse.json({ message: "Sunucu hatası" }, { status: 500 })
  }
}
