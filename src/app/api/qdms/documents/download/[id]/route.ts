import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { readdir } from "fs/promises"
import { createReadStream, existsSync, statSync } from "fs"
import path from "path"
import { Readable } from "stream"

// Node.js stream'i Web ReadableStream'e dönüştür
function nodeStreamToWebStream(nodeStream: Readable): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk) => {
        controller.enqueue(new Uint8Array(chunk))
      })
      nodeStream.on('end', () => {
        controller.close()
      })
      nodeStream.on('error', (err) => {
        controller.error(err)
      })
    },
    cancel() {
      nodeStream.destroy()
    },
  })
}

// Range header'ını parse et
function parseRange(rangeHeader: string, fileSize: number): { start: number; end: number } | null {
  const match = rangeHeader.match(/bytes=(\d*)-(\d*)/)
  if (!match) return null

  const start = match[1] ? parseInt(match[1], 10) : 0
  const end = match[2] ? parseInt(match[2], 10) : fileSize - 1

  if (start >= fileSize || end >= fileSize || start > end) {
    return null
  }

  return { start, end }
}

// GET - Dosya indir/görüntüle (streaming ile)
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

    // Dosya boyutunu al
    const stat = statSync(filePath)
    const fileSize = stat.size

    // inline: tarayıcıda aç, attachment: indir
    const disposition = request.nextUrl.searchParams.get("download") === "true"
      ? "attachment"
      : "inline"

    // RFC 5987 uyumlu dosya adı encoding (Türkçe karakterler için)
    const encodedFileName = encodeURIComponent(document.fileName).replace(/['()]/g, escape)

    // Range request kontrolü
    const rangeHeader = request.headers.get('range')

    if (rangeHeader) {
      const range = parseRange(rangeHeader, fileSize)

      if (!range) {
        return new NextResponse('Range Not Satisfiable', {
          status: 416,
          headers: { 'Content-Range': `bytes */${fileSize}` },
        })
      }

      const { start, end } = range
      const chunkSize = end - start + 1

      const nodeStream = createReadStream(filePath, { start, end })
      const webStream = nodeStreamToWebStream(nodeStream)

      return new NextResponse(webStream, {
        status: 206,
        headers: {
          'Content-Type': document.mimeType || 'application/octet-stream',
          'Content-Length': chunkSize.toString(),
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Disposition': `${disposition}; filename*=UTF-8''${encodedFileName}`,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    }

    // Normal streaming response
    const nodeStream = createReadStream(filePath)
    const webStream = nodeStreamToWebStream(nodeStream)

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'Content-Type': document.mimeType || 'application/octet-stream',
        'Content-Length': fileSize.toString(),
        'Accept-Ranges': 'bytes',
        'Content-Disposition': `${disposition}; filename*=UTF-8''${encodedFileName}`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error("Dosya indirme hatası:", error)
    return NextResponse.json({ message: "Dosya indirilirken hata oluştu" }, { status: 500 })
  }
}
