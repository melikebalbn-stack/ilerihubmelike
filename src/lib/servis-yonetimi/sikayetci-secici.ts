import type { PrismaClient } from '@/generated/prisma'

// MASTER Madde 46 — şikâyet formundaki "Şikâyetçi" alanı için personel arama.
//
// KVKK / minimum veri: yalnız id, adSoyad, sicilNo, bolum döndürülür.
// serviceRoute, serviceStop, telefon, adres, mailAdresi vb. HİÇBİR HASSAS ALAN
// select'e girmez — mevcut personel seçicilerinden (secici, search) hiçbiri bu
// dar kapsamı sağlamadığı için (bkz. commit mesajı) ayrı, minimal bir uç.
//
// Var olan personel seçicilerinden farklı: yetkisi servis.sikayet.manage,
// arama zorunlu (min 2 karakter — boş/1 karakterde DB'ye hiç gidilmez).

export interface SikayetciAday {
  id: string
  adSoyad: string
  sicilNo: string | null
  bolum: string | null
}

const AZAMI_SONUC = 20
const MIN_ARAMA_UZUNLUGU = 2

/**
 * Arama terimi 2 karakterden kısaysa DB'ye hiç gidilmez, boş dizi döner.
 * Bu davranış saf fonksiyonda sabitlenir ki uç katmanı yanlışlıkla atlayamasın.
 */
export async function sikayetciAra(
  prisma: PrismaClient,
  aramaTermi: string | null | undefined,
): Promise<SikayetciAday[]> {
  const terim = (aramaTermi ?? '').trim()
  if (terim.length < MIN_ARAMA_UZUNLUGU) return []

  // Türkçe İ/ı büyük-küçük varyantı: ILIKE (mode: 'insensitive') PostgreSQL
  // collation'ına bağlı, "işçi"/"İŞÇİ" ayrımını garanti içermez. Aynı desen
  // src/app/api/personnel/search/route.ts'te de kullanılıyor.
  const varyantlar = [...new Set([terim, terim.toLocaleLowerCase('tr'), terim.toLocaleUpperCase('tr')])]

  const personeller = await prisma.personnel.findMany({
    where: {
      aktif: true,
      OR: varyantlar.flatMap((v) => [
        { adSoyad: { contains: v, mode: 'insensitive' as const } },
        { sicilNo: { contains: v, mode: 'insensitive' as const } },
      ]),
    },
    // 🔴 KVKK sınır bekçisi: yalnız bu dört alan. Yeni bir alan eklenecekse
    // önce burada, bilinçli olarak eklenmeli — "select yok, tüm model" YOK.
    select: {
      id: true,
      adSoyad: true,
      sicilNo: true,
      bolum: true,
    },
    orderBy: { adSoyad: 'asc' },
    take: AZAMI_SONUC,
  })

  return personeller
}
