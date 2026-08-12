import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { YILLIK_TAKVIM_EDIT_PERMISSIONS, YILLIK_TAKVIM_VIEW_PERMISSIONS } from '@/lib/yillik-calisma-takvimi/access'
import { ChecklistCreateSchema, dateOnlyToUtc } from '@/lib/yillik-calisma-takvimi/validators'
import { logYillikTakvimAction } from '@/lib/yillik-calisma-takvimi/audit'
import { isYillikTakvimWorkflowLocked } from '@/lib/yillik-calisma-takvimi/state'
import { lockYillikTakvimParent, YillikTakvimConflictError } from '@/lib/yillik-calisma-takvimi/transaction'

export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ id: string }> }

const checklistSelect = {
  id: true, baslik: true, aciklama: true, sira: true, sonTarih: true, zorunlu: true,
  kanitGerekli: true, tamamlandi: true, tamamlanmaTarihi: true,
  sorumlu: { select: { id: true, name: true } },
  tamamlayan: { select: { id: true, name: true } },
} as const

export async function GET(_request: NextRequest, { params }: Context) {
  const { error } = await requirePermission([...YILLIK_TAKVIM_VIEW_PERMISSIONS])
  if (error) return error
  const { id } = await params
  const kayit = await prisma.yillikTakvimKaydi.findUnique({ where: { id }, select: { id: true, _count: { select: { ekler: true } } } })
  if (!kayit) return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 })
  const data = await prisma.yillikTakvimChecklist.findMany({ where: { kayitId: id }, select: checklistSelect, orderBy: [{ sira: 'asc' }, { createdAt: 'asc' }] })
  return NextResponse.json({ data, ekSayisi: kayit._count.ekler })
}

export async function POST(request: NextRequest, { params }: Context) {
  const { session, userId, error } = await requirePermission([...YILLIK_TAKVIM_EDIT_PERMISSIONS])
  if (error) return error
  const parsed = ChecklistCreateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Form alanlarını kontrol edin', details: parsed.error.flatten() }, { status: 400 })
  const { id } = await params
  const kayit = await prisma.yillikTakvimKaydi.findUnique({
    where: { id }, select: { id: true, durum: true, iptalMi: true, arsivMi: true, katilimcilar: { where: { rol: 'ANA_SORUMLU' }, select: { userId: true } } },
  })
  if (!kayit) return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 })
  if (kayit.iptalMi || kayit.arsivMi) return NextResponse.json({ error: 'İptal edilmiş veya arşivlenmiş kayda checklist eklenemez' }, { status: 400 })
  if (isYillikTakvimWorkflowLocked(kayit.durum)) return NextResponse.json({ error: 'Onay sürecindeki veya onaylanmış kaydın checklist yapısı değiştirilemez' }, { status: 400 })
  const isAdmin = session.user.permissions?.includes('yilliktakvim.admin') ?? false
  if (!isAdmin && !kayit.katilimcilar.some(item => item.userId === userId)) return NextResponse.json({ error: 'Checklist yapısını yalnız ana sorumlu veya admin yönetebilir' }, { status: 403 })

  const sorumlu = parsed.data.sorumluEmail ? await prisma.user.findFirst({
    where: { email: { equals: parsed.data.sorumluEmail, mode: 'insensitive' }, isActive: true }, select: { id: true },
  }) : null
  if (parsed.data.sorumluEmail && !sorumlu) return NextResponse.json({ error: 'Checklist sorumlusu bulunamadı veya pasif' }, { status: 400 })

  try {
    const item = await prisma.$transaction(async tx => {
      const locked = await lockYillikTakvimParent(tx, id)
      const fresh = await tx.yillikTakvimKaydi.findUnique({ where: { id }, select: { katilimcilar: { where: { rol: 'ANA_SORUMLU' }, select: { userId: true } } } })
      if (!locked || !fresh || locked.iptalMi || locked.arsivMi || isYillikTakvimWorkflowLocked(locked.durum) || (!isAdmin && !fresh.katilimcilar.some(item => item.userId === userId))) throw new YillikTakvimConflictError('Kayıt durumu değişti; sayfayı yenileyin')
      const max = await tx.yillikTakvimChecklist.aggregate({ where: { kayitId: id }, _max: { sira: true } })
      const created = await tx.yillikTakvimChecklist.create({ data: {
        kayitId: id, baslik: parsed.data.baslik, aciklama: parsed.data.aciklama ?? null,
        sira: (max._max.sira ?? 0) + 1, sorumluId: sorumlu?.id ?? null,
        sonTarih: dateOnlyToUtc(parsed.data.sonTarih), zorunlu: parsed.data.zorunlu ?? false,
        kanitGerekli: parsed.data.kanitGerekli ?? false,
      }, select: checklistSelect })
      await logYillikTakvimAction({ tx, kayitId: id, yapanId: userId, islemTuru: 'CHECKLIST_EKLE', alan: 'checklist', metadata: { checklistId: created.id } })
      return created
    })
    return NextResponse.json(item, { status: 201 })
  } catch (cause) {
    if (cause instanceof YillikTakvimConflictError) return NextResponse.json({ error: cause.message }, { status: 409 })
    console.error('[POST checklist]', cause)
    return NextResponse.json({ error: 'Checklist maddesi eklenemedi' }, { status: 500 })
  }
}
