import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { listDurusSebepleri, createDurusSebebi, type DurusSebebiGirdi } from '@/lib/ipro/yonetim-service'
import { iproHata, zorunluMetin, istekHatasi } from '@/lib/ipro/yonetim-hata'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const { error } = await requirePermission(['ipro.view', 'ipro.admin'])
  if (error) return error
  try {
    return NextResponse.json({ ok: true, sebepler: await listDurusSebepleri() })
  } catch (e) {
    return iproHata(e, 'Duruş sebepleri alınamadı')
  }
}

export async function POST(request: Request) {
  const { error } = await requirePermission('ipro.admin')
  if (error) return error
  try {
    const b = await request.json()
    const data: DurusSebebiGirdi = {
      kod: zorunluMetin(b?.kod, 'Kod'),
      ad: zorunluMetin(b?.ad, 'Ad'),
      bitisTipi: zorunluMetin(b?.bitisTipi, 'Bitiş Tipi'),
      erpKodu: b?.erpKodu || null,
      tipId: b?.tipId || null,
      renkKodu: b?.renkKodu || null,
      temelSebep: b?.temelSebep || null,
      planli: Boolean(b?.planli),
      uretimDisi: Boolean(b?.uretimDisi),
      setupDurusu: Boolean(b?.setupDurusu),
      plcKilitle: Boolean(b?.plcKilitle),
      askiyaAl: Boolean(b?.askiyaAl),
      makineKaynakli: Boolean(b?.makineKaynakli),
      operatorKaynakli: Boolean(b?.operatorKaynakli),
      yetkiliOnayGerekli: Boolean(b?.yetkiliOnayGerekli),
      durusAktifkenIsBitirilemez: Boolean(b?.durusAktifkenIsBitirilemez),
      uretimdeGosterilsin: b?.uretimdeGosterilsin === undefined ? true : Boolean(b.uretimdeGosterilsin),
      aktif: b?.aktif === undefined ? true : Boolean(b.aktif),
    }
    return NextResponse.json({ ok: true, sebep: await createDurusSebebi(data) }, { status: 201 })
  } catch (e) {
    return istekHatasi(e) ?? iproHata(e, 'Duruş sebebi eklenemedi')
  }
}
