import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST - Save uploaded file references as attachments
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { files } = body

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: 'Dosya bilgisi gerekli' }, { status: 400 })
    }

    const report = await prisma.visitReport.findUnique({ where: { id } })
    if (!report) {
      return NextResponse.json({ error: 'Rapor bulunamadı' }, { status: 404 })
    }

    const attachments = await Promise.all(
      files.map((file: { name: string; url: string; type: string; size: number }) =>
        prisma.visitReportAttachment.create({
          data: {
            reportId: id,
            fileName: file.name,
            filePath: file.url,
            fileSize: file.size,
            mimeType: file.type,
          },
        })
      )
    )

    return NextResponse.json(attachments, { status: 201 })
  } catch (error) {
    console.error('Ek dosya kaydedilirken hata:', error)
    return NextResponse.json({ error: 'Dosya kaydedilirken hata oluştu' }, { status: 500 })
  }
}

// GET - List attachments for a report
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const attachments = await prisma.visitReportAttachment.findMany({
      where: { reportId: id },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(attachments)
  } catch (error) {
    return NextResponse.json({ error: 'Dosyalar alınırken hata oluştu' }, { status: 500 })
  }
}

// DELETE - Remove an attachment
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const attachmentId = searchParams.get('attachmentId')

    if (!attachmentId) {
      return NextResponse.json({ error: 'Attachment ID gerekli' }, { status: 400 })
    }

    await prisma.visitReportAttachment.delete({ where: { id: attachmentId } })
    return NextResponse.json({ message: 'Dosya silindi' })
  } catch (error) {
    return NextResponse.json({ error: 'Dosya silinirken hata oluştu' }, { status: 500 })
  }
}
