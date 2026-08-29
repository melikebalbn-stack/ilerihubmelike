import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'

// Dahili personel şoförü seçimi için dar kapsamlı arama — yalnız aktif
// personel, yalnız sicilNo/adSoyad/bolum döner (PII sızıntısını önlemek
// için /api/personnel yerine bu dar kapsamlı endpoint kullanılıyor).
//
// Arama Prisma/DB seviyesinde DEĞİL, JS'de tr-TR duyarlı yapılıyor: dev/prod
// veritabanı en_US.UTF-8 collation kullanıyor, bu locale'de İ/I/ı Türkçe
// kurallarına göre büyük/küçük harfe çevrilmiyor (ör. "Işık" ILIKE "%ışık%"
// Postgres'te false döner). Personnel tablosu (~binlerce kayıt) bu filtreyi
// her istekte belleğe çekip taramaya uygun ölçekte; modülün diğer
// ekranlarındaki (Firma/Araç/Şoför listesi) client-side tr-TR arama
// deseniyle aynı yaklaşım.
export async function GET(request: NextRequest) {
  const { error } = await requirePermission('servis.tanim.manage')
  if (error) return error

  try {
    const search = request.nextUrl.searchParams.get('search')?.trim()
    const personel = await prisma.personnel.findMany({
      where: { aktif: true },
      select: { id: true, sicilNo: true, adSoyad: true, bolum: true },
      orderBy: { adSoyad: 'asc' },
    })

    if (!search) {
      return NextResponse.json({ ok: true, data: personel.slice(0, 50) })
    }

    const terim = search.toLocaleLowerCase('tr-TR')
    const data = personel
      .filter((p) =>
        p.adSoyad.toLocaleLowerCase('tr-TR').includes(terim) ||
        (p.sicilNo?.toLocaleLowerCase('tr-TR').includes(terim) ?? false)
      )
      .slice(0, 50)

    return NextResponse.json({ ok: true, data })
  } catch (err) {
    console.error('Servis personel arama hatası:', err)
    return NextResponse.json({ ok: false, message: 'Personel listesi alınamadı.' }, { status: 500 })
  }
}
