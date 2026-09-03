import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiBadRequest } from '@/lib/api-response'
import { getShopOrderOperations } from '@/lib/ifs/shop-order-operations'
import { getWorkCenters } from '@/lib/ifs/work-center-departments'
import { wcDepartmani } from '@/lib/ipro/departman-eslesme'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/terminal/uzaktan-basla/secenekler?dept=<WC departman kodu>
// Uzaktan başlat formunun beslemesi: (1) TÜM aktif personel (matris filtresi YOK —
// terminalden herkes seçilebilir), (2) o departmanın açık iş emri operasyonları
// (getShopOrderOperations, WC → wcDepartmani ile departmana eşlenir: numerik+W-prefixli).
// Guard: ipro.admin (uzaktan-basla ile aynı). SALT OKUMA.
export async function GET(req: NextRequest) {
  const { error } = await requirePermission('ipro.admin')
  if (error) return error

  const dept = req.nextUrl.searchParams.get('dept')
  if (!dept) return apiBadRequest('dept gerekli')

  // Aktif personel — matris filtresi YOK (görev: tüm aktif personel seçilebilir).
  const personel = await prisma.personnel.findMany({
    where: { aktif: true },
    select: { id: true, adSoyad: true, sicilNo: true },
    orderBy: { adSoyad: 'asc' },
  })

  // Departmanın açık iş emirleri. IFS erişilemezse boş liste + hata mesajı (form yine açılır).
  let isEmirleri: {
    id: string
    ifsOrderNo: string
    ifsOperationNo: number
    stokKodu: string
    stokAdi: string
    isMerkezi: string
    teslimTarihi: string
    durum: string
  }[] = []
  let ifsError: string | null = null
  try {
    // WC → departman İKİ KAYNAKLI (wcDepartmani): numerik WC (501→WPE) WorkCenterSet'ten,
    // W-prefixli (WMM01→WMM) ad-kökünden. wcMap alınamazsa boş → ad-kökü fallback'i.
    const wcMap = new Map<string, string>()
    try {
      for (const w of await getWorkCenters()) if (w.departmentNo) wcMap.set(w.workCenterNo, w.departmentNo)
    } catch {
      // WC metadata alınamadı → wcMap boş; wcDepartmani ad-köküne düşer.
    }
    const ops = await getShopOrderOperations({})
    isEmirleri = ops
      .filter((o) => wcDepartmani(o.isMerkezi, wcMap) === dept)
      .map((o) => ({
        id: o.id,
        ifsOrderNo: o.isEmriNo,
        ifsOperationNo: o.operasyonNo,
        stokKodu: o.stokKodu,
        stokAdi: o.stokAdi,
        isMerkezi: o.isMerkezi,
        teslimTarihi: o.teslimTarihi,
        durum: o.durum,
      }))
  } catch (e) {
    ifsError = e instanceof Error ? e.message : 'IFS iş emirleri alınamadı'
  }

  return apiSuccess({ personel, isEmirleri, ifsError })
}
