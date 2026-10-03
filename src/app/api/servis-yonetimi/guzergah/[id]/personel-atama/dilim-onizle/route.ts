import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { topluDilimOnizle } from '@/lib/servis-yonetimi/atama-dilim'
import { atamaDilimHataYaniti, dizi, govdeOku } from '@/lib/servis-yonetimi/atama-dilim-http'

export const dynamic = 'force-dynamic'

// POST /api/servis-yonetimi/guzergah/[id]/personel-atama/dilim-onizle
// Toplu "Dilim Ata" ÖNİZLEMESİ — HİÇBİR ŞEY YAZMAZ: "N atama, dilim X; kapasite etkisi: personel a → b / koltuk k".
// Yetki: servis.edit (operasyonel kayıt anahtarı; atama düzenlemeyle aynı).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission('servis.edit')
  if (error) return error
  const body = await govdeOku(request)
  if (!body) return NextResponse.json({ ok: false, message: 'Geçersiz istek gövdesi.' }, { status: 400 })
  try {
    const { id: guzergahId } = await params
    const data = await topluDilimOnizle(guzergahId, { atamaIdleri: dizi(body.atamaIdleri), dilimIdleri: dizi(body.dilimIdleri) })
    return NextResponse.json({ ok: true, data })
  } catch (err) {
    return atamaDilimHataYaniti(err, 'Önizleme alınamadı.')
  }
}
