import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { requirePermission } from '@/lib/auth/require-permission'
import { ZimmetOnayDurumu } from '@/generated/prisma'

export const dynamic = 'force-dynamic'

// Yanlışlıkla reddedilen bir kaydı tekrar onay sürecine sokar (ONAY_BEKLIYOR).
// Devir kayıtları (kaynak: SYTELINE_DEVIR) dahil - tekrar ONAY_BEKLIYOR'a
// dönünce kayıt zaten kendi akışına (devir-onay, sahibi tarafından / normal
// onayla, Melih tarafından) geri düşüyor; burada AYRICA bildirim
// tetiklenmiyor çünkü o akışların kendi bildirim mekanizması zaten var.
// Yetki: zimmet-formu.approve (Sil/Düzenle ile aynı).
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { error: permError } = await requirePermission('zimmet-formu.approve')
    if (permError) return permError

    const { user, error } = await requireUser()
    if (error) return error

    const { id } = await params

    const mevcut = await prisma.zimmetFormu.findFirst({
      where: { id, silindiMi: false },
      select: { id: true, durum: true, redSebebi: true },
    })
    if (!mevcut) {
      return NextResponse.json({ error: 'Zimmet formu bulunamadı' }, { status: 404 })
    }
    if (mevcut.durum !== ZimmetOnayDurumu.REDDEDILDI) {
      return NextResponse.json(
        { error: 'Yalnızca reddedilmiş kayıtlar tekrar onaya gönderilebilir' },
        { status: 400 },
      )
    }

    const guncellendi = await prisma.zimmetFormu.update({
      where: { id },
      data: {
        durum: ZimmetOnayDurumu.ONAY_BEKLIYOR,
        redSebebi: null,
      },
    })

    // Sahibin red beyanı (ör. "bu cihaz bende değil, 2023'te iade ettim") kanıt
    // niteliğinde - redSebebi ana alanda null'a düşse de (kayıt artık ONAY_BEKLIYOR,
    // orada durması yanlış olur) eski gerekçe audit log'a yazılıp korunur.
    await prisma.zimmetDurumGecmisi.create({
      data: {
        zimmetId: id,
        eskiDurum: mevcut.durum,
        yeniDurum: guncellendi.durum,
        islemYapanId: user.id,
        not: `Reddedilen kayıt tekrar onaya gönderildi${mevcut.redSebebi ? ' (önceki red gerekçesi: ' + mevcut.redSebebi + ')' : ''}`,
      },
    })

    return NextResponse.json(guncellendi)
  } catch (err) {
    console.error('[POST /api/zimmet-formu/[id]/tekrar-onaya-gonder]', err)
    return NextResponse.json({ error: 'İşlem tamamlanamadı' }, { status: 500 })
  }
}
