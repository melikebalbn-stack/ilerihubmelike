import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'

// PR-FORMS-ATTACHMENTS-OWNERSHIP: visit-reports route.ts ile aynı 7-rol filtresi
// Backlog: PR-FORMS-MANAGEMENT-ROLES-EXTRACT (lib helper'a çıkar — şu an inline tutarlılık)
const MANAGEMENT_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'DEPT_HEAD',
  'SUPERVISOR',
  'HR_MANAGER',
  'QUALITY_MANAGER',
  'IT_MANAGER',
]

// POST - Save uploaded file references as attachments
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-FORMS-ATTACHMENTS-OWNERSHIP: requireUser + MANAGEMENT_ROLES
    const { user, error } = await requireUser()
    if (error) return error
    if (!MANAGEMENT_ROLES.includes(user.role)) {
      return NextResponse.json(
        { error: 'Visit report ekine erişim için yönetim yetkisi gerekli' },
        { status: 403 }
      )
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
    // PR-FORMS-ATTACHMENTS-OWNERSHIP: requireUser + MANAGEMENT_ROLES
    const { user, error } = await requireUser()
    if (error) return error
    if (!MANAGEMENT_ROLES.includes(user.role)) {
      return NextResponse.json(
        { error: 'Visit report ekine erişim için yönetim yetkisi gerekli' },
        { status: 403 }
      )
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
    // PR-FORMS-ATTACHMENTS-OWNERSHIP: requireUser + MANAGEMENT_ROLES
    const { user, error } = await requireUser()
    if (error) return error
    if (!MANAGEMENT_ROLES.includes(user.role)) {
      return NextResponse.json(
        { error: 'Visit report ekine erişim için yönetim yetkisi gerekli' },
        { status: 403 }
      )
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
