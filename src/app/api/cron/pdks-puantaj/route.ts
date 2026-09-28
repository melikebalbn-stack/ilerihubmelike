import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { araligiHesapla, bugunStr, gunEkle } from '@/lib/pdks/puantaj-servis'
import { erkenDonusTara } from '@/lib/izin/erken-donus'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/cron/pdks-puantaj — gece 04:00: dün + son 7 gün puantajı yeniden hesaplar (kilitli günler
// atlanır). x-cron-secret korumalı; ?gunSayisi=N (1-31) ile pencere değiştirilebilir.
// CRON: henüz crontab'a EKLENMEDİ.
let calisiyor = false

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (calisiyor) return NextResponse.json({ ok: true, noop: true, sebep: 'önceki tur sürüyor' })
  calisiyor = true
  try {
    const n = Math.min(31, Math.max(1, Number(req.nextUrl.searchParams.get('gunSayisi')) || 8))
    const bugun = bugunStr()
    const ozet = await araligiHesapla(prisma, gunEkle(bugun, -n), gunEkle(bugun, -1))
    for (const g of ozet) {
      console.log(`[pdks-puantaj] ${g.gun} hesaplanan=${g.hesaplanan} yazilan=${g.yazilan} kilitli=${g.kilitliAtlanan} vardiyasiz=${g.vardiyasiz.length}`)
      if (g.vardiyasiz.length) console.warn(`[pdks-puantaj] ${g.gun} VARDİYASIZ (varsayılan vardiya yok): ${g.vardiyasiz.join(',')}`)
    }
    // İzin Faz 4: erken dönüş taraması (izinli günde geçiş → İV kuyruğu). Hata puantajı düşürmez.
    let erkenDonus: { yeni: number } | { hata: string }
    try {
      erkenDonus = await erkenDonusTara()
      if ('yeni' in erkenDonus && erkenDonus.yeni) console.log(`[pdks-puantaj] erken dönüş: ${erkenDonus.yeni} yeni kayıt İV kuyruğunda`)
    } catch (e) {
      console.error('[pdks-puantaj] erken dönüş taraması hata', e)
      erkenDonus = { hata: 'tarama hata' }
    }
    return NextResponse.json({ ok: true, gunler: ozet, erkenDonus })
  } catch (e) {
    console.error('[pdks-puantaj] cron hata', e)
    return NextResponse.json({ ok: false, error: 'puantaj hata' }, { status: 500 })
  } finally {
    calisiyor = false
  }
}
