import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'

export const dynamic = 'force-dynamic'

// PATCH: mevcut aksiyonu güncelle. Veri değiştirir → kpi.manage.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; aksiyonId: string }> }) {
  const { error } = await requirePermission(PERMISSION_KEYS.KPI_MANAGE)
  if (error) return error

  const { id, aksiyonId } = await params
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
