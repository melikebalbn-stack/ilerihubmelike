import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET - Dokümanları listele
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ message: "Yetkisiz erişim" }, { status: 401 })
    }

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
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ message: "Yetkisiz erişim" }, { status: 401 })
    }

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

    // Kullanıcıyı email ile bul (session.user.id LDAP DN olabilir)
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!dbUser) {
      return NextResponse.json(
        { message: "Kullanıcı bulunamadı. Lütfen tekrar giriş yapın." },
        { status: 401 }
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
        ownerId: dbUser.id,
        createdById: dbUser.id,
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
