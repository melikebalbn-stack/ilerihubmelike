import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { getStokSatirlari } from '@/lib/ifs/tuketim'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/depo/parca/{partNo}/stok → parçanın FIFO sıralı TÜM stok satırları (sapma
// yolu alternatif liste). Guard: admin.system.manage. SADECE OKUMA.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ partNo: string }> },
) {
  const { error } = await requirePermission(['depo.terminal.use', 'admin.system.manage'])
  if (error) return error

  const { partNo: ham } = await params
  const partNo = decodeURIComponent(ham).trim()

  try {
    const satirlar = await getStokSatirlari(partNo)
    return NextResponse.json({ ok: true, satirlar })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'IFS verisi alınamadı'
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}
