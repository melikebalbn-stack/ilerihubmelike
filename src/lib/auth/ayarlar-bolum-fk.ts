import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma'
import { appCache, CACHE_TTL } from '@/lib/cache'
import { AYARLAR_BOLUM_ADLARI, ayarlarBolumMetniMi } from '@/lib/auth/ayarlar-erisim'

/**
 * "Bu Personnel kaydı İnsan Varlıkları ya da İdari İşler'de mi?" — FK ÖNCELİKLİ.
 *
 * `iv-bolum-fk.ts`'in iki bölümlü sürümü; o dosya (tek bölüm, İV) başka üç
 * çağrı noktasında kullanıldığı için DEĞİŞTİRİLMEDİ, burası ayrı duruyor.
 * Aynı gerekçeler geçerli: id koda gömülmez, addan çözülür ve kısa süreli
 * cache'lenir; FK boşsa (pasif kayıt / FK öncesi veri) metin eşleşmesine düşer.
 */

const CACHE_KEY = 'ayarlar_bolum_idleri'

type DbClient = Prisma.TransactionClient | typeof prisma

/** Cache sarmalayıcı — `appCache.get` MISS ile "boş liste" ayrımı için (bkz. iv-bolum-fk). */
type IdKaydi = { idler: string[] }

/** İV + İdari İşler bölümlerinin DepartmentDefinition id'leri (aktif kayıtlar). */
export async function ayarlarBolumIdleri(db: DbClient = prisma): Promise<string[]> {
  const cached = appCache.get<IdKaydi>(CACHE_KEY)
  if (cached) return cached.idler

  const kayitlar = await db.departmentDefinition.findMany({
    where: { name: { in: [...AYARLAR_BOLUM_ADLARI] }, isActive: true },
    select: { id: true },
  })
  const idler = kayitlar.map((k) => k.id)

  // Pozitif sonuç MEDIUM, eksik sonuç SHORT — bölüm sonradan açılırsa yetki
  // en geç bir dakikada gelir, yokluğu da her istekte sorgulanmaz.
  appCache.set<IdKaydi>(CACHE_KEY, { idler }, idler.length ? CACHE_TTL.MEDIUM : CACHE_TTL.SHORT)
  if (!idler.length) {
    console.warn('[ayarlar-bolum-fk] İV/İdari İşler için aktif DepartmentDefinition kaydı bulunamadı — FK yolu kapalı, ad eşleşmesine düşülüyor')
  }
  return idler
}

/**
 * @param departmentId Personnel.departmentId (FK) — doluysa tek ölçüt budur.
 * @param bolum        Personnel.bolum metni — yalnız FK boşken ya da bölüm
 *                     kayıtları çözülemediğinde geri düşüş.
 */
export async function isAyarlarBolumuFk(
  departmentId: string | null | undefined,
  bolum: string | null | undefined,
  db: DbClient = prisma,
): Promise<boolean> {
  if (departmentId) {
    const idler = await ayarlarBolumIdleri(db)
    // Hiçbiri çözülemediyse FK ile karar VERİLEMEZ — sessizce false dönmek
    // yetkiyi kaybettirir, metin yoluna düşülür.
    if (!idler.length) return ayarlarBolumMetniMi(bolum)
    return idler.includes(departmentId)
  }
  return ayarlarBolumMetniMi(bolum)
}
