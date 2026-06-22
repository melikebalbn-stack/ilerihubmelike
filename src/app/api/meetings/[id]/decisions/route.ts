import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'

// Karar numarası oluştur
async function generateDecisionNumber(meetingId: string): Promise<string> {
  const count = await prisma.meetingDecision.count({
    where: { meetingId }
  })
  return `K-${(count + 1).toString().padStart(3, '0')}`
}

// POST - Karar/Aksiyon ekle
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-meetings: requireSession (basit auth gate)
    const { error } = await requireSession()
    if (error) return error

    const { id: meetingId } = await params

    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { id: true }
    })

    if (!meeting) {
      return NextResponse.json({ error: 'Toplantı bulunamadı' }, { status: 404 })
    }

    const body = await request.json()
    const {
      title,
      description,
      responsibleId,
      responsibleName,
      dueDate,
      priority = 'MEDIUM'
    } = body

    if (!title || !description) {
      return NextResponse.json(
        { error: 'Karar başlığı ve açıklaması zorunludur' },
        { status: 400 }
      )
    }

    const decisionNumber = await generateDecisionNumber(meetingId)

    const decision = await prisma.meetingDecision.create({
      data: {
        meetingId,
        decisionNumber,
        title,
        description,
        responsibleId: responsibleId || null,
        responsibleName: responsibleName || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        priority,
        status: 'PENDING'
      },
      include: {
        responsible: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    return NextResponse.json(decision, { status: 201 })
  } catch (error) {
    console.error('Karar eklenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PUT - Kararları güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-meetings: requireSession (basit auth gate)
    const { error } = await requireSession()
    if (error) return error

    const { id: meetingId } = await params
    const body = await request.json()

    // Tekil karar güncelleme
    const {
      decisionId,
      title,
      description,
      responsibleId,
      responsibleName,
      dueDate,
      priority,
      status,
      completionNotes
    } = body

    if (!decisionId) {
      return NextResponse.json({ error: 'Karar ID gerekli' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (responsibleId !== undefined) updateData.responsibleId = responsibleId || null
    if (responsibleName !== undefined) updateData.responsibleName = responsibleName
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null
    if (priority !== undefined) updateData.priority = priority
    if (status !== undefined) {
      updateData.status = status
      if (status === 'COMPLETED') {
        updateData.completedAt = new Date()
      } else {
        updateData.completedAt = null
      }
    }
    if (completionNotes !== undefined) updateData.completionNotes = completionNotes

    const decision = await prisma.meetingDecision.update({
      where: { id: decisionId },
      data: updateData,
      include: {
        responsible: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    return NextResponse.json(decision)
  } catch (error) {
    console.error('Karar güncellenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE - Karar sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-meetings: requireSession (basit auth gate)
    const { error } = await requireSession()
    if (error) return error

    const { searchParams } = new URL(request.url)
    const decisionId = searchParams.get('decisionId')

    if (!decisionId) {
      return NextResponse.json({ error: 'Karar ID gerekli' }, { status: 400 })
    }

    await prisma.meetingDecision.delete({
      where: { id: decisionId }
    })

    return NextResponse.json({ message: 'Karar silindi' })
  } catch (error) {
    console.error('Karar silinirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
