import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import crypto from "crypto"

// Doküman listesi
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")
    const status = searchParams.get("status")
    const search = searchParams.get("search")

    const where: any = {
      isActive: true,
      isLatestVersion: true,
    }

    if (category) {
      where.category = category
    }

    if (status) {
      where.status = status
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { documentNumber: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ]
    }

    const documents = await prisma.iso27001Document.findMany({
      where,
      orderBy: [
        { category: "asc" },
        { createdAt: "desc" },
      ],
      include: {
        signatures: {
          orderBy: { signedAt: "desc" },
          take: 5,
        },
        _count: {
          select: {
            signatures: true,
            versions: true,
          },
        },
      },
    })

    return NextResponse.json(documents)
  } catch (error) {
    console.error("Dokuman listesi hatasi:", error)
    return NextResponse.json(
      { error: "Dokumanlar alinamadi" },
      { status: 500 }
    )
  }
}

// Yeni doküman yükleme
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const title = formData.get("title") as string
    const description = formData.get("description") as string
    const category = formData.get("category") as string
    const clause = formData.get("clause") as string
    const controlId = formData.get("controlId") as string
    const reviewFrequency = formData.get("reviewFrequency") as string

    if (!file || !title || !category) {
      return NextResponse.json(
        { error: "Dosya, baslik ve kategori zorunludur" },
        { status: 400 }
      )
    }

    // Dosya türü kontrolü
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ]

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Sadece PDF, Word ve Excel dosyalari yuklenebilir" },
        { status: 400 }
      )
    }

    // Dosya boyutu kontrolü (max 50MB)
    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "Dosya boyutu 50MB'i asamaz" },
        { status: 400 }
      )
    }

    // Upload dizinini oluştur
    const uploadDir = path.join(process.cwd(), "uploads", "iso27001", "documents")
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Benzersiz dosya adı
    const fileExtension = path.extname(file.name)
    const uniqueFileName = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${fileExtension}`
    const filePath = path.join(uploadDir, uniqueFileName)

    // Dosyayı kaydet
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Content hash hesapla (bütünlük kontrolü için)
    const contentHash = crypto.createHash("sha256").update(buffer).digest("hex")

    // Doküman numarası oluştur
    const year = new Date().getFullYear()
    const lastDoc = await prisma.iso27001Document.findFirst({
      where: {
        documentNumber: {
          startsWith: `ISO-DOC-${year}`,
        },
      },
      orderBy: { documentNumber: "desc" },
    })

    let nextNumber = 1
    if (lastDoc) {
      const parts = lastDoc.documentNumber.split("-")
      nextNumber = parseInt(parts[3]) + 1
    }
    const documentNumber = `ISO-DOC-${year}-${String(nextNumber).padStart(4, "0")}`

    // Gözden geçirme tarihi hesapla
    const reviewDays = parseInt(reviewFrequency) || 365
    const nextReviewDate = new Date()
    nextReviewDate.setDate(nextReviewDate.getDate() + reviewDays)

    // Veritabanına kaydet
    const document = await prisma.iso27001Document.create({
      data: {
        documentNumber,
        title,
        description: description || null,
        category: category as any,
        clause: clause || null,
        controlId: controlId || null,
        fileName: file.name,
        fileUrl: `/uploads/iso27001/documents/${uniqueFileName}`,
        fileType: fileExtension.replace(".", ""),
        fileSize: file.size,
        version: "1.0",
        isLatestVersion: true,
        status: "DRAFT",
        ownerId: session.user.id || "",
        ownerName: session.user.name || "",
        ownerEmail: session.user.email,
        contentHash,
        reviewFrequency: reviewDays,
        nextReviewDate,
      },
    })

    return NextResponse.json({
      success: true,
      document,
      message: "Dokuman basariyla yuklendi",
    })
  } catch (error) {
    console.error("Dokuman yukleme hatasi:", error)
    return NextResponse.json(
      { error: "Dokuman yuklenemedi" },
      { status: 500 }
    )
  }
}
