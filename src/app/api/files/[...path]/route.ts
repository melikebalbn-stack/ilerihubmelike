import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createReadStream, existsSync, statSync } from 'fs'
import path from 'path'
import { Readable } from 'stream'

// MIME types
const mimeTypes: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.zip': 'application/zip',
  '.rar': 'application/vnd.rar',
}

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    // Kimlik doğrulama kontrolü - dosyalara erişim için oturum gerekli
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { path: pathParts } = await params

    // Path güvenlik kontrolü - sadece uploads klasöründen izin ver
    const relativePath = pathParts.join('/')
    if (relativePath.includes('..') || !relativePath.startsWith('uploads/')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const filePath = path.join(process.cwd(), 'public', relativePath)

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Dosya bilgilerini al
    const stat = statSync(filePath)
    const fileSize = stat.size
    const ext = path.extname(filePath).toLowerCase()
    const contentType = mimeTypes[ext] || 'application/octet-stream'

    // Dosya adını RFC 5987 uyumlu şekilde encode et (Türkçe karakterler için)
    const fileName = path.basename(filePath)
    const encodedFileName = encodeURIComponent(fileName).replace(/['()]/g, escape)

    // Range request kontrolü (PDF viewer'lar için önemli)
    const rangeHeader = request.headers.get('range')

    if (rangeHeader) {
      const range = parseRange(rangeHeader, fileSize)

      if (!range) {
        return new NextResponse('Range Not Satisfiable', {
          status: 416,
          headers: {
            'Content-Range': `bytes */${fileSize}`,
          },
        })
      }

      const { start, end } = range
      const chunkSize = end - start + 1

      // Partial content stream oluştur
      const nodeStream = createReadStream(filePath, { start, end })
      const webStream = nodeStreamToWebStream(nodeStream)

      return new NextResponse(webStream, {
        status: 206,
        headers: {
          'Content-Type': contentType,
          'Content-Length': chunkSize.toString(),
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Disposition': `inline; filename*=UTF-8''${encodedFileName}`,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'X-Accel-Buffering': 'no', // nginx buffering'i devre dışı bırak
        },
      })
    }

    // Normal streaming response (Range header yok)
    const nodeStream = createReadStream(filePath)
    const webStream = nodeStreamToWebStream(nodeStream)

    return new NextResponse(webStream, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileSize.toString(),
        'Accept-Ranges': 'bytes',
        'Content-Disposition': `inline; filename*=UTF-8''${encodedFileName}`,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Accel-Buffering': 'no', // nginx buffering'i devre dışı bırak
      },
    })
  } catch (error) {
    console.error('File serving error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
