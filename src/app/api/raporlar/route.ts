import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { getUserPermissions } from '@/lib/auth/get-user-permissions'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { icerikTuru } from '@/lib/rapor/tipler'
import { KATEGORILER, KATEGORISIZ, kategoriEtiketi } from '@/lib/rapor/kategoriler'

export const dynamic = 'force-dynamic'

/**
 * GET /api/raporlar — rapor şablonu listesi.
 * rapor.view: YAYINDA olanlar. rapor.tasarla da varsa TASLAK'lar da gelir (durum alanıyla).
 *
 * 07.10.2026: listeye `sahip` (şablonu oluşturan) ve `sonCalistirma` (TÜM kullanıcılar
 * arasında en son başarılı koşu) eklendi — ekranda görünen tarih veri setinin değil
 * raporun tarihi olsun diye. Kategori artık serbest metin değil, lib/rapor/kategoriler
 * üzerinden kanonik ada eşlenir ("Satın Alma" ve "Satınalma" tek grup).
 */
export async function GET() {
  const { userId, error } = await requirePermission(PERMISSION_KEYS.RAPOR_VIEW)
  if (error) return error

  const perms = await getUserPermissions(userId)
  const tasarlayabilir = perms.has(PERMISSION_KEYS.RAPOR_TASARLA)

  const sablonlar = await prisma.raporSablon.findMany({
    where: { durum: tasarlayabilir ? { in: ['YAYINDA', 'TASLAK'] } : 'YAYINDA' },
    select: {
      id: true, kod: true, ad: true, aciklama: true, durum: true, guncellenme: true, icerik: true,
      veriSeti: { select: { ad: true } },
      olusturan: { select: { name: true } },
    },
    orderBy: [{ durum: 'asc' }, { ad: 'asc' }],
  })

  // Son çalıştırma: şablon başına en yeni başarılı koşu (kim çalıştırdıysa).
  // Tek groupBy — şablon sayısı kadar sorgu atılmaz.
  const sonKosuGruplari = await prisma.raporCalistirma.groupBy({
    by: ['sablonId'],
    where: { hata: null },
    _max: { olusturma: true },
  })
  const sonKosuHaritasi = new Map(sonKosuGruplari.map((g) => [g.sablonId, g._max.olusturma]))

  const liste = sablonlar.map(({ icerik, veriSeti, olusturan, ...s }) => ({
    ...s,
    tur: icerikTuru(icerik),
    kategori: kategoriEtiketi((icerik as { kategori?: string } | null)?.kategori),
    veriSetiAd: veriSeti.ad,
    sahip: olusturan?.name ?? null,
    sonCalistirma: sonKosuHaritasi.get(s.id) ?? null,
  }))

  // Son çalıştırdıklarım: bu kullanıcının en yeni 5 FARKLI raporu (yalnız listede görünenler).
  const gorunen = new Set(liste.map((s) => s.id))
  const sonKosumlar = await prisma.raporCalistirma.findMany({ where: { calistiranId: userId, hata: null }, select: { sablonId: true, olusturma: true }, orderBy: { olusturma: 'desc' }, take: 60 })
  const sonCalistirdiklarim: { id: string; olusturma: Date }[] = []
  for (const k of sonKosumlar) { if (gorunen.has(k.sablonId) && !sonCalistirdiklarim.some((x) => x.id === k.sablonId)) sonCalistirdiklarim.push({ id: k.sablonId, olusturma: k.olusturma }); if (sonCalistirdiklarim.length >= 5) break }
  // Kategori listesi SABİT sırayla döner (KATEGORILER), yalnız raporu olanlar;
  // eşleşmeyenler varsa en sona "Diğer".
  const kullanilan = new Set(liste.map((s) => s.kategori))
  const kategoriler: string[] = [
    ...KATEGORILER.filter((k) => kullanilan.has(k)),
    ...(kullanilan.has(KATEGORISIZ) ? [KATEGORISIZ] : []),
  ]

  return NextResponse.json({ sablonlar: liste, tasarlayabilir, sonCalistirdiklarim, kategoriler, kullaniciId: userId })
}
