import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@/generated/prisma'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { YILLIK_TAKVIM_EDIT_PERMISSIONS } from '@/lib/yillik-calisma-takvimi/access'
import { ChecklistUpdateSchema, dateOnlyToUtc } from '@/lib/yillik-calisma-takvimi/validators'
import { logYillikTakvimAction } from '@/lib/yillik-calisma-takvimi/audit'
import { isYillikTakvimWorkflowLocked } from '@/lib/yillik-calisma-takvimi/state'
import { lockYillikTakvimParent, YillikTakvimConflictError } from '@/lib/yillik-calisma-takvimi/transaction'

type Context = { params: Promise<{ id: string; checklistId: string }> }
const STRUCTURAL_FIELDS = ['baslik', 'aciklama', 'sorumluEmail', 'sonTarih', 'zorunlu', 'kanitGerekli'] as const

async function getItem(kayitId: string, checklistId: string) {
  return prisma.yillikTakvimChecklist.findFirst({ where: { id: checklistId, kayitId }, include: {
    kayit: { select: { durum: true, iptalMi: true, arsivMi: true, katilimcilar: { where: { rol: 'ANA_SORUMLU' }, select: { userId: true } }, _count: { select: { ekler: true } } } },
  } })
}

export async function PATCH(request: NextRequest, { params }: Context) {
  const { session, userId, error } = await requirePermission([...YILLIK_TAKVIM_EDIT_PERMISSIONS])
  if (error) return error
  const parsed = ChecklistUpdateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Form alanlarını kontrol edin', details: parsed.error.flatten() }, { status: 400 })
  const { id, checklistId } = await params
  const existing = await getItem(id, checklistId)
  if (!existing) return NextResponse.json({ error: 'Checklist maddesi bulunamadı' }, { status: 404 })
  if (existing.kayit.iptalMi || existing.kayit.arsivMi) return NextResponse.json({ error: 'İptal edilmiş veya arşivlenmiş kaydın checklist maddesi değiştirilemez' }, { status: 400 })
  if (isYillikTakvimWorkflowLocked(existing.kayit.durum)) return NextResponse.json({ error: 'Onay sürecindeki veya onaylanmış kaydın checklist maddesi değiştirilemez' }, { status: 400 })

  const isAdmin = session.user.permissions?.includes('yilliktakvim.admin') ?? false
  const isAnaSorumlu = existing.kayit.katilimcilar.some(item => item.userId === userId)
  const structuralChange = STRUCTURAL_FIELDS.some(key => parsed.data[key] !== undefined)
  if (structuralChange && !isAdmin && !isAnaSorumlu) return NextResponse.json({ error: 'Checklist yapısını yalnız ana sorumlu veya admin yönetebilir' }, { status: 403 })
  if (parsed.data.tamamlandi !== undefined && !isAdmin && !isAnaSorumlu && existing.sorumluId !== userId) {
    return NextResponse.json({ error: 'Bu maddeyi yalnız atanmış sorumlusu, ana sorumlu veya admin tamamlayabilir' }, { status: 403 })
  }
  const nextCompleted = parsed.data.tamamlandi ?? existing.tamamlandi
  const nextProofRequired = parsed.data.kanitGerekli ?? existing.kanitGerekli
  if (nextCompleted && nextProofRequired && existing.kayit._count.ekler === 0) {
    return NextResponse.json({ error: 'Bu madde için kanıt gerekli. Kayda ek/kanıt yükleyin.' }, { status: 400 })
  }

  const sorumlu = parsed.data.sorumluEmail ? await prisma.user.findFirst({ where: {
    email: { equals: parsed.data.sorumluEmail, mode: 'insensitive' }, isActive: true,
  }, select: { id: true } }) : null
  if (parsed.data.sorumluEmail && !sorumlu) return NextResponse.json({ error: 'Checklist sorumlusu bulunamadı veya pasif' }, { status: 400 })

  const data: Prisma.YillikTakvimChecklistUncheckedUpdateInput = {
    ...(parsed.data.baslik !== undefined && { baslik: parsed.data.baslik }),
    ...(parsed.data.aciklama !== undefined && { aciklama: parsed.data.aciklama }),
    ...(parsed.data.sorumluEmail !== undefined && { sorumluId: sorumlu?.id ?? null }),
    ...(parsed.data.sonTarih !== undefined && { sonTarih: dateOnlyToUtc(parsed.data.sonTarih) }),
    ...(parsed.data.zorunlu !== undefined && { zorunlu: parsed.data.zorunlu }),
    ...(parsed.data.kanitGerekli !== undefined && { kanitGerekli: parsed.data.kanitGerekli }),
    ...(parsed.data.tamamlandi !== undefined && {
      tamamlandi: parsed.data.tamamlandi,
      tamamlayanId: parsed.data.tamamlandi ? userId : null,
      tamamlanmaTarihi: parsed.data.tamamlandi ? new Date() : null,
    }),
  }
  const changed = Object.keys(parsed.data).map(key => key === 'sorumluEmail' ? 'sorumlu' : key).sort()
  try {
    const updated = await prisma.$transaction(async tx => {
      const locked = await lockYillikTakvimParent(tx, id)
      const fresh = await tx.yillikTakvimChecklist.findFirst({ where: { id: checklistId, kayitId: id }, select: {
        sorumluId: true, tamamlandi: true, kanitGerekli: true,
        kayit: { select: { katilimcilar: { where: { rol: 'ANA_SORUMLU' }, select: { userId: true } }, _count: { select: { ekler: true } } } },
      } })
      const freshOwner = !!fresh && fresh.kayit.katilimcilar.some(item => item.userId === userId)
      const freshCompleted = parsed.data.tamamlandi ?? fresh?.tamamlandi
      const freshProofRequired = parsed.data.kanitGerekli ?? fresh?.kanitGerekli
      if (!locked || !fresh || locked.iptalMi || locked.arsivMi || isYillikTakvimWorkflowLocked(locked.durum) || (structuralChange && !isAdmin && !freshOwner) || (parsed.data.tamamlandi !== undefined && !isAdmin && !freshOwner && fresh.sorumluId !== userId) || (freshCompleted && freshProofRequired && fresh.kayit._count.ekler === 0)) throw new YillikTakvimConflictError('Kayıt durumu veya kanıt koşulu değişti; sayfayı yenileyin')
      const item = await tx.yillikTakvimChecklist.update({ where: { id: checklistId }, data })
      await logYillikTakvimAction({ tx, kayitId: id, yapanId: userId, islemTuru: parsed.data.tamamlandi !== undefined && !structuralChange ? 'CHECKLIST_TAMAMLA' : 'CHECKLIST_GUNCELLE', alan: 'checklist', metadata: { checklistId, degisenAlanlar: changed } })
      return item
    })
    return NextResponse.json(updated)
  } catch (cause) {
    if (cause instanceof YillikTakvimConflictError) return NextResponse.json({ error: cause.message }, { status: 409 })
    console.error('[PATCH checklist item]', cause)
    return NextResponse.json({ error: 'Checklist maddesi güncellenemedi' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  const { session, userId, error } = await requirePermission([...YILLIK_TAKVIM_EDIT_PERMISSIONS])
  if (error) return error
  const { id, checklistId } = await params
  const existing = await getItem(id, checklistId)
  if (!existing) return NextResponse.json({ error: 'Checklist maddesi bulunamadı' }, { status: 404 })
  if (existing.kayit.iptalMi || existing.kayit.arsivMi) return NextResponse.json({ error: 'İptal edilmiş veya arşivlenmiş kaydın checklist maddesi silinemez' }, { status: 400 })
  if (isYillikTakvimWorkflowLocked(existing.kayit.durum)) return NextResponse.json({ error: 'Onay sürecindeki veya onaylanmış kaydın checklist maddesi silinemez' }, { status: 400 })
  const isAdmin = session.user.permissions?.includes('yilliktakvim.admin') ?? false
  const isAnaSorumlu = existing.kayit.katilimcilar.some(item => item.userId === userId)
  if (!isAdmin && !isAnaSorumlu) return NextResponse.json({ error: 'Checklist maddesini yalnız ana sorumlu veya admin silebilir' }, { status: 403 })
  try {
    await prisma.$transaction(async tx => {
      const locked = await lockYillikTakvimParent(tx, id)
      const fresh = await tx.yillikTakvimChecklist.findFirst({ where: { id: checklistId, kayitId: id }, select: { kayit: { select: { katilimcilar: { where: { rol: 'ANA_SORUMLU' }, select: { userId: true } } } } } })
      if (!locked || !fresh || locked.iptalMi || locked.arsivMi || isYillikTakvimWorkflowLocked(locked.durum) || (!isAdmin && !fresh.kayit.katilimcilar.some(item => item.userId === userId))) throw new YillikTakvimConflictError('Kayıt durumu değişti; sayfayı yenileyin')
      await logYillikTakvimAction({ tx, kayitId: id, yapanId: userId, islemTuru: 'CHECKLIST_SIL', alan: 'checklist', metadata: { checklistId } })
      await tx.yillikTakvimChecklist.delete({ where: { id: checklistId } })
    })
    return NextResponse.json({ success: true })
  } catch (cause) {
    if (cause instanceof YillikTakvimConflictError) return NextResponse.json({ error: cause.message }, { status: 409 })
    console.error('[DELETE checklist item]', cause)
    return NextResponse.json({ error: 'Checklist maddesi silinemedi' }, { status: 500 })
  }
}
