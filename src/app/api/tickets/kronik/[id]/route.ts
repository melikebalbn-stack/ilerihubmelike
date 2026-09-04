import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { kronikYetkisiVarMi, gecerliDurumMu, cozumNotuZorunluMu } from '@/lib/tickets/kronik'

/**
 * GET   /api/tickets/kronik/[id] — detay + bağlı talepler (çözüm özetleriyle)
 * PATCH /api/tickets/kronik/[id] — başlık/açıklama düzenle veya durum değiştir
 *
 * COZULDU'ya geçişte `cozumNotu` ZORUNLU (bkz. lib/tickets/kronik.ts).
 * Çözüm damgaları (cozulenAt, cozenBy*) o geçişte sunucuda yazılır.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { session, error } = await requireUser()
    if (error) return error
    if (!kronikYetkisiVarMi(session.user.permissions)) {
      return NextResponse.json({ error: 'Bu kayda erişim yetkiniz yok' }, { status: 403 })
    }

    const { id } = await params
    const kayit = await prisma.kronikSorun.findUnique({
      where: { id },
      include: {
        tickets: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            ticketNumber: true,
            subject: true,
            status: true,
            createdAt: true,
            resolvedAt: true,
            // Detayda "bağlı taleplerin çözüm özetleri" isteniyor.
            resolutionSummary: true,
            resolvedByName: true,
            category: { select: { name: true, color: true } },
          },
        },
      },
    })

    if (!kayit) {
      return NextResponse.json({ error: 'Kronik sorun bulunamadı' }, { status: 404 })
    }

    return NextResponse.json({ ...kayit, bagliTalep: kayit.tickets.length })
  } catch (error) {
    console.error('Kronik sorun detay hatası:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { session, user, error } = await requireUser()
    if (error) return error
    if (!kronikYetkisiVarMi(session.user.permissions)) {
      return NextResponse.json({ error: 'Bu kaydı değiştirme yetkiniz yok' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json().catch(() => ({}))

    const mevcut = await prisma.kronikSorun.findUnique({ where: { id } })
    if (!mevcut) {
      return NextResponse.json({ error: 'Kronik sorun bulunamadı' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}

    if (typeof body?.baslik === 'string') {
      const baslik = body.baslik.trim()
      if (!baslik) return NextResponse.json({ error: 'Başlık boş olamaz' }, { status: 400 })
      data.baslik = baslik
    }
    if (typeof body?.aciklama === 'string') {
      data.aciklama = body.aciklama.trim() || null
    }

    if (body?.durum !== undefined) {
      if (!gecerliDurumMu(body.durum)) {
        return NextResponse.json({ error: 'Geçersiz durum' }, { status: 400 })
      }
      const cozumNotu = typeof body?.cozumNotu === 'string' ? body.cozumNotu.trim() : ''

      if (cozumNotuZorunluMu(body.durum)) {
        // Zorunluluk YALNIZ geçiş anında: zaten COZULDU olan bir kaydın notu
        // duruyorsa yeniden istenmez.
        if (!cozumNotu && !mevcut.cozumNotu?.trim()) {
          return NextResponse.json(
            { error: 'Çözüldü olarak işaretlemek için kalıcı çözüm notu zorunludur' },
            { status: 400 },
          )
        }
        data.durum = 'COZULDU'
        if (cozumNotu) data.cozumNotu = cozumNotu
        // Damgalar yalnız İLK çözümde yazılır; sonraki düzenlemeler tarihi kaydırmaz.
        if (mevcut.durum !== 'COZULDU') {
          data.cozulenAt = new Date()
          data.cozenByEmail = user.email
          data.cozenByName = user.name ?? user.email
        }
      } else {
        // COZULDU → AKTIF geri alma: çözüm notu KORUNUR (bilgi kaybetme),
        // yalnız damgalar temizlenir ki "ne zaman çözüldü" yanlış olmasın.
        data.durum = 'AKTIF'
        if (mevcut.durum === 'COZULDU') {
          data.cozulenAt = null
          data.cozenByEmail = null
          data.cozenByName = null
        }
      }
    } else if (typeof body?.cozumNotu === 'string') {
      // Durum değişmeden yalnız not güncelleme.
      data.cozumNotu = body.cozumNotu.trim() || null
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Güncellenecek alan yok' }, { status: 400 })
    }

    const guncel = await prisma.kronikSorun.update({ where: { id }, data })
    return NextResponse.json(guncel)
  } catch (error) {
    console.error('Kronik sorun güncelleme hatası:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}
