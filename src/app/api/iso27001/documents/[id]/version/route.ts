import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import crypto from "crypto"

// Yeni versiyon yükleme
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

    // Mevcut dokümanı bul
    const currentDoc = await prisma.iso27001Document.findUnique({
      where: { id },
    })

    if (!currentDoc) {
      return NextResponse.json({ error: "Dokuman bulunamadi" }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const changeDescription = formData.get("changeDescription") as string

    if (!file) {
      return NextResponse.json({ error: "Dosya zorunludur" }, { status: 400 })
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

    // Content hash hesapla
    const contentHash = crypto.createHash("sha256").update(buffer).digest("hex")

    // Yeni versiyon numarası hesapla
    const versionParts = currentDoc.version.split(".")
    const major = parseInt(versionParts[0]) || 1
    const minor = parseInt(versionParts[1]) || 0
    const newVersion = `${major}.${minor + 1}`

    // Eski dokümanı güncelle (artık en son değil)
    await prisma.iso27001Document.update({
      where: { id },
      data: {
        isLatestVersion: false,
      },
    })

    // Versiyon geçmişine kaydet
    await prisma.iso27001DocumentVersion.create({
      data: {
        documentId: id,
        version: currentDoc.version,
        fileName: currentDoc.fileName,
        fileUrl: currentDoc.fileUrl,
        fileSize: currentDoc.fileSize,
        contentHash: currentDoc.contentHash,
        changeDescription: changeDescription || "Yeni versiyon yuklendi",
        changedById: session.user.id || "",
        changedByName: session.user.name || "",
      },
    })

    // Yeni doküman oluştur
    const newDoc = await prisma.iso27001Document.create({
      data: {
        documentNumber: currentDoc.documentNumber,
        title: currentDoc.title,
        description: currentDoc.description,
        category: currentDoc.category,
        clause: currentDoc.clause,
        controlId: currentDoc.controlId,
        fileName: file.name,
        fileUrl: `/uploads/iso27001/documents/${uniqueFileName}`,
        fileType: fileExtension.replace(".", ""),
        fileSize: file.size,
        version: newVersion,
        isLatestVersion: true,
        previousVersionId: id,
        status: "DRAFT",
        ownerId: currentDoc.ownerId,
        ownerName: currentDoc.ownerName,
        ownerEmail: currentDoc.ownerEmail,
        contentHash,
        reviewFrequency: currentDoc.reviewFrequency,
        nextReviewDate: currentDoc.nextReviewDate,
      },
    })

    return NextResponse.json({
      success: true,
      document: newDoc,
      message: `Versiyon ${newVersion} basariyla yuklendi`,
    })
  } catch (error) {
    console.error("Versiyon yukleme hatasi:", error)
    return NextResponse.json(
      { error: "Versiyon yuklenemedi" },
      { status: 500 }
    )
  }
}

// Versiyon geçmişini getir
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

    const { id } = await params

    const versions = await prisma.iso27001DocumentVersion.findMany({
      where: { documentId: id },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(versions)
  } catch (error) {
    console.error("Versiyon listesi hatasi:", error)
    return NextResponse.json(
      { error: "Versiyonlar alinamadi" },
      { status: 500 }
    )
  }
}
