import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireKpiYaz } from '@/lib/yonetim/kpi-yetki'

export const dynamic = 'force-dynamic'

// PATCH: mevcut aksiyonu güncelle. Veri değiştirir → kpi.manage ∨ müdür koltuğu
// (KPI'nın departmanı koltuk ağacında; requireKpiYaz 403/404 döner).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; aksiyonId: string }> }) {
  const { id, aksiyonId } = await params
  const { error } = await requireKpiYaz(id)
  if (error) return error

  const body = await request.json()

  const mevcut = await prisma.kPIAction.findUnique({ where: { id: aksiyonId } })
  if (!mevcut || mevcut.kpiId !== id) {
    return NextResponse.json({ error: 'Aksiyon bulunamadı' }, { status: 404 })
  }

  const action = typeof body.action === 'string' ? body.action.trim() : ''
  if (!action) {
    return NextResponse.json({ error: 'Aksiyon metni zorunludur' }, { status: 400 })
  }

  const aksiyon = await prisma.kPIAction.update({
    where: { id: aksiyonId },
    data: {
      reason: typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : null,
      action,
      sorumluPersonelId: typeof body.sorumluPersonelId === 'string' && body.sorumluPersonelId ? body.sorumluPersonelId : null,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      completionPercent: body.completionPercent === '' || body.completionPercent == null ? 0 : Number(body.completionPercent),
    },
  })

  return NextResponse.json({ aksiyon })
}
