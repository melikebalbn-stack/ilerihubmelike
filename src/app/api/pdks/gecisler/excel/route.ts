import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { pdksHata } from '@/lib/pdks/cihaz-yonetim'
import { logAuditEvent } from '@/lib/audit-log'
import { gecisExcel } from '@/lib/pdks/gecis-sorgu'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/pdks/gecisler/excel?tarih=&kapiId=&tip=&q= — seçili günün TÜM geçişleri Excel (pdks.view).
// Ekrandaki 500 satır sınırını aşar. KVKK: dosya sunucuda yazılmaz; her indirme denetim kaydı yazar.
export async function GET(req: NextRequest) {
  const { error, userId } = await requirePermission(['pdks.view', 'pdks.manage'])
  if (error) return error
  try {
    const p = req.nextUrl.searchParams
    const { buffer, satir, tarih } = await gecisExcel({ tarih: p.get('tarih'), kapiId: p.get('kapiId'), tip: p.get('tip'), q: p.get('q') })
    await logAuditEvent({ action: 'PDKS_GECIS_EXPORT', actorId: userId, targetType: 'PDKS_GECIS', targetId: tarih, details: { tarih, satir } })
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="pdks-gecisler-${tarih}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    return pdksHata(e, 'Excel oluşturulamadı')
  }
}
