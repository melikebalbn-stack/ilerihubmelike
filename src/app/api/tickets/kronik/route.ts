import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import type { Prisma } from '@/generated/prisma'
import { kronikYetkisiVarMi, gecerliDurumMu } from '@/lib/tickets/kronik'

/**
 * GET  /api/tickets/kronik — tanımlı kronik sorunlar
 * POST /api/tickets/kronik — yeni kronik sorun tanımla
 *
 * Faz 1'deki otomatik tespit ucunu (cozum-arsivi/kronik) DEĞİŞTİRMİYOR, onun
 * YERİNE geçiyor: orada kategori+cihaz tekrar sayımı vardı ve yanlış pozitif
 * üretiyordu. Burada listelenen her kayıt insan tarafından tanımlanmıştır.
 *
 * Yetki: IT ekibi (helpdesk.admin veya helpdesk.ticket.resolve).
 */
export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireUser()
    if (error) return error
    if (!kronikYetkisiVarMi(session.user.permissions)) {
      return NextResponse.json({ error: 'Bu sayfaya erişim yetkiniz yok' }, { status: 403 })
    }

    const sp = request.nextUrl.searchParams
    const durum = sp.get('durum')
    const q = (sp.get('q') ?? '').trim()

    const where: Prisma.KronikSorunWhereInput = {}
    if (gecerliDurumMu(durum)) where.durum = durum
    if (q) {
      where.OR = [
        { baslik: { contains: q, mode: 'insensitive' } },
        { aciklama: { contains: q, mode: 'insensitive' } },
      ]
    }

    const kayitlar = await prisma.kronikSorun.findMany({
      where,
      orderBy: [{ durum: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        baslik: true,
        aciklama: true,
        durum: true,
        cozumNotu: true,
        cozulenAt: true,
        cozenByName: true,
        createdByName: true,
        createdAt: true,
        _count: { select: { tickets: true } },
      },
    })

    // Son talep tarihi: bağlı taleplerin en yenisi. Kayıt başına sorgu yerine
    // tek groupBy — liste büyüse de sabit maliyet.
    const sonTalepler = await prisma.ticket.groupBy({
      by: ['kronikSorunId'],
      where: { kronikSorunId: { not: null }, isActive: true },
      _max: { createdAt: true },
    })
    const sonHarita = new Map(
      sonTalepler.map((s) => [s.kronikSorunId as string, s._max.createdAt]),
    )

    return NextResponse.json(
      kayitlar.map((k) => ({
        ...k,
        bagliTalep: k._count.tickets,
        sonTalepTarihi: sonHarita.get(k.id) ?? null,
      })),
    )
  } catch (error) {
    console.error('Kronik sorun listesi hatası:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, user, error } = await requireUser()
    if (error) return error
    if (!kronikYetkisiVarMi(session.user.permissions)) {
      return NextResponse.json({ error: 'Kronik sorun tanımlama yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const baslik = typeof body?.baslik === 'string' ? body.baslik.trim() : ''
    const aciklama = typeof body?.aciklama === 'string' ? body.aciklama.trim() : ''

    if (!baslik) {
      return NextResponse.json({ error: 'Başlık zorunludur' }, { status: 400 })
    }

    const kayit = await prisma.kronikSorun.create({
      data: {
        baslik,
        aciklama: aciklama || null,
        createdByEmail: user.email,
        createdByName: user.name ?? user.email,
      },
    })

    return NextResponse.json({ ...kayit, bagliTalep: 0, sonTalepTarihi: null }, { status: 201 })
  } catch (error) {
    console.error('Kronik sorun oluşturma hatası:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}
