import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { ZimmetOnayDurumu } from '@/generated/prisma'
import { dispatchZimmetSahibiImzaIstegi } from '@/lib/zimmet/notifications'
import { requirePermission } from '@/lib/auth/require-permission'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { error: permError } = await requirePermission('zimmet-formu.approve')
    if (permError) return permError

    const { user, error } = await requireUser()
    if (error) return error

    const { id } = await params
    const body = await request.json()
    const karar = typeof body.karar === 'string' ? body.karar : ''

    if (karar !== 'ONAYLANDI' && karar !== 'REDDEDILDI') {
      return NextResponse.json({ error: 'Geçersiz karar: ONAYLANDI veya REDDEDILDI bekleniyor' }, { status: 400 })
    }

    const mevcut = await prisma.zimmetFormu.findUnique({
      where: { id },
      select: { id: true, durum: true },
    })
    if (!mevcut) {
      return NextResponse.json({ error: 'Zimmet formu bulunamadı' }, { status: 404 })
    }
    if (mevcut.durum !== ZimmetOnayDurumu.ONAY_BEKLIYOR) {
      return NextResponse.json({ error: 'Bu zimmet formu zaten işleme alınmış' }, { status: 409 })
    }

    const guncellendi = await prisma.zimmetFormu.update({
      where: { id },
      data:
        karar === 'ONAYLANDI'
          ? { durum: ZimmetOnayDurumu.ONAYLANDI, onaylayanId: user.id, onayTarihi: new Date() }
          : { durum: ZimmetOnayDurumu.REDDEDILDI },
    })

    await prisma.zimmetDurumGecmisi.create({
      data: {
        zimmetId: id,
        eskiDurum: mevcut.durum,
        yeniDurum: guncellendi.durum,
        islemYapanId: user.id,
      },
    })

    // zimmetSahibiId boş olabilir (Excel'den serbest metinle gelip Toplu
    // Bağlama ile henüz eşleştirilmemiş kayıt) - bu durumda bildirilecek
    // gerçek bir kullanıcı yok, sessizce atla.
    if (karar === 'ONAYLANDI' && guncellendi.zimmetSahibiId) {
      const zimmetSahibi = await prisma.user.findUnique({
        where: { id: guncellendi.zimmetSahibiId },
        select: { id: true, email: true, name: true },
      })
      if (zimmetSahibi) {
        void dispatchZimmetSahibiImzaIstegi({
          zimmet: { id: guncellendi.id },
          zimmetSahibi,
        }).catch(console.error)
      }
    }

    return NextResponse.json(guncellendi)
  } catch (err) {
    console.error('[PATCH /api/zimmet-formu/[id]/onayla]', err)
    return NextResponse.json({ error: 'İşlem tamamlanamadı' }, { status: 500 })
  }
}
