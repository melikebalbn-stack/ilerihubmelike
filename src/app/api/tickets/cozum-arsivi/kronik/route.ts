import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'

/**
 * GET /api/tickets/cozum-arsivi/kronik — kronik (tekrarlayan) sorunlar.
 *
 * ARŞİVDEN FARKI: burası TÜM taleplerden beslenir, çözüm metni yazılmamış
 * olanlar dahil. "Tekrarlıyor ama kimse çözümünü yazmamış" durumu görünsün
 * diye — arşiv sekmesi o talepleri hiç göstermez.
 *
 * GRUPLAMA ANAHTARI: categoryId + zimmetFormuId. Konu metni benzerliğine
 * girilmedi; mevcut veride zimmetFormuId %4 dolu (24 talepte 1), assetInfo ise
 * serbest metin ("İleri Hub" / "İleri hub" / "ileri hub" ayrı satırlar) — yani
 * daha ince bir anahtarı taşıyacak veri yok. Cihaz seçimi yaygınlaştıkça aynı
 * sorgu kendiliğinden keskinleşir; onun için ek şema gerekmiyor.
 *
 * Varsayılan: son 90 gün, en az 3 tekrar (parametreyle değişir).
 */
export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireUser()
    if (error) return error

    const izinler = session.user.permissions ?? []
    const itEkibi =
      izinler.includes('helpdesk.admin') || izinler.includes('helpdesk.ticket.resolve')
    if (!itEkibi) {
      return NextResponse.json({ error: 'Bu rapora erişim yetkiniz yok' }, { status: 403 })
    }

    const sp = request.nextUrl.searchParams
    const gunHam = parseInt(sp.get('gun') || '90', 10)
    const gun = Number.isFinite(gunHam) ? Math.max(7, Math.min(730, gunHam)) : 90
    const esikHam = parseInt(sp.get('esik') || '3', 10)
    const esik = Number.isFinite(esikHam) ? Math.max(2, Math.min(50, esikHam)) : 3
    const categoryId = sp.get('categoryId') || undefined
    const zimmetFormuId = sp.get('zimmetFormuId') || undefined

    const baslangic = new Date()
    baslangic.setDate(baslangic.getDate() - gun)

    const talepler = await prisma.ticket.findMany({
      where: {
        isActive: true,
        createdAt: { gte: baslangic },
        ...(categoryId ? { categoryId } : {}),
        ...(zimmetFormuId ? { zimmetFormuId } : {}),
      },
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        createdAt: true,
        requesterEmail: true,
        categoryId: true,
        category: { select: { name: true, color: true } },
        zimmetFormuId: true,
        assetInfo: true,
        resolutionSummary: true,
        resolvedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    type Grup = {
      anahtar: string
      categoryId: string | null
      kategoriAdi: string
      kategoriRengi: string | null
      zimmetFormuId: string | null
      cihazMetni: string | null
      tekrar: number
      farkliKullanici: number
      sonGorulme: Date
      /** Grupta çözüm metni yazılmış en az bir talep var mı. */
      cozumVar: boolean
      /** Arşivdeki karşılığı — kart tıklanınca oraya gidilsin diye. */
      ornekTicketId: string | null
      basliklar: string[]
    }

    const gruplar = new Map<string, Grup & { kullanicilar: Set<string> }>()

    for (const t of talepler) {
      const key = `${t.categoryId ?? '-'}|${t.zimmetFormuId ?? '-'}`
      let g = gruplar.get(key)
      if (!g) {
        g = {
          anahtar: key,
          categoryId: t.categoryId,
          kategoriAdi: t.category?.name ?? '(kategorisiz)',
          kategoriRengi: t.category?.color ?? null,
          zimmetFormuId: t.zimmetFormuId,
          cihazMetni: t.assetInfo?.trim() || null,
          tekrar: 0,
          farkliKullanici: 0,
          sonGorulme: t.createdAt,
          cozumVar: false,
          ornekTicketId: null,
          basliklar: [],
          kullanicilar: new Set<string>(),
        }
        gruplar.set(key, g)
      }

      g.tekrar++
      g.kullanicilar.add((t.requesterEmail ?? '').toLowerCase().trim())
      if (t.createdAt > g.sonGorulme) g.sonGorulme = t.createdAt
      if (!g.cihazMetni && t.assetInfo?.trim()) g.cihazMetni = t.assetInfo.trim()

      // Çözümü OLAN en güncel talep örnek gösterilir (arşiv detayına köprü).
      if (t.resolutionSummary?.trim()) {
        if (!g.cozumVar) {
          g.cozumVar = true
          g.ornekTicketId = t.id
        }
      }
      // Kartta gösterilecek birkaç konu başlığı — gruplama kaba olduğu için
      // kullanıcı neyin toplandığını görebilsin.
      if (g.basliklar.length < 4 && !g.basliklar.includes(t.subject)) {
        g.basliklar.push(t.subject)
      }
    }

    const sonuc = Array.from(gruplar.values())
      .map(({ kullanicilar, ...g }) => ({ ...g, farkliKullanici: kullanicilar.size }))
      .filter((g) => g.tekrar >= esik)
      .sort((a, b) => b.tekrar - a.tekrar)

    return NextResponse.json({ gun, esik, gruplar: sonuc })
  } catch (error) {
    console.error('Kronik sorunlar hatası:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}
