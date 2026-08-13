import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'

export const dynamic = 'force-dynamic'

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, error } = await requireUser()
    if (error) return error

    const { id } = await params

    const zimmet = await prisma.zimmetFormu.findUnique({
      where: { id },
      select: { id: true, zimmetSahibiId: true, zimmetSahibiImzaTarihi: true },
    })

    if (!zimmet) {
      return NextResponse.json({ error: 'Zimmet formu bulunamadı' }, { status: 404 })
    }

    if (user.id !== zimmet.zimmetSahibiId) {
      return NextResponse.json({ error: 'Bu zimmet formunun sahibi değilsiniz' }, { status: 403 })
    }

    if (zimmet.zimmetSahibiImzaTarihi) {
      return NextResponse.json({ error: 'Bu zimmet formu zaten imzalandı' }, { status: 409 })
    }

    const guncellendi = await prisma.zimmetFormu.update({
      where: { id },
      data: { zimmetSahibiImzaTarihi: new Date() },
    })

    // İmza bir "durum" alanı değiştirmiyor (zimmetSahibiImzaTarihi ayrı bir
    // alan) ama akışın önemli bir adımı olduğu için sabit metin etiketleriyle
    // audit log'a kaydediliyor.
    await prisma.zimmetDurumGecmisi.create({
      data: {
        zimmetId: id,
        eskiDurum: 'İMZA_BEKLENIYOR',
        yeniDurum: 'İMZALANDI',
        islemYapanId: user.id,
      },
    })

    return NextResponse.json(guncellendi)
  } catch (err) {
    console.error('[PATCH /api/zimmet-formu/[id]/imzala]', err)
    return NextResponse.json({ error: 'İmzalama tamamlanamadı' }, { status: 500 })
  }
}
