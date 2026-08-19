import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { ZimmetOnayDurumu, ZimmetKaynak } from '@/generated/prisma'
import { dispatchZimmetDevirOnayIstegi } from '@/lib/zimmet/notifications'

export const dynamic = 'force-dynamic'

/**
 * GET /api/zimmet-formu/devir-bildirim-gonder
 *
 * Onay bekleyen devir kayıtlarını sahibe göre gruplayıp bildirim ekranı için aday
 * listesi döner. Yalnız zimmet-formu.approve yetkisi (yetkisiz → 403, UI butonu
 * bu 403'e göre gizlenir).
 *
 * Dönüş: [{ userId, ad, email, kayitSayisi, sonBildirimTarihi }]
 */
export async function GET() {
  const { error } = await requirePermission('zimmet-formu.approve')
  if (error) return error

  const kayitlar = await prisma.zimmetFormu.findMany({
    where: {
      kaynak: ZimmetKaynak.SYTELINE_DEVIR,
      durum: ZimmetOnayDurumu.ONAY_BEKLIYOR,
      silindiMi: false,
    },
    select: {
      zimmetSahibiId: true,
      sonBildirimTarihi: true,
      zimmetSahibi: { select: { id: true, email: true, name: true } },
    },
  })

  const gruplar = new Map<
    string,
    { userId: string; ad: string; email: string; kayitSayisi: number; sonBildirimTarihi: Date | null }
  >()
  for (const z of kayitlar) {
    if (!z.zimmetSahibi?.email) continue
    const g = gruplar.get(z.zimmetSahibiId)
    if (g) {
      g.kayitSayisi += 1
      // Grubun EN YENİ bildirim tarihini göster.
      if (z.sonBildirimTarihi && (!g.sonBildirimTarihi || z.sonBildirimTarihi > g.sonBildirimTarihi)) {
        g.sonBildirimTarihi = z.sonBildirimTarihi
      }
    } else {
      gruplar.set(z.zimmetSahibiId, {
        userId: z.zimmetSahibi.id,
        ad: z.zimmetSahibi.name ?? z.zimmetSahibi.email,
        email: z.zimmetSahibi.email,
        kayitSayisi: 1,
        sonBildirimTarihi: z.sonBildirimTarihi ?? null,
      })
    }
  }

  const liste = [...gruplar.values()].sort((a, b) => a.ad.localeCompare(b.ad, 'tr-TR'))
  return NextResponse.json(liste)
}

/**
 * POST /api/zimmet-formu/devir-bildirim-gonder
 *
 * Onay bekleyen devir kayıtlarını sahibe göre gruplar ve KİŞİ BAŞINA TEK bildirim
 * gönderir; her gruba `sonBildirimTarihi=now` damgalar (PR-5b hatırlatma cron'u
 * bunu kullanır). Yalnız zimmet-formu.approve yetkisi.
 *
 * Body (opsiyonel): { userIds?: string[] } — verilirse SADECE o kişilere gönderir
 * (pilot/kademeli açılım); verilmezse tüm kişiler.
 */
export async function POST(request: NextRequest) {
  const { error } = await requirePermission('zimmet-formu.approve')
  if (error) return error

  let userIds: string[] | null = null
  try {
    const body = (await request.json()) as { userIds?: unknown }
    if (Array.isArray(body?.userIds)) {
      userIds = body.userIds.filter((x): x is string => typeof x === 'string')
    }
  } catch {
    // gövde yok/boş → tüm kişiler (userIds null kalır)
  }

  const kayitlar = await prisma.zimmetFormu.findMany({
    where: {
      kaynak: ZimmetKaynak.SYTELINE_DEVIR,
      durum: ZimmetOnayDurumu.ONAY_BEKLIYOR,
      silindiMi: false,
      ...(userIds ? { zimmetSahibiId: { in: userIds } } : {}),
    },
    select: {
      id: true,
      zimmetSahibiId: true,
      zimmetSahibi: { select: { id: true, email: true, name: true } },
    },
  })

  // zimmetSahibiId'ye göre grupla.
  const gruplar = new Map<string, { kullanici: { id: string; email: string; name: string | null }; ids: string[] }>()
  for (const z of kayitlar) {
    if (!z.zimmetSahibi?.email) continue // bildirilecek gerçek kullanıcı yok — atla
    const g = gruplar.get(z.zimmetSahibiId)
    if (g) {
      g.ids.push(z.id)
    } else {
      gruplar.set(z.zimmetSahibiId, {
        kullanici: { id: z.zimmetSahibi.id, email: z.zimmetSahibi.email, name: z.zimmetSahibi.name },
        ids: [z.id],
      })
    }
  }

  const simdi = new Date()
  let kisi = 0
  let kayit = 0
  const gonderilenler: { userId: string; ad: string; kayitSayisi: number }[] = []
  for (const g of gruplar.values()) {
    kisi += 1
    kayit += g.ids.length
    gonderilenler.push({
      userId: g.kullanici.id,
      ad: g.kullanici.name ?? g.kullanici.email,
      kayitSayisi: g.ids.length,
    })
    void dispatchZimmetDevirOnayIstegi({ kullanici: g.kullanici, kayitSayisi: g.ids.length }).catch(console.error)
    await prisma.zimmetFormu.updateMany({
      where: { id: { in: g.ids } },
      data: { sonBildirimTarihi: simdi },
    })
  }

  return NextResponse.json({ kisi, kayit, gonderilenler })
}
