import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { getTalepDetay } from '@/lib/envanter/satinalma'
import { logEnvanterIslem } from '@/lib/envanter/service'
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

  const { id } = await params
  const talep = await getTalepDetay(id)

  if (!talep) {
    return NextResponse.json({ ok: false, message: 'Talep bulunamadı.' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, data: talep })
}

// Sadece TASLAK asamasinda ve hic islem gecmisi olmayan (henuz onay surecine hic
// girmemis) talepler kalici silinebilir. Aksi halde Iptal Et kullanilmali.
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
    const talep = await prisma.envanterSatinAlmaTalep.findUnique({
      where: { id },
      include: { gecmis: true },
    })
    if (!talep) {
      return NextResponse.json({ ok: false, message: 'Talep bulunamadı.' }, { status: 404 })
    }

    // NOT: createTalep her zaman 1 "Talep oluşturuldu" gecmis kaydı ekler;
    // bu yuzden > 0 yerine > 1 kontrol edilir (sadece olusturma sonrasi
    // gercek bir onay/red/revize/iptal islemi varsa hard-delete engellenir).
    if (talep.durum !== 'TASLAK' || talep.gecmis.length > 1) {
      return NextResponse.json(
        {
          ok: false,
          message:
            'Bu talep taslak aşamasında değil veya işlem geçmişi var; kalıcı silinemez. Bunun yerine İptal Et kullanın.',
        },
        { status: 400 },
      )
    }

    await prisma.envanterSatinAlmaKalem.deleteMany({ where: { talepId: id } })
    await prisma.envanterSatinAlmaTalep.delete({ where: { id } })

    await logEnvanterIslem({
      actorId: session.user.id,
      actorAd: session.user.name || session.user.email || 'Bilinmiyor',
      islemTipi: 'SATINALMA_TALEBI_SIL',
      hedefTip: 'EnvanterSatinAlmaTalep',
      hedefId: id,
      detay: { formNo: talep.formNo, aktorAd: session.user.name || session.user.email },
    })

    return NextResponse.json({ ok: true, message: 'Talep kalıcı olarak silindi.' })
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: envanterHataMesaji(err, 'Talep silinemedi.') },
      { status: 400 },
    )
  }
}
