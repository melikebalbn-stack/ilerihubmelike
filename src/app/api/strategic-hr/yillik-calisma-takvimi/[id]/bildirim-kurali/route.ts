import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { YILLIK_TAKVIM_NOTIFICATION_PERMISSIONS, YILLIK_TAKVIM_VIEW_PERMISSIONS } from '@/lib/yillik-calisma-takvimi/access'
import { BildirimKuraliCreateSchema } from '@/lib/yillik-calisma-takvimi/notification-validators'
import { logYillikTakvimAction } from '@/lib/yillik-calisma-takvimi/audit'

type Context = { params: Promise<{ id: string }> }
export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: Context) {
  const { error } = await requirePermission([...YILLIK_TAKVIM_VIEW_PERMISSIONS])
  if (error) return error
  const { id } = await params
  const record = await prisma.yillikTakvimKaydi.findUnique({ where: { id }, select: { id: true } })
  if (!record) return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 })
  return NextResponse.json(await prisma.yillikTakvimBildirimKurali.findMany({ where: { kayitId: id }, orderBy: { id: 'asc' } }))
}

export async function POST(request: NextRequest, { params }: Context) {
  const { userId, error } = await requirePermission([...YILLIK_TAKVIM_NOTIFICATION_PERMISSIONS])
  if (error) return error
  const body = await request.json().catch(() => null)
  const parsed = BildirimKuraliCreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Geçersiz bildirim kuralı', detail: parsed.error.format() }, { status: 400 })
  const { id } = await params
  const record = await prisma.yillikTakvimKaydi.findUnique({ where: { id }, select: { id: true, iptalMi: true, arsivMi: true } })
  if (!record) return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 })
  if (record.iptalMi || record.arsivMi) return NextResponse.json({ error: 'İptal veya arşiv kaydında bildirim kuralı değiştirilemez' }, { status: 400 })
  const created = await prisma.$transaction(async tx => {
    const rule = await tx.yillikTakvimBildirimKurali.create({ data: { kayitId: id, ...parsed.data, aktif: parsed.data.aktif ?? true } })
    await logYillikTakvimAction({ tx, kayitId: id, yapanId: userId!, islemTuru: 'BILDIRIM_KURALI_EKLE', alan: 'bildirim_kurali', metadata: { kuralId: rule.id, tetik: rule.tetik } })
    return rule
  })
  return NextResponse.json(created, { status: 201 })
}
