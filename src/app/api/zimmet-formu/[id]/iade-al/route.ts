import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { requirePermission } from '@/lib/auth/require-permission'
import { ZimmetOnayDurumu, ZimmetCihazDurumu } from '@/generated/prisma'

export const dynamic = 'force-dynamic'

/**
 * POST /api/zimmet-formu/[id]/iade-al
 *
 * IT/yetkili cihazı geri alır (sahip DEĞİL). Onaylanmış (tutanaklı) zimmet
 * iade edilir: iadeTarihi/iadeAlanId doldurulur, cihazDurumu hedefe (PASIF=envanter
 * veya HURDA) çekilir. durum ALANI DEĞİŞMEZ — ONAYLANDI kalır (imzalı tutanak geçerli).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { error: permError } = await requirePermission('zimmet-formu.create')
    if (permError) return permError

    const { user, error } = await requireUser()
    if (error) return error

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const hedefDurum = body?.hedefDurum
    const not = typeof body?.not === 'string' ? body.not.trim() : ''

    if (hedefDurum !== ZimmetCihazDurumu.PASIF && hedefDurum !== ZimmetCihazDurumu.HURDA) {
      return NextResponse.json({ error: 'Geçersiz hedef durum: PASIF veya HURDA bekleniyor' }, { status: 400 })
    }

    const zimmet = await prisma.zimmetFormu.findFirst({
      where: { id, silindiMi: false },
      select: { id: true, durum: true, iadeTarihi: true, cihazDurumu: true },
    })
    if (!zimmet) {
      return NextResponse.json({ error: 'Zimmet formu bulunamadı' }, { status: 404 })
    }
    if (zimmet.durum !== ZimmetOnayDurumu.ONAYLANDI) {
      return NextResponse.json({ error: 'Yalnızca onaylanmış zimmet iade alınabilir.' }, { status: 409 })
    }
    if (zimmet.iadeTarihi !== null) {
      return NextResponse.json({ error: 'Bu zimmet zaten iade alınmış.' }, { status: 409 })
    }
    // İade yalnızca AKTIF (kişide olan) cihaz için. Envanterdeki/hurdaki cihaz iade alınmaz.
    if (zimmet.cihazDurumu !== ZimmetCihazDurumu.AKTIF) {
      return NextResponse.json(
        {
          error:
            zimmet.cihazDurumu === ZimmetCihazDurumu.HURDA
              ? 'Hurdaya çıkarılmış cihaz iade alınamaz.'
              : 'Bu cihaz zaten envanterde.',
        },
        { status: 409 },
      )
    }

    const simdi = new Date()
    await prisma.$transaction(async (tx) => {
      await tx.zimmetFormu.update({
        where: { id },
        data: { iadeTarihi: simdi, iadeAlanId: user.id, cihazDurumu: hedefDurum },
      })
      await tx.zimmetDurumGecmisi.create({
        data: {
          zimmetId: id,
          eskiDurum: zimmet.durum,
          yeniDurum: 'IADE_ALINDI',
          islemYapanId: user.id,
          not: `${hedefDurum === ZimmetCihazDurumu.HURDA ? 'Hurdaya çıkarıldı' : 'Envantere alındı'}${not ? ': ' + not : ''}`,
        },
      })
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/zimmet-formu/[id]/iade-al]', err)
    return NextResponse.json({ error: 'İade alınamadı' }, { status: 500 })
  }
}
