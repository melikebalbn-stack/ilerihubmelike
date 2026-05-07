import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'

// 5S denetim numarası oluştur: 5S-2025-0001
async function generateAuditNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `5S-${year}-`

  const lastAudit = await prisma.fiveSAudit.findFirst({
    where: { auditNumber: { startsWith: prefix } },
    orderBy: { auditNumber: 'desc' }
  })

  let nextNumber = 1
  if (lastAudit) {
    const lastNumber = parseInt(lastAudit.auditNumber.replace(prefix, ''))
    nextNumber = lastNumber + 1
  }

  return `${prefix}${nextNumber.toString().padStart(4, '0')}`
}

// GET - 5S denetimlerini listele
export async function GET(request: NextRequest) {
  try {
    // PR-Y2.5-suggestions: requireUser
    const { user, error } = await requireUser()
    if (error) return error

    const { searchParams } = new URL(request.url)
    const viewMode = searchParams.get('viewMode') || 'all'
    const areaId = searchParams.get('areaId')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const userEmail = user.email

    const where: Record<string, unknown> = {}

    // Kullanıcının rolünü belirle (kurul üyesi mi?)
    const boardMembers = await prisma.suggestionBoardMember.findMany({
      where: { isActive: true },
      select: { email: true },
    })
    const isBoardMember = boardMembers.some(m => m.email.toLowerCase() === userEmail)

    if (viewMode === 'my') {
      where.auditorEmail = { equals: userEmail, mode: 'insensitive' }
    } else if (viewMode === 'all') {
      // Görünürlük kısıtlaması: Kurul üyesi tümünü görsün, diğerleri sadece kendi denetimlerini
      if (!isBoardMember) {
        where.auditorEmail = { equals: userEmail, mode: 'insensitive' }
      }
    }

    if (areaId) {
      where.areaId = areaId
    }

    if (status) {
      where.status = status
    }

    const audits = await prisma.fiveSAudit.findMany({
      where,
      include: {
        area: true,
        _count: {
          select: {
            findings: true,
            photos: true
          }
        }
      },
      orderBy: { auditDate: 'desc' },
      take: limit
    })

    return NextResponse.json(audits)
  } catch (error) {
    console.error('5S denetimleri yüklenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST - Yeni 5S denetimi oluştur
export async function POST(request: NextRequest) {
  try {
    // PR-Y2.5-suggestions: requireUser
    const { user, error } = await requireUser()
    if (error) return error

    const body = await request.json()
    const {
      areaId,
      templateId,
      auditDate,
      auditType,
      seiriScore,
      seitonScore,
      seisoScore,
      seiketsuScore,
      shitsukeScore,
      seiriDetails,
      seitonDetails,
      seisoDetails,
      seiketsuDetails,
      shitsukeDetails,
      // Uygunsuzluk alanları (yeni)
      seiriFindings,
      seitonFindings,
      seisoFindings,
      seiketsuFindings,
      shitsukeFindings,
      strengths,
      improvements,
      notes,
      attachments
    } = body

    if (!areaId) {
      return NextResponse.json({ error: 'Denetim alanı zorunludur' }, { status: 400 })
    }

    // Alanı kontrol et
    const area = await prisma.fiveSArea.findUnique({ where: { id: areaId } })
    if (!area) {
      return NextResponse.json({ error: 'Denetim alanı bulunamadı' }, { status: 404 })
    }

    const auditNumber = await generateAuditNumber()

    // Toplam puanı hesapla
    const scores = [
      seiriScore || 0,
      seitonScore || 0,
      seisoScore || 0,
      seiketsuScore || 0,
      shitsukeScore || 0
    ]
    const totalScore = Math.round(scores.reduce((a, b) => a + b, 0) / 5)

    const audit = await prisma.fiveSAudit.create({
      data: {
        auditNumber,
        areaId,
        templateId,
        auditDate: auditDate ? new Date(auditDate) : new Date(),
        auditType: auditType || 'REGULAR',
        auditorEmail: user.email,
        auditorName: user.name ?? user.email,
        seiriScore: seiriScore || 0,
        seitonScore: seitonScore || 0,
        seisoScore: seisoScore || 0,
        seiketsuScore: seiketsuScore || 0,
        shitsukeScore: shitsukeScore || 0,
        totalScore,
        // Uygunsuzlukları Details alanlarına kaydet (findings veya details)
        seiriDetails: seiriFindings || seiriDetails || null,
        seitonDetails: seitonFindings || seitonDetails || null,
        seisoDetails: seisoFindings || seisoDetails || null,
        seiketsuDetails: seiketsuFindings || seiketsuDetails || null,
        shitsukeDetails: shitsukeFindings || shitsukeDetails || null,
        strengths,
        improvements,
        notes,
        status: 'DRAFT'
      },
      include: {
        area: true,
        findings: true,
        photos: true
      }
    })

    // Dosyaları kaydet (varsa)
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      for (const attachment of attachments) {
        await prisma.fiveSPhoto.create({
          data: {
            auditId: audit.id,
            fileUrl: attachment.url || attachment.path,
            photoType: 'EVIDENCE',
            caption: attachment.originalName || attachment.name,
            uploadedBy: user.email,
            uploadedByName: user.name ?? user.email
          }
        })
      }
    }

    // Güncellenmiş denetimi getir
    const updatedAudit = await prisma.fiveSAudit.findUnique({
      where: { id: audit.id },
      include: {
        area: true,
        findings: true,
        photos: true
      }
    })

    return NextResponse.json(updatedAudit, { status: 201 })
  } catch (error) {
    console.error('5S denetimi oluşturulurken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
