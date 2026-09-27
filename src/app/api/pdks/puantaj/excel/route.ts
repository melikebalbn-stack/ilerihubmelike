import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { pdksHata } from '@/lib/pdks/cihaz-yonetim'
import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit-log'
import { PdksGirdiHatasi } from '@/lib/pdks/cihaz-yonetim'
import { GUN_DESENI, gunEkle, puantajExcel } from '@/lib/pdks/puantaj-servis'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/pdks/puantaj/excel?gun=YYYY-MM-DD | ?ay=YYYY-MM [&departmentId=] — Excel (pdks.view).
// KVKK: sunucuda DOSYA YAZILMAZ, yanıt olarak indirilir; her indirme denetim kaydı yazar.
export async function GET(req: NextRequest) {
  const { error, userId } = await requirePermission(['pdks.view', 'pdks.manage'])
  if (error) return error
  try {
    const p = req.nextUrl.searchParams
    let bas: string, bit: string, ad: string
    const ay = p.get('ay'), gun = p.get('gun')
    if (ay && /^\d{4}-\d{2}$/.test(ay)) {
      bas = `${ay}-01`
      bit = gunEkle(gunEkle(`${ay}-28`, 4).slice(0, 7) + '-01', -1)
      ad = `pdks-puantaj-${ay}.xlsx`
    } else if (gun && GUN_DESENI.test(gun)) {
      bas = bit = gun
      ad = `pdks-puantaj-${gun}.xlsx`
    } else throw new PdksGirdiHatasi('gun=YYYY-MM-DD ya da ay=YYYY-MM gerekli')
    const departmentId = p.get('departmentId')
    const { buffer, satir } = await puantajExcel(prisma, bas, bit, departmentId)
    await logAuditEvent({ action: 'PDKS_PUANTAJ_EXPORT', actorId: userId, targetType: 'PDKS_PUANTAJ', targetId: `${bas}..${bit}`, details: { bas, bit, departmentId, satir } })
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${ad}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    return pdksHata(e, 'Excel oluşturulamadı')
  }
}
