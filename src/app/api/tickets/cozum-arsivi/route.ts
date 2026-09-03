import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import type { Prisma } from '@/generated/prisma'

/**
 * GET /api/tickets/cozum-arsivi — çözüm arşivi listesi.
 *
 * KAPSAM: yalnız ÇÖZÜM METNİ DOLU talepler. Çözüm yazılmamış talep arşivde
 * görünmez (aranacak bir şey yoktur); tekrar sayısı ise kronik ucundan gelir.
 *
 * Arama PostgreSQL ILIKE ile: konu + çözüm metni. Full-text index'e girilmedi —
 * bugün toplam 24 talep var; ILIKE bu ölçekte fazlasıyla yeter ve tsvector
 * kolonu + trigger bakımı erken maliyet olur. Arşiv binlere çıkarsa
 * pg_trgm/GIN'e geçilecek (o zaman bu yorum yol gösterir).
 *
 * Yetki: helpdesk.admin VEYA helpdesk.ticket.resolve — yani IT ekibi
 * (it-admin/super-admin + helpdesk-agent). Talep sahipleri arşivi görmez.
 */
export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireUser()
    if (error) return error

    const izinler = session.user.permissions ?? []
    const itEkibi =
      izinler.includes('helpdesk.admin') || izinler.includes('helpdesk.ticket.resolve')
    if (!itEkibi) {
      return NextResponse.json({ error: 'Çözüm arşivine erişim yetkiniz yok' }, { status: 403 })
    }

    const sp = request.nextUrl.searchParams
    const q = (sp.get('q') ?? '').trim()
    const categoryId = sp.get('categoryId') || null
    const zimmetFormuId = sp.get('zimmetFormuId') || null
    const cozen = (sp.get('cozen') ?? '').trim().toLowerCase()
    const baslangic = sp.get('baslangic')
    const bitis = sp.get('bitis')
    const limitHam = parseInt(sp.get('limit') || '50', 10)
    const limit = Number.isFinite(limitHam) ? Math.max(1, Math.min(200, limitHam)) : 50

    const where: Prisma.TicketWhereInput = {
      isActive: true,
      // Arşivin tanımı: çözüm metni dolu. Boş string de elenir.
      resolutionSummary: { not: null },
      NOT: { resolutionSummary: '' },
      status: { in: ['RESOLVED', 'CLOSED'] },
    }

    if (q) {
      where.OR = [
        { subject: { contains: q, mode: 'insensitive' } },
        { resolutionSummary: { contains: q, mode: 'insensitive' } },
      ]
    }
    if (categoryId) where.categoryId = categoryId
    if (zimmetFormuId) where.zimmetFormuId = zimmetFormuId
    if (cozen) where.resolvedByEmail = { equals: cozen, mode: 'insensitive' }

    // Tarih referansı: çözüm anı. resolvedAt itiraz sonrası sıfırlanıp yeniden
    // yazıldığı için "en son çözüldüğü an" anlamına gelir — arşiv için doğrusu bu.
    if (baslangic || bitis) {
      const aralik: Prisma.DateTimeFilter = {}
      if (baslangic) aralik.gte = new Date(baslangic)
      if (bitis) {
        const b = new Date(bitis)
        b.setHours(23, 59, 59, 999) // bitiş günü dahil
        aralik.lte = b
      }
      where.resolvedAt = aralik
    }

    const kayitlar = await prisma.ticket.findMany({
      where,
      orderBy: { resolvedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        description: true,
        resolutionSummary: true,
        resolvedAt: true,
        resolvedByEmail: true,
        resolvedByName: true,
        categoryId: true,
        category: { select: { name: true, color: true } },
        zimmetFormuId: true,
        assetInfo: true,
        objectionCount: true,
      },
    })

    // Tekrar sayısı: aynı gruplama anahtarındaki TÜM talepler (çözüm yazılmamış
    // olanlar dahil) — kronik sekmesiyle aynı tanım, iki yerde farklı sayı
    // görünmesin. Anahtar: categoryId + zimmetFormuId (ikisi de null olabilir).
    const anahtarlar = kayitlar.map((k) => ({
      categoryId: k.categoryId,
      zimmetFormuId: k.zimmetFormuId,
    }))
    const tekrarHaritasi = await tekrarSayilari(anahtarlar)

    return NextResponse.json(
      kayitlar.map((k) => ({
        ...k,
        tekrarSayisi: tekrarHaritasi.get(anahtar(k.categoryId, k.zimmetFormuId)) ?? 1,
      })),
    )
  } catch (error) {
    console.error('Çözüm arşivi hatası:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}

export function anahtar(categoryId: string | null, zimmetFormuId: string | null): string {
  return `${categoryId ?? '-'}|${zimmetFormuId ?? '-'}`
}

/**
 * Verilen anahtarlar için toplam talep sayısı. Tek groupBy turu — kayıt başına
 * sorgu yok.
 */
async function tekrarSayilari(
  anahtarlar: Array<{ categoryId: string | null; zimmetFormuId: string | null }>,
): Promise<Map<string, number>> {
  const sonuc = new Map<string, number>()
  if (anahtarlar.length === 0) return sonuc

  const gruplar = await prisma.ticket.groupBy({
    by: ['categoryId', 'zimmetFormuId'],
    where: { isActive: true },
    _count: { _all: true },
  })
  for (const g of gruplar) {
    sonuc.set(anahtar(g.categoryId, g.zimmetFormuId), g._count._all)
  }
  return sonuc
}
