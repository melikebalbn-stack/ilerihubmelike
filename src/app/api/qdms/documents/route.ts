import { NextRequest, NextResponse } from "next/server"
import { qdmsAccessResult } from "@/lib/auth/qdms-access"
import { prisma } from "@/lib/prisma"

// GET - Dokümanları listele
export async function GET(request: NextRequest) {
  try {
    // QDMS-RBAC: qdmsAccessResult (kalite ekibi/admin VEYA qdms.view|manage)
    const { error } = await qdmsAccessResult('view')
    if (error) return error

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")
    const category = searchParams.get("category")
    const status = searchParams.get("status")
    const departmentId = searchParams.get("departmentId")

    const where: any = {}

    if (search) {
      where.OR = [
        { documentNumber: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ]
    }

    if (category) {
      where.category = category
    }

    if (status) {
      where.status = status
    }

    if (departmentId) {
      where.departmentId = departmentId
    }

    const documents = await prisma.qdmsDocument.findMany({
      where,
      include: {
        owner: {
          select: { id: true, name: true },
        },
        department: {
          select: { id: true, name: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    })

    // fileName, fileSize, mimeType bilgilerini de döndür
    const documentsWithFiles = documents.map(doc => ({
      ...doc,
      fileName: doc.fileName,
      fileUrl: doc.fileUrl,
      fileSize: doc.fileSize,
      mimeType: doc.mimeType,
    }))

    return NextResponse.json(documentsWithFiles)
  } catch (error) {
    console.error("Doküman listesi hatası:", error)
    return NextResponse.json({ message: "Sunucu hatası" }, { status: 500 })
  }
}

// POST - Yeni doküman oluştur
export async function POST(request: NextRequest) {
  try {
    // QDMS-RBAC: qdmsAccessResult (kalite ekibi/admin VEYA qdms.view|manage)
    const { userId, error } = await qdmsAccessResult('manage')
    if (error) return error

    const body = await request.json()
    const { documentNumber, title, description, category, departmentId, reviewPeriodMonths } = body

    // Validasyon
    if (!documentNumber || !title || !category) {
      return NextResponse.json(
        { message: "Doküman no, başlık ve kategori zorunludur" },
        { status: 400 }
      )
    }

    // Doküman no benzersiz mi kontrol et
    const existing = await prisma.qdmsDocument.findUnique({
      where: { documentNumber },
    })

    if (existing) {
      return NextResponse.json(
        { message: "Bu doküman numarası zaten kullanılıyor" },
        { status: 400 }
      )
    }

    // Gözden geçirme tarihini hesapla
    const reviewDate = new Date()
    reviewDate.setMonth(reviewDate.getMonth() + (reviewPeriodMonths || 12))

    // departmentId boş string ise null yap
    const validDepartmentId = departmentId && departmentId.trim() !== "" ? departmentId : null

    const document = await prisma.qdmsDocument.create({
      data: {
        documentNumber,
        title,
        description: description || null,
        category,
        departmentId: validDepartmentId,
        reviewPeriodMonths: reviewPeriodMonths || 12,
        reviewDate,
        ownerId: userId,
        createdById: userId,
        status: "DRAFT",
        version: "1.0",
        revisionNumber: 0,
      },
      include: {
        owner: {
          select: { id: true, name: true },
        },
        department: {
          select: { id: true, name: true },
        },
      },
    })

    return NextResponse.json(document, { status: 201 })
  } catch (error) {
    console.error("Doküman oluşturma hatası:", error)
    return NextResponse.json({ message: "Sunucu hatası" }, { status: 500 })
  }
}
