import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { toplantiKullaniciIdCoz } from '@/lib/meetings/kullanici-coz'
import {
  toplantiHataYaniti, enumDogrula, KARAR_ONCELIKLERI, KARAR_DURUMLARI,
} from '@/lib/meetings/hata'

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
      responsibleEmail,
      responsibleId,
      responsibleName,
      dueDate,
      priority = 'MEDIUM'
    } = body

    // Açıklama ARTIK OPSİYONEL: modalda yıldızsız görünüyordu ama uç zorunlu
    // tutuyordu; kullanıcı boş bırakınca sebebini göremeden 400 alıyordu.
    if (!title) {
      return NextResponse.json(
        { error: 'Karar başlığı zorunludur' },
        { status: 400 }
      )
    }

    const oncelikKontrol = enumDogrula('priority', priority, KARAR_ONCELIKLERI)
    if (!oncelikKontrol.ok) return oncelikKontrol.yanit

    // Sorumlu: e-posta → User.id. Seçici LDAP kaynağında User.id DÖNDÜRMEZ
    // (distinguishedName / ldap_<user>) — ham değer MeetingDecision_responsibleId_fkey
    // ihlaline yol açıyordu. Çözülemezse null, istek patlamaz.
    const cozulmusResponsibleId = await toplantiKullaniciIdCoz(
      prisma,
      responsibleEmail ?? responsibleId,
    )

    const decisionNumber = await generateDecisionNumber(meetingId)

    const decision = await prisma.meetingDecision.create({
      data: {
        meetingId,
        decisionNumber,
        title,
        description: description || null,
        responsibleId: cozulmusResponsibleId,
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
    return toplantiHataYaniti('decisions/POST', error)
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
      responsibleEmail,
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

    const oncelikKontrol = enumDogrula('priority', priority, KARAR_ONCELIKLERI)
    if (!oncelikKontrol.ok) return oncelikKontrol.yanit
    const durumKontrol = enumDogrula('status', status, KARAR_DURUMLARI)
    if (!durumKontrol.ok) return durumKontrol.yanit

    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = title
    // Açıklama nullable — boş gönderilirse temizlenir.
    if (description !== undefined) updateData.description = description || null
    // POST ile AYNI çözüm (e-posta önce, legacy id varlık kontrolünden geçer).
    if (responsibleEmail !== undefined || responsibleId !== undefined) {
      updateData.responsibleId = await toplantiKullaniciIdCoz(prisma, responsibleEmail ?? responsibleId)
    }
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
    return toplantiHataYaniti('decisions/PUT', error)
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
    return toplantiHataYaniti('decisions/DELETE', error)
  }
}
