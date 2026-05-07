import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { requireSession } from "@/lib/auth/require-session"

// İzin verilen dosya tipleri
const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "image/gif",
  "text/plain",
]

// Maksimum dosya boyutu (20MB)
const MAX_FILE_SIZE = 20 * 1024 * 1024

// POST - Dosya yükle
export async function POST(request: NextRequest) {
  try {
    // PR-Y2.5-qdms: requireSession (basit auth gate)
    const { error } = await requireSession()
    if (error) return error

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const documentId = formData.get("documentId") as string | null

    if (!file) {
      return NextResponse.json({ message: "Dosya gerekli" }, { status: 400 })
    }

    if (!documentId) {
      return NextResponse.json({ message: "Doküman ID gerekli" }, { status: 400 })
    }

    // Dosya tipi kontrolü
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { message: "Desteklenmeyen dosya tipi. İzin verilen: PDF, Word, Excel, PowerPoint, resimler, metin" },
        { status: 400 }
      )
    }

    // Dosya boyutu kontrolü
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { message: "Dosya boyutu 10MB'ı aşamaz" },
        { status: 400 }
      )
    }

    // Dokümanı kontrol et
    const document = await prisma.qdmsDocument.findUnique({
      where: { id: documentId },
    })

    if (!document) {
      return NextResponse.json({ message: "Doküman bulunamadı" }, { status: 404 })
    }

    // Dosya adını oluştur
    const timestamp = Date.now()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
    const fileName = `${document.documentNumber}_v${document.version}_${timestamp}_${sanitizedName}`

    // Upload klasörünü oluştur
    const uploadDir = path.join(process.cwd(), "uploads", "qdms", "documents")
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Dosyayı kaydet
    const filePath = path.join(uploadDir, fileName)
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Dokümanı güncelle
    const updated = await prisma.qdmsDocument.update({
      where: { id: documentId },
      data: {
        fileName: file.name,
        fileUrl: `/api/qdms/documents/download/${documentId}`,
        fileSize: file.size,
        mimeType: file.type,
      },
    })

    return NextResponse.json({
      message: "Dosya başarıyla yüklendi",
      document: updated,
      file: {
        name: file.name,
        size: file.size,
        type: file.type,
      },
    })
  } catch (error) {
    console.error("Dosya yükleme hatası:", error)
    return NextResponse.json({ message: "Dosya yüklenirken hata oluştu" }, { status: 500 })
  }
}
