import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { readFile, readdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"

// GET - Dosya indir/görüntüle
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ message: "Yetkisiz erişim" }, { status: 401 })
    }

    const { id } = await params

    // Dokümanı bul
    const document = await prisma.qdmsDocument.findUnique({
      where: { id },
    })

    if (!document) {
      return NextResponse.json({ message: "Doküman bulunamadı" }, { status: 404 })
    }

    if (!document.fileName) {
      return NextResponse.json({ message: "Bu dokümana ait dosya yok" }, { status: 404 })
    }

    // Dosyayı bul
    const uploadDir = path.join(process.cwd(), "uploads", "qdms", "documents")

    if (!existsSync(uploadDir)) {
      return NextResponse.json({ message: "Dosya bulunamadı" }, { status: 404 })
    }

    // Doküman numarası ile başlayan dosyayı bul
    const files = await readdir(uploadDir)
    const matchingFile = files.find(f => f.startsWith(document.documentNumber))

    if (!matchingFile) {
      return NextResponse.json({ message: "Dosya bulunamadı" }, { status: 404 })
    }

    const filePath = path.join(uploadDir, matchingFile)

    if (!existsSync(filePath)) {
      return NextResponse.json({ message: "Dosya bulunamadı" }, { status: 404 })
    }

    // Dosyayı oku
    const fileBuffer = await readFile(filePath)

    // Response headers
    const headers = new Headers()
    headers.set("Content-Type", document.mimeType || "application/octet-stream")
    headers.set("Content-Length", String(document.fileSize || fileBuffer.length))

    // inline: tarayıcıda aç, attachment: indir
    const disposition = request.nextUrl.searchParams.get("download") === "true"
      ? "attachment"
      : "inline"
    headers.set("Content-Disposition", `${disposition}; filename="${encodeURIComponent(document.fileName)}"`)

    return new NextResponse(fileBuffer, {
      status: 200,
      headers,
    })
  } catch (error) {
    console.error("Dosya indirme hatası:", error)
    return NextResponse.json({ message: "Dosya indirilirken hata oluştu" }, { status: 500 })
  }
}
