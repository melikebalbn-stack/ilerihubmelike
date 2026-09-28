import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AgendaOutcome, AgendaItemStatus } from '@/generated/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { toplantiKullaniciIdCoz } from '@/lib/meetings/kullanici-coz'
import { toplantiHataYaniti } from '@/lib/meetings/hata'

// POST - Gündem maddesi ekle
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
      select: { id: true, organizerId: true }
    })

    if (!meeting) {
      return NextResponse.json({ error: 'Toplantı bulunamadı' }, { status: 404 })
    }

    const body = await request.json()
    const {
      title,
      description,
      presenterEmail,
      presenterId,
      presenterName,
      plannedDuration
    } = body

    if (!title) {
      return NextResponse.json({ error: 'Gündem başlığı zorunludur' }, { status: 400 })
    }

    // Son sıra numarasını bul
    const lastItem = await prisma.meetingAgendaItem.findFirst({
      where: { meetingId },
      orderBy: { orderNo: 'desc' }
    })

    const orderNo = (lastItem?.orderNo || 0) + 1

    // POST /api/meetings ile AYNI çözüm — bu uç şu an UI'dan çağrılmıyor ama
    // aynı FK ihlalini üretebilecek tek diğer yazma noktası, açık bırakılmadı.
    const cozulmusPresenterId = await toplantiKullaniciIdCoz(prisma, presenterEmail ?? presenterId)

    const agendaItem = await prisma.meetingAgendaItem.create({
      data: {
        meetingId,
        orderNo,
        title,
        description,
        presenterId: cozulmusPresenterId,
        presenterName: presenterName || null,
        plannedDuration: plannedDuration || null,
        status: 'PENDING'
      },
      include: {
        presenter: {
          select: { id: true, name: true }
        }
      }
    })

    return NextResponse.json(agendaItem, { status: 201 })
  } catch (error) {
    return toplantiHataYaniti('agenda-items/POST', error)
  }
}

// PUT - Gündem maddelerini toplu güncelle (sıralama için)
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
    const { items } = body // [{ id, orderNo, ... }]

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Geçersiz veri' }, { status: 400 })
    }

    // Transaction ile güncelle
    await prisma.$transaction(
      items.map((item: { id: string; orderNo?: number; title?: string; description?: string; discussionNotes?: string; outcome?: string; outcomeNotes?: string; status?: string; actualDuration?: number }) =>
        prisma.meetingAgendaItem.update({
          where: { id: item.id },
          data: {
            orderNo: item.orderNo,
            title: item.title,
            description: item.description,
            discussionNotes: item.discussionNotes,
            outcome: item.outcome as AgendaOutcome | null | undefined,
            outcomeNotes: item.outcomeNotes,
            status: item.status as AgendaItemStatus | undefined,
            actualDuration: item.actualDuration
          }
        })
      )
    )

    // Güncel listeyi döndür
    const agendaItems = await prisma.meetingAgendaItem.findMany({
      where: { meetingId },
      include: {
        presenter: {
          select: { id: true, name: true }
        }
      },
      orderBy: { orderNo: 'asc' }
    })

    return NextResponse.json(agendaItems)
  } catch (error) {
    return toplantiHataYaniti('agenda-items/PUT', error)
  }
}

// DELETE - Gündem maddesi sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-meetings: requireSession (basit auth gate)
    const { error } = await requireSession()
    if (error) return error

    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('itemId')

    if (!itemId) {
      return NextResponse.json({ error: 'Item ID gerekli' }, { status: 400 })
    }

    await prisma.meetingAgendaItem.delete({
      where: { id: itemId }
    })

    return NextResponse.json({ message: 'Gündem maddesi silindi' })
  } catch (error) {
    return toplantiHataYaniti('agenda-items/DELETE', error)
  }
}
