import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { YILLIK_TAKVIM_ATTACHMENT_PERMISSIONS } from '@/lib/yillik-calisma-takvimi/access'
import { logYillikTakvimAction } from '@/lib/yillik-calisma-takvimi/audit'
import { readStoredFile, removeStoredFile, restoreStoredFile } from '@/lib/yillik-calisma-takvimi/storage'
import { isYillikTakvimWorkflowLocked } from '@/lib/yillik-calisma-takvimi/state'
import { lockYillikTakvimParent, YillikTakvimConflictError } from '@/lib/yillik-calisma-takvimi/transaction'

type Context = { params: Promise<{ ekId: string }> }
export async function DELETE(_request: NextRequest, { params }: Context) {
  const { session, userId, error } = await requirePermission([...YILLIK_TAKVIM_ATTACHMENT_PERMISSIONS])
  if (error) return error
  const { ekId } = await params
  const attachment = await prisma.yillikTakvimEk.findUnique({ where: { id: ekId }, select: {
    id: true, kayitId: true, dosyaTuru: true, boyut: true, saklamaYolu: true, yukleyenId: true,
    kayit: { select: { durum: true, iptalMi: true, arsivMi: true, katilimcilar: { where: { rol: 'ANA_SORUMLU' }, select: { userId: true } } } },
  } })
  if (!attachment) return NextResponse.json({ error: 'Ek bulunamadı' }, { status: 404 })
  if (attachment.kayit.iptalMi || attachment.kayit.arsivMi) return NextResponse.json({ error: 'İptal edilmiş veya arşivlenmiş kaydın eki silinemez' }, { status: 400 })
  if (isYillikTakvimWorkflowLocked(attachment.kayit.durum)) return NextResponse.json({ error: 'Onay sürecindeki veya onaylanmış kaydın eki silinemez' }, { status: 400 })
  const isAdmin = session.user.permissions?.includes('yilliktakvim.admin') ?? false
  const canDelete = isAdmin || attachment.yukleyenId === userId || attachment.kayit.katilimcilar.some(item => item.userId === userId)
  if (!canDelete) return NextResponse.json({ error: 'Bu eki yalnız yükleyen, ana sorumlu veya admin silebilir' }, { status: 403 })

  let backup: Buffer | null = null
  let fileRemoved = false
  try {
    // Büyük dosya okumasını parent row lock süresinin dışında tut. Lock alındıktan
    // sonra yalnız fiziksel silme ve metadata transaction'ı gerçekleştirilir.
    backup = await readStoredFile(attachment.saklamaYolu)
    await prisma.$transaction(async tx => {
      const locked = await lockYillikTakvimParent(tx, attachment.kayitId)
      const fresh = await tx.yillikTakvimEk.findUnique({ where: { id: ekId }, select: { yukleyenId: true, kayit: { select: { katilimcilar: { where: { rol: 'ANA_SORUMLU' }, select: { userId: true } } } } } })
      const freshCanDelete = !!fresh && (isAdmin || fresh.yukleyenId === userId || fresh.kayit.katilimcilar.some(item => item.userId === userId))
      if (!locked || !fresh || locked.iptalMi || locked.arsivMi || isYillikTakvimWorkflowLocked(locked.durum) || !freshCanDelete) throw new YillikTakvimConflictError('Kayıt durumu değişti; ek silinmedi')
      await removeStoredFile(attachment.saklamaYolu)
      fileRemoved = true
      await logYillikTakvimAction({ tx, kayitId: attachment.kayitId, yapanId: userId, islemTuru: 'EK_SIL', alan: 'ek', metadata: { ekId, dosyaTuru: attachment.dosyaTuru, boyut: attachment.boyut } })
      await tx.yillikTakvimEk.delete({ where: { id: ekId } })
    })
    return NextResponse.json({ success: true })
  } catch (cause) {
    if (fileRemoved && backup) try { await restoreStoredFile(attachment.saklamaYolu, backup) }
    catch (restoreCause) { console.error('[DELETE ek restore]', restoreCause); return NextResponse.json({ error: 'Metadata silinemedi ve fiziksel dosya geri yüklenemedi' }, { status: 500 }) }
    if (cause instanceof YillikTakvimConflictError) return NextResponse.json({ error: cause.message }, { status: 409 })
    console.error('[DELETE ek DB]', cause)
    return NextResponse.json({ error: fileRemoved ? 'Metadata silinemedi; fiziksel dosya geri yüklendi' : 'Fiziksel dosya güvenli biçimde silinemedi; metadata korundu' }, { status: 500 })
  }
}
