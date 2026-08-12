import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@/generated/prisma'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { YILLIK_TAKVIM_NOTIFICATION_PERMISSIONS } from '@/lib/yillik-calisma-takvimi/access'
import { BildirimKuraliUpdateSchema } from '@/lib/yillik-calisma-takvimi/notification-validators'
import { logYillikTakvimAction } from '@/lib/yillik-calisma-takvimi/audit'

type Context = { params: Promise<{ id: string; kuralId: string }> }
async function context() { return requirePermission([...YILLIK_TAKVIM_NOTIFICATION_PERMISSIONS]) }
async function find(id: string, kuralId: string) {
  return prisma.yillikTakvimBildirimKurali.findFirst({ where: { id: kuralId, kayitId: id }, include: { kayit: { select: { iptalMi: true, arsivMi: true } } } })
}
export async function PATCH(request: NextRequest, { params }: Context) {
  const auth = await context(); if (auth.error) return auth.error
  const body = await request.json().catch(() => null); const parsed = BildirimKuraliUpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Geçersiz bildirim kuralı', detail: parsed.error.format() }, { status: 400 })
  const { id, kuralId } = await params; const existing = await find(id, kuralId)
  if (!existing) return NextResponse.json({ error: 'Kural bulunamadı' }, { status: 404 })
  if (existing.kayit.iptalMi || existing.kayit.arsivMi) return NextResponse.json({ error: 'İptal veya arşiv kaydında bildirim kuralı değiştirilemez' }, { status: 400 })
  const data: Prisma.YillikTakvimBildirimKuraliUpdateInput = parsed.data
  const updated = await prisma.$transaction(async tx => {
    const rule = await tx.yillikTakvimBildirimKurali.update({ where: { id: kuralId }, data })
    await logYillikTakvimAction({ tx, kayitId: id, yapanId: auth.userId!, islemTuru: 'BILDIRIM_KURALI_GUNCELLE', alan: 'bildirim_kurali', metadata: { kuralId } })
    return rule
  })
  return NextResponse.json(updated)
}
export async function DELETE(_request: NextRequest, { params }: Context) {
  const auth = await context(); if (auth.error) return auth.error
  const { id, kuralId } = await params; const existing = await find(id, kuralId)
  if (!existing) return NextResponse.json({ error: 'Kural bulunamadı' }, { status: 404 })
  if (existing.kayit.iptalMi || existing.kayit.arsivMi) return NextResponse.json({ error: 'İptal veya arşiv kaydında bildirim kuralı değiştirilemez' }, { status: 400 })
  await prisma.$transaction(async tx => {
    await tx.yillikTakvimBildirimKurali.delete({ where: { id: kuralId } })
    await logYillikTakvimAction({ tx, kayitId: id, yapanId: auth.userId!, islemTuru: 'BILDIRIM_KURALI_SIL', alan: 'bildirim_kurali', metadata: { kuralId, tetik: existing.tetik } })
  })
  return NextResponse.json({ success: true })
}
