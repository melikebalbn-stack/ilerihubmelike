import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { logAuditEvent } from '@/lib/audit-log'
import { bakiyeExcel, bakiyeListesi, izinHata, type BakiyeFiltre } from '@/lib/izin/yonetim'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/izin/bakiyeler?durum=AKTIF|AYRILAN&departmentId=&q=&yakinda=1 — İV bakiye tablosu + 4 özet (izin.admin)
// GET ...&format=xlsx — aynı filtreyle Excel (denetim kaydı yazılır; dosya sunucuda SAKLANMAZ)
export async function GET(req: NextRequest) {
  const { error, userId } = await requirePermission(['izin.admin', 'izin.bakiye.admin'])
  if (error) return error
  try {
    const p = req.nextUrl.searchParams
    const f: BakiyeFiltre = {
      durum: p.get('durum') === 'AYRILAN' ? 'AYRILAN' : 'AKTIF',
      departmentId: p.get('departmentId') || null,
      q: p.get('q'),
      yakinda: p.get('yakinda') === '1',
    }
    if (p.get('format') === 'xlsx') {
      const { buffer, satir } = await bakiyeExcel(f)
      await logAuditEvent({ action: 'IZIN_BAKIYE_EXPORT', actorId: userId, targetType: 'IZIN_BAKIYE', details: { ...f, satir } })
      const ad = `izin-bakiyeleri-${f.durum === 'AYRILAN' ? 'ayrilanlar-' : ''}${new Date().toISOString().slice(0, 10)}.xlsx`
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${ad}"`,
          'Cache-Control': 'no-store',
        },
      })
    }
    return NextResponse.json({ ok: true, ...(await bakiyeListesi(f)) })
  } catch (e) {
    return izinHata(e, 'Bakiyeler alınamadı')
  }
}
