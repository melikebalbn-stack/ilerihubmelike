import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { getUserPermissions } from '@/lib/auth/get-user-permissions'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { icerikTuru } from '@/lib/rapor/tipler'

export const dynamic = 'force-dynamic'

/**
 * GET /api/raporlar — rapor şablonu listesi.
 * rapor.view: YAYINDA olanlar. rapor.tasarla da varsa TASLAK'lar da gelir (durum alanıyla).
 */
export async function GET() {
  const { userId, error } = await requirePermission(PERMISSION_KEYS.RAPOR_VIEW)
  if (error) return error

  const perms = await getUserPermissions(userId)
  const tasarlayabilir = perms.has(PERMISSION_KEYS.RAPOR_TASARLA)

  const sablonlar = await prisma.raporSablon.findMany({
    where: { durum: tasarlayabilir ? { in: ['YAYINDA', 'TASLAK'] } : 'YAYINDA' },
    select: { id: true, kod: true, ad: true, aciklama: true, durum: true, guncellenme: true, icerik: true, veriSeti: { select: { ad: true } } },
    orderBy: [{ durum: 'asc' }, { ad: 'asc' }],
  })
  const liste = sablonlar.map(({ icerik, veriSeti, ...s }) => ({ ...s, tur: icerikTuru(icerik), kategori: ((icerik as { kategori?: string } | null)?.kategori ?? '').trim() || null, veriSetiAd: veriSeti.ad }))

  // Son çalıştırdıklarım: bu kullanıcının en yeni 5 FARKLI raporu (yalnız listede görünenler).
  const gorunen = new Set(liste.map((s) => s.id))
  const sonKosumlar = await prisma.raporCalistirma.findMany({ where: { calistiranId: userId, hata: null }, select: { sablonId: true, olusturma: true }, orderBy: { olusturma: 'desc' }, take: 60 })
  const sonCalistirdiklarim: { id: string; olusturma: Date }[] = []
  for (const k of sonKosumlar) { if (gorunen.has(k.sablonId) && !sonCalistirdiklarim.some((x) => x.id === k.sablonId)) sonCalistirdiklarim.push({ id: k.sablonId, olusturma: k.olusturma }); if (sonCalistirdiklarim.length >= 5) break }
  const kategoriler = [...new Set(liste.map((s) => s.kategori).filter((k): k is string => !!k))].sort((a, b) => a.localeCompare(b, 'tr-TR'))

  return NextResponse.json({ sablonlar: liste, tasarlayabilir, sonCalistirdiklarim, kategoriler, kullaniciId: userId })
}
