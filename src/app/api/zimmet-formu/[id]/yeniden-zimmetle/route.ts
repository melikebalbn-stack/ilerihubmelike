import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { requirePermission } from '@/lib/auth/require-permission'
import { ZimmetOnayDurumu, ZimmetCihazDurumu, ZimmetKaynak } from '@/generated/prisma'

export const dynamic = 'force-dynamic'

/**
 * POST /api/zimmet-formu/[id]/yeniden-zimmetle
 *
 * Envantere alınmış (iade edilmiş + PASIF) bir cihazı yeni bir kullanıcıya
 * zimmetler. ESKİ kayda DOKUNMAZ — cihaz alanlarını kopyalayıp YENİ bir
 * ONAY_BEKLIYOR kaydı açar. HURDA cihaz yeniden zimmetlenemez.
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
    const yeniSahipId = typeof body?.yeniSahipId === 'string' ? body.yeniSahipId : null
    if (!yeniSahipId) {
      return NextResponse.json({ error: 'yeniSahipId zorunlu' }, { status: 400 })
    }

    const kaynak = await prisma.zimmetFormu.findFirst({
      where: { id, silindiMi: false },
      select: {
        id: true,
        iadeTarihi: true,
        cihazDurumu: true,
        seriNumarasi: true,
        tur: true,
        turDiger: true,
        ozellik: true,
        macAdresi: true,
        pcAdi: true,
        imeiNumarasi: true,
      },
    })
    if (!kaynak) {
      return NextResponse.json({ error: 'Zimmet formu bulunamadı' }, { status: 404 })
    }
    // Yeniden zimmetleme yalnızca PASIF (envanterdeki) cihaz için. İade geçmişi ŞART
    // değil — devir import'undan PASIF gelen cihazlar da envanterde sayılır.
    if (kaynak.cihazDurumu !== ZimmetCihazDurumu.PASIF) {
      return NextResponse.json(
        {
          error:
            kaynak.cihazDurumu === ZimmetCihazDurumu.HURDA
              ? 'Hurdaya çıkarılmış cihaz zimmetlenemez.'
              : 'Bu cihaz halen bir kişide zimmetli.',
        },
        { status: 409 },
      )
    }

    const yeniSahip = await prisma.user.findUnique({
      where: { id: yeniSahipId },
      select: { id: true, isActive: true },
    })
    if (!yeniSahip || !yeniSahip.isActive) {
      return NextResponse.json({ error: 'Geçersiz veya pasif kullanıcı' }, { status: 400 })
    }

    const yeni = await prisma.zimmetFormu.create({
      data: {
        zimmetSahibiId: yeniSahipId,
        createdById: user.id,
        tur: kaynak.tur,
        turDiger: kaynak.turDiger,
        seriNumarasi: kaynak.seriNumarasi,
        ozellik: kaynak.ozellik,
        macAdresi: kaynak.macAdresi,
        pcAdi: kaynak.pcAdi,
        imeiNumarasi: kaynak.imeiNumarasi,
        verilisTarihi: new Date(),
        durum: ZimmetOnayDurumu.ONAY_BEKLIYOR,
        cihazDurumu: ZimmetCihazDurumu.AKTIF,
        kaynak: ZimmetKaynak.MANUEL,
      },
      select: { id: true },
    })

    await prisma.zimmetDurumGecmisi.create({
      data: {
        zimmetId: yeni.id,
        eskiDurum: null,
        yeniDurum: ZimmetOnayDurumu.ONAY_BEKLIYOR,
        islemYapanId: user.id,
        not: `Envanterden yeniden zimmetlendi (kaynak: ${kaynak.id})`,
      },
    })

    return NextResponse.json({ yeniZimmetId: yeni.id })
  } catch (err) {
    console.error('[POST /api/zimmet-formu/[id]/yeniden-zimmetle]', err)
    return NextResponse.json({ error: 'Yeniden zimmetlenemedi' }, { status: 500 })
  }
}
