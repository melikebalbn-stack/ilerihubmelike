import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - 5S denetim detayı
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

    const audit = await prisma.fiveSAudit.findUnique({
      where: { id },
      include: {
        area: true,
        template: true,
        findings: {
          orderBy: { createdAt: 'desc' }
        },
        photos: {
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!audit) {
      return NextResponse.json({ error: 'Denetim bulunamadı' }, { status: 404 })
    }

    return NextResponse.json(audit)
  } catch (error) {
    console.error('5S denetimi yüklenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PUT - 5S denetimini güncelle
export async function PUT(
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

    const existingAudit = await prisma.fiveSAudit.findUnique({
      where: { id }
    })

    if (!existingAudit) {
      return NextResponse.json({ error: 'Denetim bulunamadı' }, { status: 404 })
    }

    // Sadece denetçi güncelleyebilir
    if (existingAudit.auditorEmail !== session.user.email) {
      return NextResponse.json({ error: 'Bu denetimi güncelleme yetkiniz yok' }, { status: 403 })
    }

    const {
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
      strengths,
      improvements,
      notes,
      status
    } = body

    // Toplam puanı hesapla
    const scores = [
      seiriScore ?? existingAudit.seiriScore,
      seitonScore ?? existingAudit.seitonScore,
      seisoScore ?? existingAudit.seisoScore,
      seiketsuScore ?? existingAudit.seiketsuScore,
      shitsukeScore ?? existingAudit.shitsukeScore
    ]
    const totalScore = Math.round(scores.reduce((a, b) => a + b, 0) / 5)

    const audit = await prisma.fiveSAudit.update({
      where: { id },
      data: {
        seiriScore: seiriScore ?? existingAudit.seiriScore,
        seitonScore: seitonScore ?? existingAudit.seitonScore,
        seisoScore: seisoScore ?? existingAudit.seisoScore,
        seiketsuScore: seiketsuScore ?? existingAudit.seiketsuScore,
        shitsukeScore: shitsukeScore ?? existingAudit.shitsukeScore,
        totalScore,
        seiriDetails,
        seitonDetails,
        seisoDetails,
        seiketsuDetails,
        shitsukeDetails,
        strengths,
        improvements,
        notes,
        status
      },
      include: {
        area: true,
        findings: true,
        photos: true
      }
    })

    return NextResponse.json(audit)
  } catch (error) {
    console.error('5S denetimi güncellenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE - 5S denetimini sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const existingAudit = await prisma.fiveSAudit.findUnique({
      where: { id }
    })

    if (!existingAudit) {
      return NextResponse.json({ error: 'Denetim bulunamadı' }, { status: 404 })
    }

    // Sadece denetçi ve sadece DRAFT durumunda silebilir
    if (existingAudit.auditorEmail !== session.user.email) {
      return NextResponse.json({ error: 'Bu denetimi silme yetkiniz yok' }, { status: 403 })
    }

    if (existingAudit.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Tamamlanan denetimler silinemez' },
        { status: 400 }
      )
    }

    await prisma.fiveSAudit.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('5S denetimi silinirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
