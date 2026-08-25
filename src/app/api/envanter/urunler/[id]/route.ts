import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import {
  getEnvanterUrunDetail,
  logEnvanterIslem,
  updateEnvanterUrun,
} from '@/lib/envanter/service'
import { Prisma } from '@/generated/prisma'
import { envanterHataMesaji } from '@/lib/envanter/hata'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.view')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }
  try {
    const { id } = await params
    const urun = await getEnvanterUrunDetail(id)

    if (!urun) {
      return NextResponse.json(
        { ok: false, message: 'Ürün bulunamadı.' },
        { status: 404 },
      )
    }

    return NextResponse.json({
      ok: true,
      data: urun,
    })
  } catch (error) {
    console.error('Ürün detay API hatası:', error)

    return NextResponse.json(
      { ok: false, message: 'Ürün detayı alınamadı.' },
      { status: 500 },
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.admin')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await request.json()

    // Tum alan/kilit/dogrulama mantigi servisin icinde — TEK KAYNAK.
    // Satir ici degistiriciler (bedenTipi/kategori/hedefYaka/hedefBolum) da,
    // tam duzenleme formu da ayni yoldan gecer.
    const { urun, degisiklikler, degisiklikVar } = await updateEnvanterUrun(
      id,
      body,
      session.user.id,
      session.user.name || session.user.email || 'Bilinmiyor',
    )

    return NextResponse.json({
      ok: true,
      message: degisiklikVar ? 'Ürün güncellendi.' : 'Değişiklik yok.',
      degisenAlanlar: Object.keys(degisiklikler),
      data: urun,
    })
  } catch (err) {
    console.error('Envanter ürün güncelleme hatası:', err)

    if (
      err instanceof Prisma.PrismaClientValidationError ||
      (err as { name?: string })?.name === 'PrismaClientValidationError'
    ) {
      // Ham Prisma metni model/alan yapısını sızdırır — kullanıcıya GİTMEZ,
      // yalnız yukarıdaki console.error ile sunucu loguna yazılır.
      return NextResponse.json(
        { ok: false, message: 'Kaydedilemeyen alan var, sistem yöneticisine bildirin' },
        { status: 500 },
      )
    }

    return NextResponse.json(
      { ok: false, message: envanterHataMesaji(err, 'Ürün güncellenemedi.') },
      { status: 400 },
    )
  }
}

// Sil/Pasifleştir — hibrit: stok hareketi veya zimmet geçmişi yoksa kalıcı silinir,
// varsa (geçmiş/denetim kaydı bozulmasın diye) sadece pasifleştirilir (durum=PASIF).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.admin')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }

  try {
    const { id } = await params
    const urun = await prisma.envanterUrun.findUnique({ where: { id } })
    if (!urun) {
      return NextResponse.json({ ok: false, message: 'Ürün bulunamadı.' }, { status: 404 })
    }

    const [hareketSayisi, zimmetSayisi] = await Promise.all([
      prisma.envanterStokHareket.count({ where: { urunId: id } }),
      prisma.envanterZimmet.count({ where: { urunId: id } }),
    ])

    const aktorId = session.user.id
    const aktorAd = session.user.name || session.user.email || 'Bilinmiyor'

    if (hareketSayisi === 0 && zimmetSayisi === 0) {
      await prisma.envanterUrun.delete({ where: { id } })
      await logEnvanterIslem({
        actorId: aktorId,
        actorAd: aktorAd,
        islemTipi: 'URUN_SIL',
        hedefTip: 'EnvanterUrun',
        hedefId: id,
        detay: { kod: urun.kod, ad: urun.ad, aktorAd },
      })
      return NextResponse.json({ ok: true, kalici: true, message: 'Ürün kalıcı olarak silindi.' })
    }

    await prisma.envanterUrun.update({ where: { id }, data: { durum: 'PASIF' } })
    await logEnvanterIslem({
      actorId: aktorId,
      actorAd: aktorAd,
      islemTipi: 'URUN_PASIFLESTIR',
      hedefTip: 'EnvanterUrun',
      hedefId: id,
      detay: { kod: urun.kod, ad: urun.ad, hareketSayisi, zimmetSayisi, aktorAd },
    })
    return NextResponse.json({
      ok: true,
      kalici: false,
      message: `Bu ürünün stok hareketi/zimmet geçmişi olduğu için kalıcı silinemedi, pasifleştirildi (${hareketSayisi} hareket, ${zimmetSayisi} zimmet).`,
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: envanterHataMesaji(err, 'Silinemedi.') },
      { status: 400 },
    )
  }
}
