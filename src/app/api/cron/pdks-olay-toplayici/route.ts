import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { IsapiHata, kimlikTanimliMi } from '@/lib/pdks/isapi-istemci'
import { olayEslemesiOku, prismaOlayDeposu } from '@/lib/pdks/olay-depo'
import { toplayiciTuru, type ToplayiciOzeti } from '@/lib/pdks/toplayici'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/cron/pdks-olay-toplayici — AcsEvent boşluk doldurma (plan §3.1). x-cron-secret korumalı.
// Push birincil; bu tur dakikada bir panel günlüğünden kaçanları yazar, imleci ilerletir, 10 dk'da bir
// panel saatini ölçer. 24 saatte doldurulamayan delik → KAYIP uyarısı (log + SystemSetting).
// Aktif Hikvision cihaz yoksa NO-OP. CRON: henüz crontab'a EKLENMEDİ — cihaz gelince (dakikada bir).
let calisiyor = false

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (calisiyor) return NextResponse.json({ ok: true, noop: true, sebep: 'önceki tur sürüyor' })
  calisiyor = true
  try {
    const cihazlar = (
      await prisma.pdksCihaz.findMany({
        where: { aktif: true, marka: 'HIKVISION' },
        select: { id: true, kod: true, host: true, envOnek: true, seriDonem: true, sonSeriNo: true, saatKontrolAt: true },
      })
    ).filter((c) => kimlikTanimliMi(c.envOnek))
    if (!cihazlar.length) {
      return NextResponse.json({ ok: true, noop: true, sebep: 'aktif Hikvision cihaz yok (ya da env kimlik bilgisi tanımlı değil)' })
    }
    const depo = prismaOlayDeposu(prisma)
    const esleme = await olayEslemesiOku(prisma)
    const sonuc: (ToplayiciOzeti | { cihaz: string; hata: string })[] = []
    for (const c of cihazlar) {
      try {
        const oz = await toplayiciTuru(depo, c, esleme)
        sonuc.push(oz)
        console.log(
          `[pdks-olay-toplayici] ${c.kod} alinan=${oz.islem.alinan} eklenen=${oz.islem.eklenen} tekrar=${oz.islem.tekrar} ` +
            `imlec=${oz.imlec.imlec} bekleyen=${oz.imlec.bekleyenBosluk} kayip=${oz.imlec.kayiplar.length} sayfa=${oz.sayfa}`,
        )
        for (const u of oz.uyarilar) console.warn(`[pdks-olay-toplayici] ${u}`)
      } catch (e) {
        const mesaj = e instanceof IsapiHata ? `${e.kod}: ${e.message}` : 'beklenmeyen hata'
        if (!(e instanceof IsapiHata)) console.error('[pdks-olay-toplayici]', c.kod, e)
        else console.warn(`[pdks-olay-toplayici] ${c.kod} ${mesaj}`)
        sonuc.push({ cihaz: c.kod, hata: mesaj })
      }
    }
    return NextResponse.json({
      ok: sonuc.every((s) => !('hata' in s)),
      cihazlar: sonuc.map((s) =>
        'hata' in s
          ? s
          : { cihaz: s.cihaz, alinan: s.islem.alinan, eklenen: s.islem.eklenen, tekrar: s.islem.tekrar, imlec: s.imlec.imlec,
              bekleyenBosluk: s.imlec.bekleyenBosluk, kayipBosluk: s.imlec.kayiplar.length, saatSapmaSn: s.saatSapmaSn, uyarilar: s.uyarilar },
      ),
    })
  } catch (e) {
    console.error('[pdks-olay-toplayici] cron hata', e)
    return NextResponse.json({ ok: false, error: 'toplayıcı hata' }, { status: 500 })
  } finally {
    calisiyor = false
  }
}
