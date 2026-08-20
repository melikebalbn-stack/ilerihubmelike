import { NextRequest, NextResponse } from 'next/server'
import type { Prisma, YillikTakvimKaydi } from '@/generated/prisma'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { YILLIK_TAKVIM_CANCEL_PERMISSIONS, YILLIK_TAKVIM_EDIT_PERMISSIONS, YILLIK_TAKVIM_VIEW_PERMISSIONS } from '@/lib/yillik-calisma-takvimi/access'
import { dateOnlyToUtc, YillikTakvimUpdateSchema, type YillikTakvimUpdateInput } from '@/lib/yillik-calisma-takvimi/validators'
import { logYillikTakvimCancel, logYillikTakvimUpdate } from '@/lib/yillik-calisma-takvimi/audit'
import { isYillikTakvimWorkflowLocked } from '@/lib/yillik-calisma-takvimi/state'
import { lockYillikTakvimParent, YillikTakvimConflictError } from '@/lib/yillik-calisma-takvimi/transaction'

export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ id: string }> }

const DIS_KAYNAK_KILITLI_ALANLAR = [
  'anaKonu', 'surec', 'kisaBaslik', 'departmentId',
  'nihaiSonTarih', 'plananUygulamaTarihi', 'periyot',
] as const

const detailSelect = {
  id: true, yil: true, anaKonu: true, surec: true, kisaBaslik: true, aciklama: true,
  oncelik: true, kayitTuru: true, periyot: true, durum: true,
  plananUygulamaTarihi: true, nihaiSonTarih: true, disKurum: true,
  gerceklesmeDurumu: true, gerceklesmeTarihi: true, gerceklesmemeNedeni: true,
  kaynakModul: true, iptalMi: true, arsivMi: true, createdById: true,
  department: { select: { id: true, name: true } },
  katilimcilar: {
    where: { rol: { in: ['ANA_SORUMLU', 'YEDEK_SORUMLU', 'BILGILENDIRILECEK'] as const } },
    select: { id: true, rol: true, user: { select: { id: true, name: true, email: true } } },
  },
  sonrakiKayitlar: { where: { iptalMi: false }, select: { id: true, yil: true, durum: true } },
} satisfies Prisma.YillikTakvimKaydiSelect

export async function GET(_request: NextRequest, { params }: Context) {
  const { error } = await requirePermission([...YILLIK_TAKVIM_VIEW_PERMISSIONS])
  if (error) return error
  const { id } = await params
  try {
    const kayit = await prisma.yillikTakvimKaydi.findUnique({ where: { id }, select: detailSelect })
    if (!kayit) return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 })
    return NextResponse.json(kayit)
  } catch (cause) {
    console.error('[GET /api/strategic-hr/yillik-calisma-takvimi/[id]]', cause)
    return NextResponse.json({ error: 'Kayıt detayı alınamadı' }, { status: 500 })
  }
}

function changedFields(body: YillikTakvimUpdateInput, existing: YillikTakvimKaydi): string[] {
  const changed: string[] = []
  const dateChanged = (key: 'nihaiSonTarih' | 'plananUygulamaTarihi' | 'gerceklesmeTarihi', value: string | null | undefined) => {
    if (value === undefined) return
    const next = dateOnlyToUtc(value)?.toISOString() ?? null
    const current = existing[key]?.toISOString() ?? null
    if (next !== current) changed.push(key)
  }
  for (const key of ['anaKonu', 'surec', 'kisaBaslik', 'aciklama', 'departmentId', 'periyot', 'oncelik', 'disKurum', 'gerceklesmeDurumu', 'gerceklesmemeNedeni'] as const) {
    if (body[key] !== undefined && (body[key] ?? null) !== (existing[key] ?? null)) changed.push(key)
  }
  dateChanged('nihaiSonTarih', body.nihaiSonTarih)
  dateChanged('plananUygulamaTarihi', body.plananUygulamaTarihi)
  dateChanged('gerceklesmeTarihi', body.gerceklesmeTarihi)
  return changed
}

