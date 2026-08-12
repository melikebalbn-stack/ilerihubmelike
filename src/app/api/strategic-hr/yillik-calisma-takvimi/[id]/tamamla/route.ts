import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { YILLIK_TAKVIM_COMPLETE_PERMISSIONS } from '@/lib/yillik-calisma-takvimi/access'
import { logYillikTakvimAction } from '@/lib/yillik-calisma-takvimi/audit'
import { lockYillikTakvimParent, YillikTakvimConflictError } from '@/lib/yillik-calisma-takvimi/transaction'

type Context = { params: Promise<{ id: string }> }
const KAPALI_DURUMLAR = ['TAMAMLANDI_ONAY_BEKLIYOR', 'ONAYLANDI', 'IPTAL_EDILDI'] as const

export async function POST(_request: NextRequest, { params }: Context) {
  const { session, userId, error } = await requirePermission([...YILLIK_TAKVIM_COMPLETE_PERMISSIONS])
  if (error) return error
  const { id } = await params
  const kayit = await prisma.yillikTakvimKaydi.findUnique({ where: { id }, select: {
    id: true, durum: true, iptalMi: true, arsivMi: true, kanitZorunlu: true,
    katilimcilar: { where: { rol: 'ANA_SORUMLU' }, select: { userId: true } },
    checklist: { where: { OR: [{ zorunlu: true }, { kanitGerekli: true }], tamamlandi: false }, select: { id: true, baslik: true } },
    _count: { select: { ekler: true } },
  } })
  if (!kayit) return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 })
  if (kayit.iptalMi || kayit.arsivMi) return NextResponse.json({ error: 'İptal edilmiş veya arşivlenmiş kayıt tamamlamaya gönderilemez' }, { status: 400 })
  if ((KAPALI_DURUMLAR as readonly string[]).includes(kayit.durum)) return NextResponse.json({ error: 'Kayıt zaten tamamlanma/onay sürecinde veya kapalı' }, { status: 400 })
  const isAdmin = session.user.permissions?.includes('yilliktakvim.admin') ?? false
  if (!isAdmin && !kayit.katilimcilar.some(item => item.userId === userId)) return NextResponse.json({ error: 'Kaydı yalnız ana sorumlu veya admin tamamlamaya gönderebilir' }, { status: 403 })

  if (kayit.checklist.length > 0) return NextResponse.json({
    error: 'Zorunlu checklist maddeleri tamamlanmadan kayıt gönderilemez',
    tamamlanmamisMaddeler: kayit.checklist.map(item => ({ id: item.id, baslik: item.baslik })),
  }, { status: 400 })
  if (kayit.kanitZorunlu && kayit._count.ekler === 0) return NextResponse.json({
    error: 'Bu kayıt için kanıt gerekli. Kayda ek/kanıt yükleyin.', kanitEksik: true,
  }, { status: 400 })

  try {
    await prisma.$transaction(async tx => {
      await lockYillikTakvimParent(tx, id)
      const fresh = await tx.yillikTakvimKaydi.findUnique({ where: { id }, select: {
        durum: true, iptalMi: true, arsivMi: true, kanitZorunlu: true,
        katilimcilar: { where: { rol: 'ANA_SORUMLU' }, select: { userId: true } },
        checklist: { where: { OR: [{ zorunlu: true }, { kanitGerekli: true }], tamamlandi: false }, select: { id: true } },
        _count: { select: { ekler: true } },
      } })
      if (!fresh || fresh.iptalMi || fresh.arsivMi || (KAPALI_DURUMLAR as readonly string[]).includes(fresh.durum) ||
        (!isAdmin && !fresh.katilimcilar.some(item => item.userId === userId)) || fresh.checklist.length > 0 || (fresh.kanitZorunlu && fresh._count.ekler === 0)) {
        throw new YillikTakvimConflictError('Kayıt koşulları değişti; sayfayı yenileyin')
      }
      await tx.yillikTakvimKaydi.update({ where: { id }, data: { durum: 'TAMAMLANDI_ONAY_BEKLIYOR', updatedById: userId } })
      await logYillikTakvimAction({ tx, kayitId: id, yapanId: userId, islemTuru: 'TAMAMLAMAYA_GONDER', alan: 'durum', metadata: { oncekiDurum: kayit.durum, yeniDurum: 'TAMAMLANDI_ONAY_BEKLIYOR' } })
    })
    return NextResponse.json({ success: true, id, durum: 'TAMAMLANDI_ONAY_BEKLIYOR' })
  } catch (cause) {
    if (cause instanceof YillikTakvimConflictError) return NextResponse.json({ error: cause.message }, { status: 409 })
    console.error('[POST tamamla]', cause)
    return NextResponse.json({ error: 'Kayıt tamamlamaya gönderilemedi' }, { status: 500 })
  }
}
