import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { imleciIlerlet, olaylariIsle, pushGovdesiCoz, pushYetkisi } from '@/lib/pdks/olay-alim'
import { olayEslemesiOku, prismaOlayDeposu } from '@/lib/pdks/olay-depo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAKS_GOVDE = 256 * 1024

// POST /api/pdks/olay?t=<PDKS_PUSH_SECRET> — Hikvision HTTP event push (httpHosts). Oturumsuz uç
// (middleware matcher'da /api yok). Kimlik: kaynak IP (nginx X-Real-IP — Next yalnız 127.0.0.1'de
// dinler) aktif bir Hikvision cihazının host'u OLMALI + URL sırrı sabit zamanlı eşleşmeli. Başarısız
// istek 401 + log (IP ve sebep; sır ASLA). nginx'te bu location için access_log off (sır URL'de).
// Yanıt hızlı 200: panel yanıtı bekler, yavaşlarsa kuyruğa alır. Kaçan olayı AcsEvent turu doldurur.
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-real-ip')
  const cihazlar = await prisma.pdksCihaz.findMany({
    where: { aktif: true, marka: 'HIKVISION' },
    select: { id: true, kod: true, host: true, seriDonem: true, sonSeriNo: true },
  })
  const y = pushYetkisi({ ip, token: req.nextUrl.searchParams.get('t'), sir: process.env.PDKS_PUSH_SECRET, cihazlar })
  if (!y.ok) {
    console.warn(`[pdks-olay] ${y.durum} ip=${ip ?? '?'} sebep=${y.sebep}`)
    return NextResponse.json({ ok: false }, { status: y.durum })
  }
  const uzunluk = Number(req.headers.get('content-length') ?? '0')
  if (uzunluk > MAKS_GOVDE) {
    console.warn(`[pdks-olay] 413 ${y.cihaz.kod} gövde ${uzunluk} bayt`)
    return NextResponse.json({ ok: false }, { status: 413 })
  }

  try {
    const tip = req.headers.get('content-type') ?? ''
    const parcalar: string[] = []
    if (/multipart\/form-data/i.test(tip)) {
      const fd = await req.formData()
      for (const [, v] of fd.entries()) {
        const s = typeof v === 'string' ? v : await v.text()
        if (s.trim().startsWith('{')) parcalar.push(s)
      }
    } else {
      const s = await req.text()
      if (s.length > MAKS_GOVDE) return NextResponse.json({ ok: false }, { status: 413 })
      if (s.trim()) parcalar.push(s)
    }

    const c = pushGovdesiCoz(parcalar)
    const cihaz = cihazlar.find((x) => x.id === y.cihaz.id)!
    const depo = prismaOlayDeposu(prisma)
    const simdi = new Date()
    await depo.cihazGuncelle(cihaz.id, { sonPushAt: simdi, sonGorulmeAt: simdi })
    if (c.olaylar.length) {
      const islem = await olaylariIsle(depo, cihaz, c.olaylar, { kaynak: 'PUSH', esleme: await olayEslemesiOku(prisma), simdi })
      await imleciIlerlet(depo, cihaz, simdi)
      for (const u of islem.uyarilar) console.warn(`[pdks-olay] ${u}`)
    }
    if (c.atlanan) console.warn(`[pdks-olay] ${cihaz.kod}: ${c.atlanan} parça ayrıştırılamadı`)
    return NextResponse.json({ ok: true })
  } catch (e) {
    // Panel 200 almazsa tekrar dener; olay kaybolmaz (AcsEvent turu da doldurur).
    console.error('[pdks-olay] işleme hatası', y.cihaz.kod, e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
