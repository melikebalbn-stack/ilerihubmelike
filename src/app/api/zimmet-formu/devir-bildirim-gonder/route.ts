import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { ZimmetOnayDurumu, ZimmetKaynak } from '@/generated/prisma'
import { dispatchZimmetDevirOnayIstegi } from '@/lib/zimmet/notifications'

export const dynamic = 'force-dynamic'

/**
 * POST /api/zimmet-formu/devir-bildirim-gonder
 *
 * Onay bekleyen tüm devir kayıtlarını sahibe göre gruplar ve KİŞİ BAŞINA TEK
 * bildirim gönderir; her gruba `sonBildirimTarihi=now` damgalar (PR-5b hatırlatma
 * cron'u bunu kullanır). Yalnız zimmet-formu.approve yetkisi.
 */
export async function POST() {
  const { error } = await requirePermission('zimmet-formu.approve')
  if (error) return error

  const kayitlar = await prisma.zimmetFormu.findMany({
    where: {
      kaynak: ZimmetKaynak.SYTELINE_DEVIR,
      durum: ZimmetOnayDurumu.ONAY_BEKLIYOR,
      silindiMi: false,
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
  for (const g of gruplar.values()) {
    kisi += 1
    kayit += g.ids.length
    void dispatchZimmetDevirOnayIstegi({ kullanici: g.kullanici, kayitSayisi: g.ids.length }).catch(console.error)
    await prisma.zimmetFormu.updateMany({
      where: { id: { in: g.ids } },
      data: { sonBildirimTarihi: simdi },
    })
  }

  return NextResponse.json({ kisi, kayit })
}
