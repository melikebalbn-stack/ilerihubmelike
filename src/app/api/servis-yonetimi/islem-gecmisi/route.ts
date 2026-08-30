import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { ServisIslemHedefTipi } from '@/generated/prisma'

const GECERLI_HEDEF_TIPLERI = new Set<string>(Object.values(ServisIslemHedefTipi))

// 13 modelin (15 hedefTipi değeri) create/update/pasifleştir/geri-al
// geçmişini TEK bir uç noktadan okur — her modelin kendi route'unda ayrı
// bir "geçmiş" endpoint'i açmak yerine (bkz. plan onayı). servis.history
// zaten Yetki Matrisi'nde 4 role tanımlı, yeni bir anahtar gerekmedi.
export async function GET(request: NextRequest) {
  const { error } = await requirePermission('servis.history')
  if (error) return error
  try {
    // Bir kaydın alt kayıtları farklı bir hedefTipi altında loglanabiliyor
    // (örn. Personel Atama'nın dilim seçimi PERSONEL_ATAMA_DILIM) — aynı
    // "Geçmiş" ekranında ikisi de görünsün diye virgülle ayrılmış birden
    // fazla değere izin veriliyor.
    const hedefTipiParam = request.nextUrl.searchParams.get('hedefTipi')
    const hedefId = request.nextUrl.searchParams.get('hedefId')
    const hedefTipleri = hedefTipiParam?.split(',').map((t) => t.trim()).filter(Boolean) ?? []
    if (hedefTipleri.length === 0 || hedefTipleri.some((t) => !GECERLI_HEDEF_TIPLERI.has(t))) {
      return NextResponse.json({ ok: false, message: 'Geçersiz veya eksik hedefTipi.' }, { status: 400 })
    }
    if (!hedefId?.trim()) {
      return NextResponse.json({ ok: false, message: 'hedefId zorunludur.' }, { status: 400 })
    }

    const kayitlar = await prisma.servisIslemGecmisi.findMany({
      where: { hedefTipi: { in: hedefTipleri as ServisIslemHedefTipi[] }, hedefId },
      select: {
        id: true,
        islem: true,
        oncekiDeger: true,
        yeniDeger: true,
        aciklama: true,
        tarih: true,
        user: { select: { name: true } },
      },
      orderBy: { tarih: 'desc' },
    })

    return NextResponse.json({ ok: true, data: kayitlar })
  } catch (err) {
    console.error('Servis işlem geçmişi alma hatası:', err)
    return NextResponse.json({ ok: false, message: 'İşlem geçmişi alınırken hata oluştu.' }, { status: 500 })
  }
}
