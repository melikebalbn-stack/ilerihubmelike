import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { panoData } from '@/lib/ipro/izleme-service'
import { iproHata } from '@/lib/ipro/yonetim-hata'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/ipro/oee-pano → GERİYE UYUM. İzleme paneliyle birleşti; artık izleme-service'in
// panoData({ oee:true }) çıktısını eski OEE pano şekline (hat/ozet) map ederek döndürür.
// UI /ipro/oee → /ipro/izleme?g=oee'ye yönlendirir; bu uç yalnız eski istemciler için sağ kalır.
export async function GET() {
  const { error } = await requirePermission(['ipro.view', 'ipro.admin'])
  if (error) return error
  try {
    const d = await panoData({ oee: true })
    return NextResponse.json({
      ok: true,
      olusturuldu: d.olusturuldu,
      esik: d.esik,
      tezgahlar: d.tezgahlar.map((t) => ({
        id: t.id,
        kod: t.kod,
        ad: t.ad,
        hat: t.masGrupAdi,
        sinyalli: t.sinyalli,
        durum: t.durum,
        calisan: t.calisan,
        canliOee: t.canliOee ?? null,
      })),
      ozet: {
        toplam: d.tezgahlar.length,
        calisiyor: d.ozet.calisiyor,
        durusta: d.ozet.durusta,
        bosta: d.ozet.bosta,
        aktifOperator: d.ozet.aktifOperator,
      },
    })
  } catch (e) {
    return iproHata(e, 'OEE pano verisi alınamadı')
  }
}
