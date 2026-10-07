import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hikPushXmlToJson, imleciIlerlet, olaylariIsle, pushGovdesiCoz, pushYetkisi } from '@/lib/pdks/olay-alim'
import { olayEslemesiOku, prismaOlayDeposu } from '@/lib/pdks/olay-depo'

const MAKS_GOVDE = 256 * 1024

// Hikvision HTTP event push (httpHosts) ortak işleyicisi. İki uç kullanır:
//   POST /api/pdks/olay?t=<sır>        — query (manuel/test)
//   POST /api/pdks/olay/<sır>          — path   (panel; DS-K2604T url alanı query kabul etmez)
// Kimlik: kaynak IP (nginx X-Real-IP — Next yalnız 127.0.0.1'de dinler) aktif bir Hikvision
// cihazının host'u OLMALI + sır sabit zamanlı eşleşmeli. Başarısız istek 401/503 + log (sır ASLA).
// Yanıt hızlı 200: panel yanıtı bekler. Kaçan olayı AcsEvent turu doldurur.
export async function pushOlayIsle(req: NextRequest, sir: string | null): Promise<NextResponse> {
  const ip = req.headers.get('x-real-ip')
  const cihazlar = await prisma.pdksCihaz.findMany({
    where: { aktif: true, marka: 'HIKVISION' },
    select: { id: true, kod: true, host: true, seriDonem: true, sonSeriNo: true },
  })
  const y = pushYetkisi({ ip, token: sir, sir: process.env.PDKS_PUSH_SECRET, cihazlar })
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
    // Parça JSON ise doğrudan, XML (Hikvision EventNotificationAlert) ise JSON'a çevrilerek eklenir.
    const parcaEkle = (s: string) => {
      const t = s.trim()
      if (t.startsWith('{')) parcalar.push(s)
      else if (t.startsWith('<')) {
        const j = hikPushXmlToJson(t)
        if (j) parcalar.push(j)
      }
    }
    if (/multipart\/form-data/i.test(tip)) {
      const fd = await req.formData()
      for (const [, v] of fd.entries()) {
        const s = typeof v === 'string' ? v : await v.text()
        parcaEkle(s)
      }
    } else {
      const s = await req.text()
      if (s.length > MAKS_GOVDE) return NextResponse.json({ ok: false }, { status: 413 })
      if (s.trim()) parcaEkle(s)
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
