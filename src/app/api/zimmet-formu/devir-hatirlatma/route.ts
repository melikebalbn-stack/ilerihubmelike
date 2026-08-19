import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ZimmetOnayDurumu, ZimmetKaynak } from '@/generated/prisma'
import { dispatchZimmetDevirOnayIstegi } from '@/lib/zimmet/notifications'

export const dynamic = 'force-dynamic'

const HATIRLATMA_ESIGI_MS = 7 * 24 * 60 * 60 * 1000 // 7 gün

/**
 * GET /api/zimmet-formu/devir-hatirlatma  (cron ucu, x-cron-secret ile auth)
 *
 * İlk bildirimden bu yana 7 gün geçmiş ama hâlâ ONAY_BEKLIYOR olan devir
 * kayıtlarının sahiplerine haftalık hatırlatma. sonBildirimTarihi NULL olanlar
 * ATLANIR (hiç bildirilmemiş — ilk gönderim manuel, devir-bildirim-gonder ile).
 * Kişi başına TEK hatırlatma; sonBildirimTarihi=now damgalanır.
 */
export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const esik = new Date(Date.now() - HATIRLATMA_ESIGI_MS)

  const kayitlar = await prisma.zimmetFormu.findMany({
    where: {
      kaynak: ZimmetKaynak.SYTELINE_DEVIR,
      durum: ZimmetOnayDurumu.ONAY_BEKLIYOR,
      silindiMi: false,
      // lt otomatik olarak NULL'ları hariç tutar → hiç bildirilmemişler atlanır.
      sonBildirimTarihi: { lt: esik },
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
    if (!z.zimmetSahibi?.email) continue
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
  let hatirlatilanKisi = 0
  let kayit = 0
  for (const g of gruplar.values()) {
    hatirlatilanKisi += 1
    kayit += g.ids.length
    void dispatchZimmetDevirOnayIstegi({ kullanici: g.kullanici, kayitSayisi: g.ids.length }).catch(console.error)
    await prisma.zimmetFormu.updateMany({
      where: { id: { in: g.ids } },
      data: { sonBildirimTarihi: simdi },
    })
  }

  return NextResponse.json({ hatirlatilanKisi, kayit })
}