export async function PATCH(request: NextRequest, { params }: Context) {
  const { userId, error } = await requirePermission([...YILLIK_TAKVIM_EDIT_PERMISSIONS])
  if (error) return error
  const { id } = await params
  const json = await request.json().catch(() => null)
  const parsed = YillikTakvimUpdateSchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'Form alanlarını kontrol edin', details: parsed.error.flatten() }, { status: 400 })
  const body = parsed.data

  try {
    const existing = await prisma.yillikTakvimKaydi.findUnique({
      where: { id },
      include: { katilimcilar: {
        where: { rol: { in: ['ANA_SORUMLU', 'YEDEK_SORUMLU', 'BILGILENDIRILECEK'] } },
        select: { id: true, userId: true, rol: true },
      } },
    })
    if (!existing) return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 })
    if (existing.iptalMi || existing.arsivMi) return NextResponse.json({ error: 'İptal edilmiş veya arşivlenmiş kayıt düzenlenemez' }, { status: 400 })
    if (isYillikTakvimWorkflowLocked(existing.durum)) return NextResponse.json({ error: 'Onay sürecindeki veya onaylanmış kayıt düzenlenemez' }, { status: 400 })

    const changed = changedFields(body, existing)
    if (existing.kaynakModul) {
      const locked = changed.filter(field => (DIS_KAYNAK_KILITLI_ALANLAR as readonly string[]).includes(field))
      if (locked.length > 0) return NextResponse.json({ error: `Bu kayıt ${existing.kaynakModul} kaynağından yönetiliyor; kilitli alanlar değiştirilemez`, lockedFields: locked }, { status: 400 })
    }

    const nextReason = body.gerceklesmemeNedeni !== undefined ? body.gerceklesmemeNedeni : existing.gerceklesmemeNedeni
    const nextStatus = body.gerceklesmeDurumu ?? existing.gerceklesmeDurumu
    if ((nextStatus === 'GERCEKLESMEDI' || nextStatus === 'DEVREDILDI') && !nextReason?.trim()) {
      return NextResponse.json({ error: 'Gerçekleşmedi veya devredildi durumunda neden zorunludur' }, { status: 400 })
    }

    const [department, anaSorumlu, yedekSorumlu, bilgilendirilecekler] = await Promise.all([
      body.departmentId ? prisma.department.findFirst({ where: { id: body.departmentId, isActive: true }, select: { id: true } }) : null,
      body.anaSorumluEmail ? prisma.user.findFirst({ where: { email: { equals: body.anaSorumluEmail, mode: 'insensitive' }, isActive: true }, select: { id: true } }) : null,
      body.yedekSorumluEmail ? prisma.user.findFirst({ where: { email: { equals: body.yedekSorumluEmail, mode: 'insensitive' }, isActive: true }, select: { id: true } }) : null,
      body.bilgilendirilecekEmailler?.length ? prisma.user.findMany({
        where: { isActive: true, OR: body.bilgilendirilecekEmailler.map(email => ({ email: { equals: email, mode: 'insensitive' as const } })) },
        select: { id: true, email: true },
      }) : [],
    ])
    if (body.departmentId && !department) return NextResponse.json({ error: 'Aktif departman bulunamadı' }, { status: 400 })
    if (body.anaSorumluEmail && !anaSorumlu) return NextResponse.json({ error: 'Ana sorumlu İleriHub kullanıcısı olarak bulunamadı veya pasif' }, { status: 400 })
    if (body.yedekSorumluEmail && !yedekSorumlu) return NextResponse.json({ error: 'Yedek sorumlu İleriHub kullanıcısı olarak bulunamadı veya pasif' }, { status: 400 })
    const bilgilendirilecekEmailler = new Set((body.bilgilendirilecekEmailler ?? []).map(email => email.toLowerCase()))
    const bulunanBilgilendirilecekEmailler = new Set(bilgilendirilecekler.map(user => user.email.toLowerCase()))
    if (body.bilgilendirilecekEmailler && [...bilgilendirilecekEmailler].some(email => !bulunanBilgilendirilecekEmailler.has(email))) {
      return NextResponse.json({ error: 'Bilgilendirilecek kişilerden biri İleriHub kullanıcısı olarak bulunamadı veya pasif' }, { status: 400 })
    }

    const currentResponsible = existing.katilimcilar.find(participant => participant.rol === 'ANA_SORUMLU')
    const currentBackup = existing.katilimcilar.find(participant => participant.rol === 'YEDEK_SORUMLU')
    const currentInformed = existing.katilimcilar.filter(participant => participant.rol === 'BILGILENDIRILECEK')
    const responsibleChanged = !!anaSorumlu && currentResponsible?.userId !== anaSorumlu.id
    const backupChanged = body.yedekSorumluEmail !== undefined && currentBackup?.userId !== (yedekSorumlu?.id ?? undefined)
    const informedChanged = body.bilgilendirilecekEmailler !== undefined && (
      currentInformed.length !== bilgilendirilecekler.length
      || currentInformed.some(participant => !bilgilendirilecekler.some(user => user.id === participant.userId))
    )
    if (responsibleChanged) changed.push('anaSorumlu')
    if (backupChanged) changed.push('yedekSorumlu')
    if (informedChanged) changed.push('bilgilendirilecekler')
    if (changed.length === 0) return NextResponse.json({ error: 'Değişiklik bulunamadı' }, { status: 400 })

    await prisma.$transaction(async tx => {
      const locked = await lockYillikTakvimParent(tx, id)
      if (!locked || locked.iptalMi || locked.arsivMi || isYillikTakvimWorkflowLocked(locked.durum)) throw new YillikTakvimConflictError('Kayıt durumu değişti; sayfayı yenileyin')
      const data: Prisma.YillikTakvimKaydiUpdateInput = {
        ...(body.anaKonu !== undefined && { anaKonu: body.anaKonu }),
        ...(body.surec !== undefined && { surec: body.surec }),
        ...(body.kisaBaslik !== undefined && { kisaBaslik: body.kisaBaslik }),
        ...(body.aciklama !== undefined && { aciklama: body.aciklama }),
        ...(body.departmentId !== undefined && { department: { connect: { id: body.departmentId } } }),
        ...(body.nihaiSonTarih !== undefined && { nihaiSonTarih: dateOnlyToUtc(body.nihaiSonTarih) }),
        ...(body.plananUygulamaTarihi !== undefined && { plananUygulamaTarihi: dateOnlyToUtc(body.plananUygulamaTarihi) }),
        ...(body.periyot !== undefined && { periyot: body.periyot }),
        ...(body.oncelik !== undefined && { oncelik: body.oncelik }),
        ...(body.disKurum !== undefined && { disKurum: body.disKurum }),
        ...(body.gerceklesmeDurumu !== undefined && { gerceklesmeDurumu: body.gerceklesmeDurumu }),
        ...(body.gerceklesmeTarihi !== undefined && { gerceklesmeTarihi: dateOnlyToUtc(body.gerceklesmeTarihi) }),
        ...(body.gerceklesmemeNedeni !== undefined && { gerceklesmemeNedeni: body.gerceklesmemeNedeni }),
        updatedBy: { connect: { id: userId } },
      }
      await tx.yillikTakvimKaydi.update({ where: { id }, data })
      if (responsibleChanged && anaSorumlu) {
        if (currentResponsible) await tx.yillikTakvimKatilimci.update({ where: { id: currentResponsible.id }, data: { userId: anaSorumlu.id } })
        else await tx.yillikTakvimKatilimci.create({ data: { kayitId: id, userId: anaSorumlu.id, rol: 'ANA_SORUMLU' } })
      }
      if (backupChanged) {
        if (yedekSorumlu && currentBackup) await tx.yillikTakvimKatilimci.update({ where: { id: currentBackup.id }, data: { userId: yedekSorumlu.id } })
        else if (yedekSorumlu) await tx.yillikTakvimKatilimci.create({ data: { kayitId: id, userId: yedekSorumlu.id, rol: 'YEDEK_SORUMLU' } })
        else if (currentBackup) await tx.yillikTakvimKatilimci.delete({ where: { id: currentBackup.id } })
      }
      if (informedChanged) {
        const nextUserIds = new Set(bilgilendirilecekler.map(user => user.id))
        const currentUserIds = new Set(currentInformed.map(participant => participant.userId))
        const removedIds = currentInformed.filter(participant => !nextUserIds.has(participant.userId)).map(participant => participant.id)
        const addedUserIds = bilgilendirilecekler.filter(user => !currentUserIds.has(user.id)).map(user => user.id)
        if (removedIds.length) await tx.yillikTakvimKatilimci.deleteMany({ where: { id: { in: removedIds } } })
        if (addedUserIds.length) await tx.yillikTakvimKatilimci.createMany({ data: addedUserIds.map(userId => ({ kayitId: id, userId, rol: 'BILGILENDIRILECEK' })) })
      }
      await logYillikTakvimUpdate({ tx, kayitId: id, yapanId: userId, degisenAlanlar: [...new Set(changed)].sort() })
    })
    return NextResponse.json({ success: true, id })
  } catch (cause) {
    if (cause instanceof YillikTakvimConflictError) return NextResponse.json({ error: cause.message }, { status: 409 })
    console.error('[PATCH /api/strategic-hr/yillik-calisma-takvimi/[id]]', cause)
    return NextResponse.json({ error: 'Kayıt güncellenemedi' }, { status: 500 })
  }
}

