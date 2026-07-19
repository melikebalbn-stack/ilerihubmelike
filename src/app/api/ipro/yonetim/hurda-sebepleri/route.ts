import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { listHurdaSebepleri, createHurdaSebebi, type HurdaSebebiGirdi } from '@/lib/ipro/yonetim-service'
import { iproHata, zorunluMetin, istekHatasi } from '@/lib/ipro/yonetim-hata'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const { error } = await requirePermission(['ipro.view', 'ipro.admin'])
  if (error) return error
  try {
    return NextResponse.json({ ok: true, sebepler: await listHurdaSebepleri() })
  } catch (e) {
    return iproHata(e, 'Hurda sebepleri alınamadı')
  }
}

export async function POST(request: Request) {
  const { error } = await requirePermission('ipro.admin')
  if (error) return error
  try {
    const b = await request.json()
    const data: HurdaSebebiGirdi = {
      kod: zorunluMetin(b?.kod, 'Kod'),
      ad: zorunluMetin(b?.ad, 'Ad'),
      erpKodu: b?.erpKodu || null,
      grupKodu: b?.grupKodu || null,
      grubu: b?.grubu || null,
      uretimHurdaRework: Boolean(b?.uretimHurdaRework),
      rework: Boolean(b?.rework),
      hurda: b?.hurda === undefined ? true : Boolean(b.hurda),
      bilesenHurdaRework: Boolean(b?.bilesenHurdaRework),
      oeeEtkiler: b?.oeeEtkiler === undefined ? true : Boolean(b.oeeEtkiler),
      yorumZorunlu: Boolean(b?.yorumZorunlu),
      sinyalsizGiris: Boolean(b?.sinyalsizGiris),
      aktif: b?.aktif === undefined ? true : Boolean(b.aktif),
    }
    return NextResponse.json({ ok: true, sebep: await createHurdaSebebi(data) }, { status: 201 })
  } catch (e) {
    return istekHatasi(e) ?? iproHata(e, 'Hurda sebebi eklenemedi')
  }
}
