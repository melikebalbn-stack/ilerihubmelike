import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma'
import { appCache, CACHE_TTL } from '@/lib/cache'
import { isInsanVarliklari } from '@/lib/auth/personnel-access'

/**
 * FAZ 3a · "Bu kişi İnsan Varlıkları bölümünde mi?" — FK ÖNCELİKLİ.
 *
 * `isInsanVarliklari`/`isIkBolum` SİLİNMEDİ ve silinmemeli: 27 çağrı noktası
 * hâlâ `User.department` (LDAP metni) üzerinden çalışıyor ve o tarafta FK YOK
 * (User tablosunda departmentId kolonu bulunmuyor, AD adları DepartmentDefinition
 * ile tutmuyor: "Insan Varliklari Departmanı" ↔ "İnsan Varlıkları Müdürlüğü").
 * Bu helper YALNIZ `Personnel` kaydından karar veren üç nokta için.
 *
 * KURAL: `Personnel.departmentId === <İnsan Varlıkları Müdürlüğü id>`.
 * FK boşsa (pasif kayıt, FK'dan önce yazılmış veri) MEVCUT `isInsanVarliklari`
 * normalize yoluna düşülür — Faz 2'deki desenin aynısı.
 *
 * ID KODA GÖMÜLMEZ: DepartmentDefinition'dan ada göre çözülür ve süreç içinde
 * kısa süreli cache'lenir (bölüm adı/kaydı değişirse en geç TTL sonunda yansır).
 */

/** Bölümün adı — DB'deki tek doğruluk kaynağı. Ad değişirse burası güncellenir. */
export const IV_BOLUM_ADI = 'İnsan Varlıkları Müdürlüğü'
const CACHE_KEY = 'iv_bolum_id'

type DbClient = Prisma.TransactionClient | typeof prisma

/**
 * Cache SARMALAYICI — `appCache.get` kayıt YOKKEN de `null` döndürüyor ve `has()`
 * yok; ham `string | null` saklansaydı "cache'te yok" ile "cache'te null var"
 * ayırt edilemezdi (negatif sonuç her istekte yeniden sorgulanırdı ya da tam tersi,
 * bulunamama kalıcı sanılırdı). Nesneye sarınca `get` → null = MISS, nesne = HIT.
 */
type IvIdKaydi = { id: string | null }

/** İV bölümünün DepartmentDefinition id'si (aktif kayıt). Bulunamazsa null. */
export async function ivBolumId(db: DbClient = prisma): Promise<string | null> {
  const cached = appCache.get<IvIdKaydi>(CACHE_KEY)
  if (cached) return cached.id

  const dept = await db.departmentDefinition.findFirst({
    where: { name: IV_BOLUM_ADI, isActive: true },
    select: { id: true },
  })
  const id = dept?.id ?? null

  // POZİTİF sonuç MEDIUM (5 dk), NEGATİF sonuç SHORT (1 dk) cache'lenir: bölüm
  // kaydı sonradan açılır/aktifleşirse yetki en geç 1 dakikada geri gelir, ama
  // yokluğu da her istekte sorgulanmaz.
  appCache.set<IvIdKaydi>(CACHE_KEY, { id }, id ? CACHE_TTL.MEDIUM : CACHE_TTL.SHORT)
  if (!id) {
    console.warn(`[iv-bolum-fk] "${IV_BOLUM_ADI}" aktif DepartmentDefinition kaydı bulunamadı — FK yolu kapalı, ad eşleşmesine düşülüyor`)
  }
  return id
}

/**
 * FK öncelikli İV kontrolü.
 * @param departmentId Personnel.departmentId (FK) — doluysa TEK ölçüt budur.
 * @param bolum        Personnel.bolum metni — yalnız FK boşken geri düşüş.
 */
export async function isIvBolumuFk(
  departmentId: string | null | undefined,
  bolum: string | null | undefined,
  db: DbClient = prisma,
): Promise<boolean> {
  if (departmentId) {
    const ivId = await ivBolumId(db)
    // İV kaydı çözülemediyse FK ile karar VERİLEMEZ — sessizce false dönmek
    // yetkiyi kaybettirir. Eski normalize yoluna düşülür (davranış korunur).
    if (ivId === null) return isInsanVarliklari(bolum)
    return departmentId === ivId
  }
  return isInsanVarliklari(bolum)
}
