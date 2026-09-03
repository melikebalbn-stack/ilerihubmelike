import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { tezgahDetay } from '@/lib/ipro/izleme-service'
import { prisma } from '@/lib/prisma'
import { iproHata } from '@/lib/ipro/yonetim-hata'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/terminal/uretim/tezgah/[id] → tek tezgah detayı (terminal kart tıklaması
// → dialog). İzleme panosunun /api/ipro/izleme/tezgah/[id] route'unun TERMINAL İKİZİ:
// aynı tezgahDetay(id) servisini + aynı guard'ı (ipro.view | ipro.admin) kullanır.
// id = ipro_tezgah.id (page.tsx iproId olarak geçirir). SALT OKUMA.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission(['ipro.view', 'ipro.admin'])
  if (error) return error
  try {
    const { id } = await params
    const detay = await tezgahDetay(id)
    if (!detay) return NextResponse.json({ ok: false, error: 'Tezgah bulunamadı' }, { status: 404 })

    // AÇIK işte canlı üretim — iş penceresinde Σdelta + son sinyal. TEK sorgu.
    // izleme-service/is-bitir'deki isPenceresiDeltaToplami mantığının aynısı; o dosyalara
    // DOKUNMADAN burada kuruldu (SALT OKUMA, toplu). adet::int (BigInt önlenir).
    // seriVar=false → hiç delta yok (modal "sinyal gelmedi" der, sessiz 0 değil).
    let canliUretim: { adet: number; seriVar: boolean; sonSinyal: string | null } | null = null
    if (detay.aktifIs?.baslatildiAt) {
      try {
        const bas = new Date(detay.aktifIs.baslatildiAt)
        const rows = await prisma.$queryRaw<{ toplam: number; seri: number; son: Date | null }[]>`
          SELECT COALESCE(SUM(delta) FILTER (WHERE ts >= ${bas}), 0)::int AS toplam,
                 COUNT(*) FILTER (WHERE ts >= ${bas})::int AS seri,
                 MAX(ts) AS son
          FROM ipro_sayac_okuma WHERE "tezgahKod" = ${detay.kod}
        `
        const r = rows[0]
        canliUretim = {
          adet: Number(r?.toplam ?? 0),
          seriVar: Number(r?.seri ?? 0) > 0,
          sonSinyal: r?.son ? new Date(r.son).toISOString() : null,
        }
      } catch {
        // Canlı üretim alınamadı → null; modal mevcut gerceklesen davranışına düşer.
      }
    }

    return NextResponse.json({ ok: true, ...detay, canliUretim })
  } catch (e) {
    return iproHata(e, 'Tezgah detayı alınamadı')
  }
}