/** Fiziksel silme yapmaz; kaydı iptal durumuna atomik olarak geçirir. */
export async function DELETE(_request: NextRequest, { params }: Context) {
  const { userId, error } = await requirePermission([...YILLIK_TAKVIM_CANCEL_PERMISSIONS])
  if (error) return error
  const { id } = await params

  try {
    const existing = await prisma.yillikTakvimKaydi.findUnique({
      where: { id },
      select: { id: true, iptalMi: true, arsivMi: true, kaynakModul: true },
    })
    if (!existing) return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 })
    if (existing.iptalMi) return NextResponse.json({ success: true, id, alreadyCancelled: true })
    if (existing.arsivMi) return NextResponse.json({ error: 'Arşivlenmiş kayıt iptal edilemez' }, { status: 400 })
    if (existing.kaynakModul) {
      return NextResponse.json({ error: `Bu kayıt ${existing.kaynakModul} kaynağından yönetiliyor; iptal işlemi kaynak modülden yapılmalıdır` }, { status: 400 })
    }

    await prisma.$transaction(async tx => {
      const locked = await lockYillikTakvimParent(tx, id)
      if (!locked || locked.iptalMi || locked.arsivMi || locked.kaynakModul) throw new YillikTakvimConflictError('Kayıt durumu değişti; sayfayı yenileyin')
      await tx.yillikTakvimKaydi.update({
        where: { id },
        data: { iptalMi: true, durum: 'IPTAL_EDILDI', updatedById: userId },
      })
      await logYillikTakvimCancel({ tx, kayitId: id, yapanId: userId })
    })
    return NextResponse.json({ success: true, id })
  } catch (cause) {
    if (cause instanceof YillikTakvimConflictError) return NextResponse.json({ error: cause.message }, { status: 409 })
    console.error('[DELETE /api/strategic-hr/yillik-calisma-takvimi/[id]]', cause)
    return NextResponse.json({ error: 'Kayıt iptal edilemedi' }, { status: 500 })
  }
}
