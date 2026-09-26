import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { mutabakatCalistir, senkronCalistir } from '@/lib/pdks/senkron'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/cron/pdks-senkron — PDKS Hub → panel kart senkronu (plan §3.2). x-cron-secret korumalı
// (deaktive-ayrilan / ifs-personel-sync deseni). GET YOK — yazma yapan uç yalnız POST.
//
// Her tur: pasif personel kart süpürmesi → defter tamamlama → SILINECEK önce, sonra BEKLIYOR.
// Aktif Hikvision cihaz yoksa NO-OP (200 + noop:true). ?mutabakat=1 → turdan sonra panel kart
// listesi Hub ile karşılaştırılır (gece bir kez), sonuç /pdks/kartlar uyarı şeridine düşer.
//
// CRON: henüz crontab'a EKLENMEDİ — cihaz gelince eklenecek (dakikada bir + 03:30 mutabakat).
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const ozet = await senkronCalistir(prisma)
    const mutabakat =
      req.nextUrl.searchParams.get('mutabakat') === '1' && !ozet.noop ? await mutabakatCalistir(prisma) : undefined
    console.log(
      `[pdks-senkron] noop=${ozet.noop}${ozet.sebep ? ` (${ozet.sebep})` : ''} cihaz=${ozet.cihaz} ` +
        `islenen=${ozet.islenen} yuklendi=${ozet.yuklendi} silindi=${ozet.silindi} hata=${ozet.hata} ` +
        `kalici=${ozet.kaliciHata} supurme=${ozet.supurme.adet}${ozet.supurme.abortedLimit ? ' (GÜVENLİK AĞI — iptal)' : ''}`,
    )
    return NextResponse.json({
      ok: !ozet.supurme.abortedLimit,
      ...ozet,
      ...(mutabakat
        ? {
            mutabakat: mutabakat.cihazlar.map((c) => ({
              kod: c.kod, panelde: c.panelde, hubdaTanimsiz: c.hubdaTanimsiz.length, paneldeEksik: c.paneldeEksik.length, hata: c.hata,
            })),
          }
        : {}),
    })
  } catch (e) {
    console.error('[pdks-senkron] cron hata', e)
    return NextResponse.json({ ok: false, error: 'pdks senkron hata' }, { status: 500 })
  }
}
