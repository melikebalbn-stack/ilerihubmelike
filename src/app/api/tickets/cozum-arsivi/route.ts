import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import type { Prisma } from '@/generated/prisma'

/**
 * GET /api/tickets/cozum-arsivi — çözüm arşivi listesi.
 *
 * KAPSAM: yalnız ÇÖZÜM METNİ DOLU talepler. Çözüm yazılmamış talep arşivde
 * görünmez (aranacak bir şey yoktur). Tekrar rozeti yalnız talep bir kronik
 * soruna bağlıysa gösterilir (Faz 1.5 — otomatik kategori sayımı kaldırıldı).
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
        kronikSorunId: true,
        kronikSorun: { select: { id: true, baslik: true, durum: true } },
      },
    })

    // TEKRAR ROZETİ (Faz 1.5): kategori+cihaz sayımı KALDIRILDI — "Grafik
    // Tasarım" altındaki 5 ayrı istek "5 kez tekrarlandı" görünüyordu. Rozet
    // artık yalnız talep bir kronik soruna BAĞLIYSA çıkar ve sayı o kronik
    // soruna bağlı talep sayısıdır; yani sayının arkasında insan yargısı var.
    const kronikIdler = [
      ...new Set(kayitlar.map((k) => k.kronikSorunId).filter((v): v is string => !!v)),
    ]
    const bagliSayilar = await kronikTalepSayilari(kronikIdler)

    return NextResponse.json(
      kayitlar.map((k) => ({
        ...k,
        kronikBagliTalep: k.kronikSorunId ? bagliSayilar.get(k.kronikSorunId) ?? 1 : null,
      })),
    )
  } catch (error) {
    console.error('Çözüm arşivi hatası:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}

/**
 * Verilen kronik sorunlara bağlı talep sayıları — tek groupBy turu.
 */
async function kronikTalepSayilari(idler: string[]): Promise<Map<string, number>> {
  const sonuc = new Map<string, number>()
  if (idler.length === 0) return sonuc

  const gruplar = await prisma.ticket.groupBy({
    by: ['kronikSorunId'],
    where: { isActive: true, kronikSorunId: { in: idler } },
    _count: { _all: true },
  })
  for (const g of gruplar) {
    if (g.kronikSorunId) sonuc.set(g.kronikSorunId, g._count._all)
  }
  return sonuc
}
