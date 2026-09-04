import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { kronikYetkisiVarMi } from '@/lib/tickets/kronik'

/**
 * PUT    /api/tickets/[id]/kronik — talebi bir kronik soruna bağla
 *        body: { kronikSorunId }  VEYA  { baslik, aciklama? } (yeni tanımlayıp bağla)
 * DELETE /api/tickets/[id]/kronik — bağı kaldır
 *
 * Yetki: IT ekibi. Talep sahibi/atanan bu bağı kuramaz — "aynı sorun mu"
 * yargısı IT'ye ait ve kronik liste yalnız IT'ye açık.
 *
 * Ticket'ın PUT ucuna eklenmedi: orası talebin kendi alanlarını (durum,
 * öncelik, atama) yönetiyor ve yetki kuralları farklı; kronik bağı ayrı bir
 * eylem olarak kendi kapısında duruyor.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { session, user, error } = await requireUser()
    if (error) return error
    if (!kronikYetkisiVarMi(session.user.permissions)) {
      return NextResponse.json({ error: 'Kronik soruna bağlama yetkiniz yok' }, { status: 403 })
    }

    const { id: ticketId } = await params
    const body = await request.json().catch(() => ({}))

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, ticketNumber: true },
    })
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket bulunamadı' }, { status: 404 })
    }

    let kronikSorunId: string = ''

    if (typeof body?.kronikSorunId === 'string' && body.kronikSorunId.trim()) {
      kronikSorunId = body.kronikSorunId.trim()
      const varMi = await prisma.kronikSorun.findUnique({
        where: { id: kronikSorunId },
        select: { id: true },
      })
      if (!varMi) {
        return NextResponse.json({ error: 'Kronik sorun bulunamadı' }, { status: 404 })
      }
    } else if (typeof body?.baslik === 'string' && body.baslik.trim()) {
      // Yeni tanımla + bağla: IT ekibi ticket detayından ayrılmadan halledebilsin.
      const yeni = await prisma.kronikSorun.create({
        data: {
          baslik: body.baslik.trim(),
          aciklama: typeof body?.aciklama === 'string' ? body.aciklama.trim() || null : null,
          createdByEmail: user.email,
          createdByName: user.name ?? user.email,
        },
        select: { id: true },
      })
      kronikSorunId = yeni.id
    } else {
      return NextResponse.json(
        { error: 'kronikSorunId veya yeni kayıt için baslik gerekli' },
        { status: 400 },
      )
    }

    const guncel = await prisma.ticket.update({
      where: { id: ticketId },
      data: { kronikSorunId },
      select: {
        id: true,
        kronikSorunId: true,
        kronikSorun: { select: { id: true, baslik: true, durum: true } },
      },
    })

    await prisma.ticketTimeline.create({
      data: {
        ticketId,
        action: 'kronik_baglandi',
        description: `Kronik soruna bağlandı: ${guncel.kronikSorun?.baslik ?? ''}`,
        performedBy: user.email,
        performedByName: user.name ?? user.email,
      },
    })

    return NextResponse.json(guncel)
  } catch (error) {
    console.error('Kronik bağlama hatası:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { session, user, error } = await requireUser()
    if (error) return error
    if (!kronikYetkisiVarMi(session.user.permissions)) {
      return NextResponse.json({ error: 'Bağı kaldırma yetkiniz yok' }, { status: 403 })
    }

    const { id: ticketId } = await params
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, kronikSorun: { select: { baslik: true } } },
    })
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket bulunamadı' }, { status: 404 })
    }
    if (!ticket.kronikSorun) {
      return NextResponse.json({ error: 'Talep zaten kronik soruna bağlı değil' }, { status: 409 })
    }

    const guncel = await prisma.ticket.update({
      where: { id: ticketId },
      data: { kronikSorunId: null },
      select: { id: true, kronikSorunId: true },
    })

    await prisma.ticketTimeline.create({
      data: {
        ticketId,
        action: 'kronik_bag_kaldirildi',
        description: `Kronik sorun bağı kaldırıldı: ${ticket.kronikSorun.baslik}`,
        performedBy: user.email,
        performedByName: user.name ?? user.email,
      },
    })

    return NextResponse.json(guncel)
  } catch (error) {
    console.error('Kronik bağ kaldırma hatası:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}
