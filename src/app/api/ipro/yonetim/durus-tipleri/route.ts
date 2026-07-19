import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { listDurusTipleri, createDurusTipi } from '@/lib/ipro/yonetim-service'
import { iproHata, zorunluMetin, istekHatasi } from '@/lib/ipro/yonetim-hata'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const { error } = await requirePermission(['ipro.view', 'ipro.admin'])
  if (error) return error
  try {
    return NextResponse.json({ ok: true, tipler: await listDurusTipleri() })
  } catch (e) {
    return iproHata(e, 'Duruş tipleri alınamadı')
  }
}

export async function POST(request: Request) {
  const { error } = await requirePermission('ipro.admin')
  if (error) return error
  try {
    const b = await request.json()
    const tip = await createDurusTipi({
      kod: zorunluMetin(b?.kod, 'Kod'),
      ad: zorunluMetin(b?.ad, 'Ad'),
      teepOrder: b?.teepOrder === undefined || b.teepOrder === null || b.teepOrder === '' ? null : Number(b.teepOrder),
      aktif: b?.aktif === undefined ? true : Boolean(b.aktif),
    })
    return NextResponse.json({ ok: true, tip }, { status: 201 })
  } catch (e) {
    return istekHatasi(e) ?? iproHata(e, 'Duruş tipi eklenemedi')
  }
}
